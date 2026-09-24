"use server"

import { revalidatePath } from "next/cache"

import { plasiyerSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * PLASİYER (SORUMLU PERSONEL) TANIMLARI — yazma tarafı.
 *
 * Yetki "cari" modülünden okunuyor: bu liste yalnızca cari kartını
 * beslediği için ayrı bir yetki kalemi açmak yetki matrisini gereksiz
 * büyütür ve "cariyi düzeltebilen ama sorumlu personel ekleyemeyen" gibi
 * kimsenin istemediği bir durum üretirdi.
 */

export type TanimFormDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

class CakismaHatasi extends Error {}

function alanHatalariniTopla(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

/** Bu iki listeyi kullanan ekranların hepsi tek yerden tazeleniyor. */
function tazele() {
  revalidatePath("/cari/tanimlar")
  revalidatePath("/cari")
  revalidatePath("/cari/yeni")
}

// ------------------------------------------------------------- PLASİYER

/**
 * Plasiyer bir cari kaydıdır (turu = PERSONEL). Bu ekran onun sadece kimlik
 * alanlarını yönetir; bakiye, açılış, limit gibi cari alanlarına dokunmaz —
 * onlar için /cari/[id]/duzenle var. Buradan açılan kayıt cari listesinde de
 * normal bir personel kartı olarak görünür.
 */
export async function plasiyerKaydet(
  _oncekiDurum: TanimFormDurumu,
  form: FormData
): Promise<TanimFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = plasiyerSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      // Kod verilmediyse cari numaratöründen üretiliyor: plasiyer de bir cari
      // olduğu için ayrı numara serisi açmak kod alanını çakıştırırdı.
      const kod =
        v.kod ??
        (duzenleme
          ? undefined
          : await siradakiNumara(tx, "CARI_KOD", { varsayilanOnEk: "C", basamak: 6 }))

      if (kod) {
        const cakisan = await tx.cari.findFirst({
          where: { kod, ...(duzenleme ? { NOT: { id } } : {}) },
          select: { id: true },
        })
        if (cakisan) {
          throw new CakismaHatasi(`"${kod}" kodu başka bir cari kartında kullanılıyor.`)
        }
      }

      const alanlar = {
        unvan: v.unvan,
        gsm: v.gsm ?? null,
        email: v.email ?? null,
        ...(kod ? { kod } : {}),
      }

      if (duzenleme) {
        const onceki = await tx.cari.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new CakismaHatasi("Sorumlu personel bulunamadı.")
        if (onceki.turu !== "PERSONEL") {
          throw new CakismaHatasi("Bu kart personel kartı değil, cari ekranından düzenleyin.")
        }

        const kayit = await tx.cari.update({
          where: { id },
          data: { ...alanlar, guncelleyenId: kullanici.id },
        })

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "cariler",
          kayitId: kayit.id,
          aciklama: `Sorumlu personel: ${kayit.kod} — ${kayit.unvan}`,
          eskiDeger: onceki,
          yeniDeger: kayit,
        })
        return
      }

      const kayit = await tx.cari.create({
        data: {
          ...alanlar,
          kod: kod as string,
          turu: "PERSONEL",
          tipi: "SAHIS",
          olusturanId: kullanici.id,
        },
      })

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "cariler",
        kayitId: kayit.id,
        aciklama: `Sorumlu personel: ${kayit.kod} — ${kayit.unvan}`,
        yeniDeger: kayit,
      })
    })
  } catch (hata) {
    if (hata instanceof CakismaHatasi) return { hata: hata.message }
    throw hata
  }

  tazele()
  return { basarili: duzenleme ? "Sorumlu personel güncellendi." : "Sorumlu personel eklendi." }
}

/**
 * Plasiyeri pasife alır/aktifleştirir. Kart SİLİNMEZ: silinseydi ona bağlı
 * cariler ve ileride gelecek komisyon kayıtları sahipsiz kalırdı. Pasif
 * plasiyer yeni cari kartında seçilemez, mevcut atamalar bozulmaz.
 */
export async function plasiyerDurumDegistir(
  id: number,
  aktif: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const onceki = await prisma.cari.findUnique({
    where: { id },
    select: { turu: true, silindi: true },
  })
  if (!onceki || onceki.silindi || onceki.turu !== "PERSONEL") {
    return { hata: "Sorumlu personel bulunamadı." }
  }

  const kayit = await prisma.cari.update({
    where: { id },
    data: { aktif, guncelleyenId: kullanici.id },
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    kayitId: id,
    aciklama: `Sorumlu personel ${aktif ? "aktifleştirildi" : "pasife alındı"}: ${kayit.kod} — ${kayit.unvan}`,
  })

  tazele()
  return {}
}
