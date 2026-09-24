"use server"

import { revalidatePath } from "next/cache"

import { tanimKullanimSayisi } from "./veri"
import { tanimSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { TUR_ADLARI } from "@/lib/tanim-turleri"
import { YetkiHatasi } from "@/lib/yetki"
import type { TanimTur } from "@/generated/prisma/enums"

export type TanimFormDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

function alanHatalariniTopla(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

function tazele(tur: string) {
  revalidatePath(`/ayar/tanim?tur=${tur}`)
  revalidatePath("/ayar/tanim")
}

/**
 * Tanım ekle / güncelle — `iscilik/actions.ts`teki `bolumKaydet`in
 * genelleştirilmiş hali (`tur` sabit "ISCILIK_BOLUMU" değil formdan gelir).
 */
export async function tanimKaydet(
  _oncekiDurum: TanimFormDurumu,
  form: FormData
): Promise<TanimFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = tanimSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data
  const tur = v.tur as TanimTur

  // `@@unique([tur, ad, ustId])` kısıtı zaten var; önceden kontrol etmenin
  // sebebi kullanıcıya Prisma hatası yerine anlaşılır bir mesaj gösterebilmek.
  const cakisan = await prisma.tanim.findFirst({
    where: { tur, ad: v.ad, ...(duzenleme ? { NOT: { id } } : {}) },
    select: { id: true },
  })
  if (cakisan) {
    return {
      hata: "Bu isimde bir tanım zaten var.",
      alanHatalari: { ad: "Bu ad zaten kayıtlı." },
    }
  }

  const kayit = duzenleme
    ? await prisma.tanim.update({
        where: { id },
        data: { ad: v.ad, kod: v.kod ?? null, sira: v.sira },
      })
    : await prisma.tanim.create({
        data: { tur, ad: v.ad, kod: v.kod ?? null, sira: v.sira },
      })

  await logKaydet({
    islem: duzenleme ? "GUNCELLE" : "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: kayit.id,
    aciklama: `${TUR_ADLARI[tur]}: ${kayit.ad}`,
    yeniDeger: kayit,
  })

  tazele(tur)
  return { basarili: duzenleme ? "Tanım güncellendi." : "Tanım eklendi." }
}

/**
 * Aktif/pasif — `Tanim`'de soft delete alanı yok, "kullanımdan kaldırma"
 * işi bu bayrakla yürüyor (bolum deseninin aynısı).
 */
export async function tanimDurumDegistir(
  id: number,
  aktif: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kayit = await prisma.tanim.update({ where: { id }, data: { aktif } })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: id,
    aciklama: `${TUR_ADLARI[kayit.tur]}: ${kayit.ad} ${aktif ? "aktifleştirildi" : "pasife alındı"}`,
  })

  tazele(kayit.tur)
  return {}
}

/**
 * Kullanımda olmayan (hiçbir Arac/Kabul/KasaHareket satırında adı geçmeyen)
 * tanımı fiziksel siler. Kullanımdaysa reddedilir — silinseydi o kayıtların
 * "hangi markaydı/yerdeydi" bilgisi sessizce anlamsızlaşırdı; "pasife al"
 * zaten aynı işi güvenli şekilde görüyor.
 */
export async function tanimSil(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kayit = await prisma.tanim.findUnique({ where: { id } })
  if (!kayit) return { hata: "Tanım bulunamadı." }

  const kullanim = await tanimKullanimSayisi(kayit.tur, kayit.ad)
  if (kullanim > 0) {
    return {
      hata: `Bu tanım ${kullanim} kayıtta kullanılıyor. Silmek yerine pasife alabilirsiniz.`,
    }
  }

  await prisma.tanim.delete({ where: { id } })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: id,
    aciklama: `${TUR_ADLARI[kayit.tur]}: ${kayit.ad} silindi`,
    eskiDeger: kayit,
  })

  tazele(kayit.tur)
  return {}
}
