"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { bolumSemasi, iscilikSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type IscilikFormDurumu = {
  hata?: string
  alanHatalari?: Record<string, string>
}

/** Zod hatalarını alan adına göre tek tek eşler (diğer modüllerdeki desen). */
function alanHatalariniTopla(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

/**
 * İşçilik kaydet (yeni kayıt veya güncelleme).
 * Gizli `id` alanının varlığı ekleme/güncellemeyi ayırır — Araç ve Cari
 * modüllerinde kullanılan desenin aynısı.
 */
export async function iscilikKaydet(
  _oncekiDurum: IscilikFormDurumu,
  form: FormData
): Promise<IscilikFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("iscilik", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = iscilikSemasi.safeParse({
    ...Object.fromEntries(form),
    aktif: form.get("aktif") === "on",
  })

  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }

  const v = cozum.data
  let kayitId: number

  try {
    kayitId = await prisma.$transaction(async (tx) => {
      // Kod elle girilmediyse numaratörden üretilir; numara ile kayıt aynı
      // transaction'da olduğu için kayıt açılmazsa numara da boşa yanmaz.
      const kod =
        v.kod ?? (await siradakiNumara(tx, "ISCILIK_KOD", { varsayilanOnEk: "IS", basamak: 5 }))

      const cakisan = await tx.iscilik.findFirst({
        where: { kod, ...(duzenleme ? { NOT: { id } } : {}) },
        select: { id: true },
      })
      if (cakisan) throw new KodCakismasi(kod)

      const alanlar = {
        kod,
        ad: v.ad,
        sure: v.sure,
        fiyat: v.fiyat,
        kdvOrani: v.kdvOrani,
        aciklama: v.aciklama ?? null,
        aktif: v.aktif,
      }

      if (duzenleme) {
        const onceki = await tx.iscilik.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()

        const kayit = await tx.iscilik.update({
          where: { id },
          data: {
            ...alanlar,
            // Prisma 7'de scalar FK doğrudan yazılamıyor; ilişki nesnesi gerekiyor.
            bolum: v.bolumId ? { connect: { id: v.bolumId } } : { disconnect: true },
          },
        })

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "iscilikler",
          kayitId: kayit.id,
          aciklama: kayit.kod + " — " + kayit.ad,
          eskiDeger: onceki,
          yeniDeger: kayit,
        })
        return kayit.id
      }

      const kayit = await tx.iscilik.create({
        data: {
          ...alanlar,
          ...(v.bolumId ? { bolum: { connect: { id: v.bolumId } } } : {}),
        },
      })

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "iscilikler",
        kayitId: kayit.id,
        aciklama: kayit.kod + " — " + kayit.ad,
        yeniDeger: kayit,
      })
      return kayit.id
    })
  } catch (hata) {
    if (hata instanceof KodCakismasi) {
      return { hata: hata.message, alanHatalari: { kod: "Bu kod zaten kullanılıyor." } }
    }
    if (hata instanceof BulunamadiHatasi) {
      return { hata: "İşçilik kaydı bulunamadı; silinmiş olabilir." }
    }
    console.error("İşçilik kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/iscilik")
  redirect(`/iscilik?kaydedildi=${kayitId}`)
}

/**
 * İşçiliği siler veya geri alır. Fiziksel silme YOK — geçmiş kabul
 * kalemleri bu kayda bağlı; fiziksel silinseydi eski iş emirleri yetim kalırdı.
 */
export async function iscilikSilmeDurumu(
  id: number,
  silinsin: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("iscilik", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const onceki = await prisma.iscilik.findUnique({
    where: { id },
    select: { id: true, kod: true, ad: true, silindi: true },
  })
  if (!onceki) return { hata: "İşçilik bulunamadı." }

  await prisma.iscilik.update({ where: { id }, data: { silindi: silinsin } })

  await logKaydet({
    islem: silinsin ? "SIL" : "GERI_AL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "iscilikler",
    kayitId: id,
    aciklama: onceki.kod + " — " + onceki.ad,
    eskiDeger: onceki,
  })

  revalidatePath("/iscilik")
  return {}
}

// ---------------------------------------------------------------------------
//  İŞÇİLİK BÖLÜMLERİ (Tanim, tur = ISCILIK_BOLUMU)
// ---------------------------------------------------------------------------

export type BolumFormDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

/** Bölüm ekle / güncelle. Aynı ekranda satır içi kullanıldığı için redirect yok. */
export async function bolumKaydet(
  _oncekiDurum: BolumFormDurumu,
  form: FormData
): Promise<BolumFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("iscilik", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = bolumSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data

  // `@@unique([tur, ad, ustId])` kısıtı zaten var; çakışmayı önceden
  // kontrol etmemizin sebebi kullanıcıya anlaşılır bir mesaj gösterebilmek.
  const cakisan = await prisma.tanim.findFirst({
    where: { tur: "ISCILIK_BOLUMU", ad: v.ad, ...(duzenleme ? { NOT: { id } } : {}) },
    select: { id: true },
  })
  if (cakisan) {
    return {
      hata: "Bu isimde bir bölüm zaten var.",
      alanHatalari: { ad: "Bu bölüm zaten kayıtlı." },
    }
  }

  const kayit = duzenleme
    ? await prisma.tanim.update({
        where: { id },
        data: { ad: v.ad, kod: v.kod ?? null, sira: v.sira },
      })
    : await prisma.tanim.create({
        data: { tur: "ISCILIK_BOLUMU", ad: v.ad, kod: v.kod ?? null, sira: v.sira },
      })

  await logKaydet({
    islem: duzenleme ? "GUNCELLE" : "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: kayit.id,
    aciklama: "İşçilik bölümü: " + kayit.ad,
    yeniDeger: kayit,
  })

  revalidatePath("/iscilik/bolum")
  revalidatePath("/iscilik")
  return { basarili: duzenleme ? "Bölüm güncellendi." : "Bölüm eklendi." }
}

/**
 * Bölümü aktif/pasif yapar. `Tanim` tablosunda soft delete alanı yok; bu yüzden
 * "kullanımdan kaldırma" işi aktiflik bayrağıyla yürüyor.
 */
export async function bolumDurumDegistir(
  id: number,
  aktif: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("iscilik", "duzelt")
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
    aciklama: `İşçilik bölümü ${aktif ? "aktifleştirildi" : "pasife alındı"}: ${kayit.ad}`,
  })

  revalidatePath("/iscilik/bolum")
  revalidatePath("/iscilik")
  return {}
}

/**
 * Hiç işçiliğe bağlanmamış bölümü tamamen siler. Bağlı kayıt varsa silinmez:
 * silinseydi eski işçiliklerin bölüm bilgisi sessizce kaybolurdu.
 */
export async function bolumSil(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("iscilik", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kayit = await prisma.tanim.findUnique({
    where: { id },
    select: { id: true, ad: true, _count: { select: { iscilikler: true } } },
  })
  if (!kayit) return { hata: "Bölüm bulunamadı." }
  if (kayit._count.iscilikler > 0) {
    return { hata: "Bu bölüme bağlı işçilikler var. Silmek yerine pasife alabilirsiniz." }
  }

  await prisma.tanim.delete({ where: { id } })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: id,
    aciklama: "İşçilik bölümü silindi: " + kayit.ad,
    eskiDeger: kayit,
  })

  revalidatePath("/iscilik/bolum")
  return {}
}

class KodCakismasi extends Error {
  constructor(kod: string) {
    super(`"${kod}" kodu zaten kullanılıyor.`)
    this.name = "KodCakismasi"
  }
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}
