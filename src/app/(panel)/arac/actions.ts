"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { aracSemasi } from "./sema"
import { donusYolu } from "@/lib/donus"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type AracFormDurumu = {
  hata?: string
  alanHatalari?: Record<string, string>
  /** Plaka çakıştıysa çakışan mevcut aracın id'si — "kartı aç →" linki için. */
  cakisanAracId?: number
}

/**
 * Araç kaydet (yeni kayıt veya güncelleme).
 *
 * Cari modülüyle aynı desen: tek fonksiyon, gizli `id` alanının varlığı
 * ekleme/güncellemeyi ayırır. Araçta cari'deki gibi otomatik kod üretimi
 * yok — Selpar'da da olduğu gibi tekil anahtar doğrudan **plaka**.
 */
export async function aracKaydet(
  _oncekiDurum: AracFormDurumu,
  form: FormData
): Promise<AracFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("arac", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = aracSemasi.safeParse({
    ...Object.fromEntries(form),
    aktif: form.get("aktif") === "on",
  })

  if (!cozum.success) {
    const alanHatalari: Record<string, string> = {}
    for (const sorun of cozum.error.issues) {
      const alan = String(sorun.path[0] ?? "")
      if (alan && !alanHatalari[alan]) alanHatalari[alan] = sorun.message
    }
    return { hata: "Formda eksik veya hatalı alanlar var.", alanHatalari }
  }

  const v = cozum.data
  const tarihe = (d?: string) => (d ? new Date(d) : null)

  const alanlar = {
    plaka: v.plaka,
    saseNo: v.saseNo ?? null,
    aracTuru: v.aracTuru ?? null,
    marka: v.marka ?? null,
    model: v.model ?? null,
    modelYili: v.modelYili ?? null,
    renk: v.renk ?? null,
    yakitTuru: v.yakitTuru ?? null,
    vitesTuru: v.vitesTuru ?? null,
    kasaTipi: v.kasaTipi ?? null,
    motorHacmi: v.motorHacmi ?? null,
    sonKm: v.sonKm ?? null,
    projesi: v.projesi ?? null,
    aracVersiyon: v.aracVersiyon ?? null,
    ruhsatTarihi: tarihe(v.ruhsatTarihi),
    ruhsatSeriNo: v.ruhsatSeriNo ?? null,
    ruhsatQr: v.ruhsatQr ?? null,
    trafikSigBaslama: tarihe(v.trafikSigBaslama),
    trafikSigBitis: tarihe(v.trafikSigBitis),
    kaskoBaslama: tarihe(v.kaskoBaslama),
    kaskoBitis: tarihe(v.kaskoBitis),
    garantiBaslangic: tarihe(v.garantiBaslangic),
    garantiBitis: tarihe(v.garantiBitis),
    muayeneBitis: tarihe(v.muayeneBitis),
    akuBaslama: tarihe(v.akuBaslama),
    akuBitis: tarihe(v.akuBitis),
    akuMarka: v.akuMarka ?? null,
    lpgTankSonTarih: tarihe(v.lpgTankSonTarih),
    lpgTankMarka: v.lpgTankMarka ?? null,
    sonrakiBakimTarih: tarihe(v.sonrakiBakimTarih),
    sonrakiBakimKm: v.sonrakiBakimKm ?? null,
    trigerDegisimKm: v.trigerDegisimKm ?? null,
    trigerDegisimTarih: tarihe(v.trigerDegisimTarih),
    aracIdSi: v.aracIdSi ?? null,
    moKodu: v.moKodu ?? null,
    poKodu: v.poKodu ?? null,
    notlar: v.notlar ?? null,
    aktif: v.aktif,
  }

  let kayitId: number

  try {
    if (duzenleme) {
      const cakisan = await prisma.arac.findFirst({
        where: { plaka: v.plaka, NOT: { id } },
        select: { id: true },
      })
      if (cakisan) throw new PlakaCakismasi(v.plaka, cakisan.id)

      const onceki = await prisma.arac.findUnique({ where: { id } })
      if (!onceki || onceki.silindi) throw new BulunamadiHatasi()

      const arac = await prisma.arac.update({
        where: { id },
        data: {
          ...alanlar,
          // Prisma 7'de scalar FK (`cariId`) create/update input'unda doğrudan
          // yazılamıyor — ilişki nesnesi (`cari: { connect / disconnect }`) gerekiyor.
          cari: v.cariId ? { connect: { id: v.cariId } } : { disconnect: true },
          guncelleyenId: kullanici.id,
        },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "araclar",
        kayitId: arac.id,
        aciklama: `${arac.plaka} — ${arac.marka ?? ""} ${arac.model ?? ""}`.trim(),
        eskiDeger: onceki,
        yeniDeger: arac,
      })
      kayitId = arac.id
    } else {
      const cakisan = await prisma.arac.findFirst({
        where: { plaka: v.plaka },
        select: { id: true },
      })
      if (cakisan) throw new PlakaCakismasi(v.plaka, cakisan.id)

      const arac = await prisma.arac.create({
        data: {
          ...alanlar,
          ...(v.cariId ? { cari: { connect: { id: v.cariId } } } : {}),
          olusturanId: kullanici.id,
        },
      })

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "araclar",
        kayitId: arac.id,
        aciklama: `${arac.plaka} — ${arac.marka ?? ""} ${arac.model ?? ""}`.trim(),
        yeniDeger: arac,
      })
      kayitId = arac.id
    }
  } catch (hata) {
    if (hata instanceof PlakaCakismasi) {
      return {
        hata: hata.message,
        alanHatalari: { plaka: "Bu plaka başka bir araca kayıtlı." },
        cakisanAracId: hata.aracId,
      }
    }
    if (hata instanceof BulunamadiHatasi) {
      return { hata: "Araç kaydı bulunamadı; silinmiş olabilir." }
    }
    console.error("Araç kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/arac")
  revalidatePath(`/arac/${kayitId}`)
  if (v.cariId) revalidatePath(`/cari/${v.cariId}`)
  // Kabul ekranından "+ Yeni Araç" ile gelindiyse araç kartına değil kabule
  // dön; yeni plaka orada seçili gelsin (bkz. lib/donus.ts).
  redirect(donusYolu(form.get("donus"), "arac", kayitId) ?? `/arac/${kayitId}?kaydedildi=1`)
}

/**
 * Aracı siler veya geri alır. Fiziksel silme YOK: `silindi` işaretlenir.
 * Kabul geçmişi olan bir araç fiziksel silinseydi geçmiş iş emirleri
 * yetim kalırdı.
 */
export async function aracSilmeDurumu(
  id: number,
  silinsin: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("arac", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const onceki = await prisma.arac.findUnique({
    where: { id },
    select: {
      id: true,
      plaka: true,
      marka: true,
      model: true,
      cariId: true,
      silindi: true,
      _count: { select: { kabuller: true } },
    },
  })
  if (!onceki) return { hata: "Araç bulunamadı." }

  // Açık iş emri olan araç silinemez: kabul kartı sahipsiz kalırdı.
  if (silinsin && onceki._count.kabuller > 0) {
    const acikVarMi = await prisma.kabul.count({
      where: { aracId: id, silindi: false, durum: { notIn: ["TESLIM_EDILDI", "IPTAL"] } },
    })
    if (acikVarMi > 0) {
      return { hata: "Bu aracın açık/devam eden bir iş emri var, önce onu kapatın." }
    }
  }

  await prisma.arac.update({
    where: { id },
    data: {
      silindi: silinsin,
      silmeTarihi: silinsin ? new Date() : null,
      guncelleyenId: kullanici.id,
    },
  })

  await logKaydet({
    islem: silinsin ? "SIL" : "GERI_AL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "araclar",
    kayitId: id,
    aciklama: `${onceki.plaka} — ${onceki.marka ?? ""} ${onceki.model ?? ""}`.trim(),
    eskiDeger: onceki,
  })

  revalidatePath("/arac")
  revalidatePath(`/arac/${id}`)
  if (onceki.cariId) revalidatePath(`/cari/${onceki.cariId}`)
  return {}
}

class PlakaCakismasi extends Error {
  /** Çakışan mevcut aracın id'si — form "kartı aç →" linki için kullanır. */
  aracId: number
  constructor(plaka: string, aracId: number) {
    super(`"${plaka}" plakası zaten kullanılıyor.`)
    this.name = "PlakaCakismasi"
    this.aracId = aracId
  }
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}
