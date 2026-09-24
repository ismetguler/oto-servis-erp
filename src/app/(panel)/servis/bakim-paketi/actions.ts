"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { paketKalemSemasi, paketSemasi } from "./sema"
import { paketKalemleriGetir } from "./veri"
import { katalogAra } from "../kabul/veri"
import { stokCikisiYaz, toplamlariYenile } from "../kabul/stok-islem"
import { kalemHesapla } from "@/lib/hesap"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * BAKIM PAKETİ — yazma tarafı.
 *
 * Paketin kendisi bir "tanım"; asıl iş paketi kabule uygulamak. Uygulama
 * fiyatı pakette değil KATALOGDA arar ve stok düşümünü `kabul/stok-islem.ts`
 * içindeki ortak fonksiyondan geçirir — kabul kartındaki kalem formu ile
 * aynı yol. İkinci bir stok mantığı yazılsaydı, birinde düzeltilen hata
 * diğerinde kalırdı.
 */

export type PaketFormDurumu = {
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

// ---------------------------------------------------------------------------
//  PAKET BAŞLIĞI
// ---------------------------------------------------------------------------

export async function paketKaydet(
  _oncekiDurum: PaketFormDurumu,
  form: FormData
): Promise<PaketFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = paketSemasi.safeParse({
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
      const kod =
        v.kod ?? (await siradakiNumara(tx, "PAKET_KOD", { varsayilanOnEk: "BP", basamak: 4 }))

      const cakisan = await tx.bakimPaketi.findFirst({
        where: { kod, ...(duzenleme ? { NOT: { id } } : {}) },
        select: { id: true },
      })
      if (cakisan) throw new KodCakismasi(kod)

      const alanlar = {
        kod,
        ad: v.ad,
        aciklama: v.aciklama ?? null,
        aracTuru: v.aracTuru ?? null,
        marka: v.marka ?? null,
        km: v.km === undefined ? null : Math.round(v.km),
        aktif: v.aktif,
      }

      if (duzenleme) {
        const onceki = await tx.bakimPaketi.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()

        const kayit = await tx.bakimPaketi.update({ where: { id }, data: alanlar })
        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "bakim_paketleri",
          kayitId: kayit.id,
          aciklama: kayit.kod + " — " + kayit.ad,
          eskiDeger: onceki,
          yeniDeger: kayit,
        })
        return kayit.id
      }

      const kayit = await tx.bakimPaketi.create({ data: alanlar })
      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "bakim_paketleri",
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
      return { hata: "Paket bulunamadı; silinmiş olabilir." }
    }
    console.error("Bakım paketi kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/servis/bakim-paketi")
  // Yeni pakette hemen satır girilecek; kullanıcıyı paket kartına götürüyoruz.
  redirect(`/servis/bakim-paketi/${kayitId}`)
}

/**
 * Paketi siler veya geri alır. Fiziksel silme YOK: paket geçmişte kabule
 * uygulanmış olabilir ve log kayıtları bu id'ye işaret ediyor.
 */
export async function paketSilmeDurumu(
  id: number,
  silinsin: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const onceki = await prisma.bakimPaketi.findUnique({
    where: { id },
    select: { id: true, kod: true, ad: true, silindi: true },
  })
  if (!onceki) return { hata: "Paket bulunamadı." }

  await prisma.bakimPaketi.update({ where: { id }, data: { silindi: silinsin } })

  await logKaydet({
    islem: silinsin ? "SIL" : "GERI_AL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "bakim_paketleri",
    kayitId: id,
    aciklama: onceki.kod + " — " + onceki.ad,
    eskiDeger: onceki,
  })

  revalidatePath("/servis/bakim-paketi")
  return {}
}

// ---------------------------------------------------------------------------
//  PAKET SATIRLARI
// ---------------------------------------------------------------------------

export type PaketKalemDurumu = { hata?: string; basarili?: string }

export async function paketKalemKaydet(
  _oncekiDurum: PaketKalemDurumu,
  form: FormData
): Promise<PaketKalemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = paketKalemSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Satır bilgileri hatalı." }
  }
  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      const paket = await tx.bakimPaketi.findUnique({
        where: { id: v.paketId },
        select: { id: true, silindi: true },
      })
      if (!paket || paket.silindi) throw new BulunamadiHatasi()

      const alanlar = {
        tur: v.tur,
        aciklama: v.aciklama,
        miktar: v.miktar,
        birim: v.birim,
        fiyatSabit: v.fiyatSabit ?? null,
      }

      if (v.id) {
        const onceki = await tx.bakimPaketiKalem.findUnique({ where: { id: v.id } })
        if (!onceki || onceki.paketId !== v.paketId) throw new BulunamadiHatasi()

        await tx.bakimPaketiKalem.update({
          where: { id: v.id },
          data: {
            ...alanlar,
            stok: v.stokId ? { connect: { id: v.stokId } } : { disconnect: true },
            iscilik: v.iscilikId ? { connect: { id: v.iscilikId } } : { disconnect: true },
          },
        })
      } else {
        const sonSira = await tx.bakimPaketiKalem.aggregate({
          where: { paketId: v.paketId },
          _max: { sira: true },
        })
        await tx.bakimPaketiKalem.create({
          data: {
            ...alanlar,
            sira: (sonSira._max.sira ?? 0) + 1,
            paket: { connect: { id: v.paketId } },
            ...(v.stokId ? { stok: { connect: { id: v.stokId } } } : {}),
            ...(v.iscilikId ? { iscilik: { connect: { id: v.iscilikId } } } : {}),
          },
        })
      }

      await logKaydet({
        islem: v.id ? "GUNCELLE" : "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "bakim_paketi_kalemleri",
        kayitId: v.id ?? 0,
        aciklama: `Paket satırı: ${v.aciklama} (${v.miktar} ${v.birim})`,
        yeniDeger: alanlar,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Paket veya satır bulunamadı." }
    console.error("Paket satırı kaydedilemedi:", hata)
    return { hata: "Satır kaydedilemedi." }
  }

  revalidatePath(`/servis/bakim-paketi/${v.paketId}`)
  return { basarili: v.id ? "Satır güncellendi." : "Satır eklendi." }
}

export async function paketKalemSil(kalemId: number): Promise<PaketKalemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kalem = await prisma.bakimPaketiKalem.findUnique({ where: { id: kalemId } })
  if (!kalem) return { hata: "Satır bulunamadı." }

  // Paket satırı sadece bir şablon; stok/kabul bağı olmadığı için fiziksel
  // silinebilir (kabul kalemlerinden farkı bu).
  await prisma.bakimPaketiKalem.delete({ where: { id: kalemId } })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "bakim_paketi_kalemleri",
    kayitId: kalemId,
    aciklama: "Paket satırı silindi: " + kalem.aciklama,
    eskiDeger: kalem,
  })

  revalidatePath(`/servis/bakim-paketi/${kalem.paketId}`)
  return { basarili: "Satır silindi." }
}

/** Paket satır formundaki katalog araması — kabul kartıyla aynı kaynak. */
export async function paketKatalogAra(tur: "PARCA" | "ISCILIK", q: string) {
  await yetkiliOturum("kabul", "gor")
  return katalogAra(tur, q)
}

// ---------------------------------------------------------------------------
//  PAKETİ KABULE UYGULAMA
// ---------------------------------------------------------------------------

export type PaketOnizlemeSatiri = {
  aciklama: string
  tur: "PARCA" | "ISCILIK" | "DIS_HIZMET"
  miktar: number
  birim: string
  birimFiyat: number
  kdvOrani: number
  toplam: number
  uyari: string | null
}

export type PaketOnizleme = {
  hata?: string
  paketAdi?: string
  satirlar?: PaketOnizlemeSatiri[]
  genelToplam?: number
}

/**
 * Paketin BU karta uygulandığında ne yazacağını hesaplar — kayıt yapmaz.
 * Uygulamadan önce göstermek şart: fiyat katalogdan geldiği için kullanıcı
 * neyi onayladığını görmeden satır eklememeli.
 */
export async function paketOnizle(kabulId: number, paketId: number): Promise<PaketOnizleme> {
  try {
    await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const hazirlik = await uygulamaVerisi(kabulId, paketId)
  if ("hata" in hazirlik) return { hata: hazirlik.hata }

  const satirlar = hazirlik.satirlar.map((s) => ({
    aciklama: s.aciklama,
    tur: s.tur,
    miktar: s.miktar,
    birim: s.birim,
    birimFiyat: s.birimFiyat,
    kdvOrani: s.kdvOrani,
    toplam: s.hesap.toplam,
    uyari: s.uyari,
  }))

  return {
    paketAdi: hazirlik.paketAdi,
    satirlar,
    genelToplam: satirlar.reduce((t, s) => t + s.toplam, 0),
  }
}

/** Paketin tüm satırlarını tek transaction'da karta ekler. */
export async function paketiUygula(
  kabulId: number,
  paketId: number
): Promise<{ hata?: string; basarili?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const hazirlik = await uygulamaVerisi(kabulId, paketId)
  if ("hata" in hazirlik) return { hata: hazirlik.hata }

  try {
    await prisma.$transaction(async (tx) => {
      const sonSira = await tx.kabulKalem.aggregate({
        where: { kabulId },
        _max: { sira: true },
      })
      let sira = sonSira._max.sira ?? 0

      for (const s of hazirlik.satirlar) {
        sira += 1
        const kalem = await tx.kabulKalem.create({
          data: {
            kabul: { connect: { id: kabulId } },
            sira,
            tur: s.tur,
            aciklama: s.aciklama,
            birim: s.birim,
            miktar: s.miktar,
            birimFiyat: s.birimFiyat,
            kdvOrani: s.kdvOrani,
            tutar: s.hesap.tutar,
            kdvTutar: s.hesap.kdvTutar,
            toplam: s.hesap.toplam,
            ...(s.stokId ? { stok: { connect: { id: s.stokId } } } : {}),
            ...(s.iscilikId ? { iscilik: { connect: { id: s.iscilikId } } } : {}),
          },
        })

        if (s.tur === "PARCA" && s.stokId) {
          await stokCikisiYaz(tx, {
            kalemId: kalem.id,
            kabulId,
            stokId: s.stokId,
            miktar: s.miktar,
            birimFiyat: s.birimFiyat,
            tutar: s.hesap.tutar,
            kullaniciId: kullanici.id,
            aciklama: `Bakım paketi: ${hazirlik.paketKodu}`,
          })
        }
      }

      await toplamlariYenile(tx, kabulId)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kabul_kalemleri",
        kayitId: kabulId,
        aciklama: `Bakım paketi uygulandı: ${hazirlik.paketKodu} — ${hazirlik.paketAdi} (${hazirlik.satirlar.length} satır)`,
        yeniDeger: { paketId, satirSayisi: hazirlik.satirlar.length },
      })
    })
  } catch (hata) {
    console.error("Bakım paketi uygulanamadı:", hata)
    return { hata: "Paket uygulanamadı." }
  }

  revalidatePath(`/servis/kabul/${kabulId}`)
  return { basarili: `${hazirlik.satirlar.length} satır eklendi.` }
}

/**
 * Önizleme ile uygulamanın ortak hazırlığı: kart + paket okunur, her satırın
 * fiyatı/KDV'si hesaplanır. Tek fonksiyon olması şart — kullanıcı
 * önizlemede gördüğünden başka bir tutarın kaydedilmesi kabul edilemez.
 */
async function uygulamaVerisi(kabulId: number, paketId: number) {
  const [kabul, paket] = await Promise.all([
    prisma.kabul.findUnique({
      where: { id: kabulId },
      select: {
        id: true,
        durum: true,
        silindi: true,
        kdvDahilGirilir: true,
      },
    }),
    prisma.bakimPaketi.findUnique({
      where: { id: paketId },
      select: { id: true, kod: true, ad: true, silindi: true, aktif: true },
    }),
  ])

  if (!kabul || kabul.silindi) return { hata: "Kabul kartı bulunamadı." as const }
  if (kabul.durum === "TESLIM_EDILDI") {
    return { hata: "Teslim edilmiş karta paket uygulanamaz." as const }
  }
  if (!paket || paket.silindi) return { hata: "Bakım paketi bulunamadı." as const }
  if (!paket.aktif) return { hata: "Bu paket pasif durumda." as const }

  const kalemler = await paketKalemleriGetir(paketId)
  if (kalemler.length === 0) return { hata: "Bu pakette hiç satır yok." as const }

  const satirlar = kalemler.map((k) => {
    const girdi = {
      miktar: k.miktar,
      birimFiyat: k.gecerliFiyat,
      kdvOrani: k.kdvOrani,
    }

    return {
      ...girdi,
      tur: k.tur,
      aciklama: k.aciklama,
      birim: k.birim,
      stokId: k.stokId,
      iscilikId: k.iscilikId,
      uyari: k.uyari,
      hesap: kalemHesapla(girdi, kabul.kdvDahilGirilir),
    }
  })

  return { paketKodu: paket.kod, paketAdi: paket.ad, satirlar }
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
