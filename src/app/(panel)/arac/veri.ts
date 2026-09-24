import "server-only"

import type { AracBaslangic } from "@/components/arac/arac-formu"
import type { Prisma } from "@/generated/prisma/client"
import type { TanimTur } from "@/generated/prisma/enums"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * Araç kaydını forma uygun hâle getirip döndürür.
 * Tarihler `<input type="date">` bekleyen "YYYY-MM-DD" metnine çevrilir —
 * çevrimi form tarafında yapmak sayı/tarih hatası riskini ekrana taşırdı.
 */
export async function aracFormVerisi(id: number): Promise<AracBaslangic | null> {
  const a = await prisma.arac.findUnique({ where: { id } })
  if (!a || a.silindi) return null

  const gun = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

  return {
    id: a.id,
    plaka: a.plaka,
    saseNo: a.saseNo,
    cariId: a.cariId,
    aracTuru: a.aracTuru,
    marka: a.marka,
    model: a.model,
    modelYili: a.modelYili,
    renk: a.renk,
    yakitTuru: a.yakitTuru,
    vitesTuru: a.vitesTuru,
    kasaTipi: a.kasaTipi,
    motorHacmi: a.motorHacmi,
    sonKm: a.sonKm,
    projesi: a.projesi,
    aracVersiyon: a.aracVersiyon,
    ruhsatTarihi: gun(a.ruhsatTarihi),
    ruhsatSeriNo: a.ruhsatSeriNo,
    ruhsatQr: a.ruhsatQr,
    trafikSigBaslama: gun(a.trafikSigBaslama),
    trafikSigBitis: gun(a.trafikSigBitis),
    kaskoBaslama: gun(a.kaskoBaslama),
    kaskoBitis: gun(a.kaskoBitis),
    garantiBaslangic: gun(a.garantiBaslangic),
    garantiBitis: gun(a.garantiBitis),
    muayeneBitis: gun(a.muayeneBitis),
    akuBaslama: gun(a.akuBaslama),
    akuBitis: gun(a.akuBitis),
    akuMarka: a.akuMarka,
    lpgTankSonTarih: gun(a.lpgTankSonTarih),
    lpgTankMarka: a.lpgTankMarka,
    sonrakiBakimTarih: gun(a.sonrakiBakimTarih),
    sonrakiBakimKm: a.sonrakiBakimKm,
    trigerDegisimKm: a.trigerDegisimKm,
    trigerDegisimTarih: gun(a.trigerDegisimTarih),
    aracIdSi: a.aracIdSi,
    moKodu: a.moKodu,
    poKodu: a.poKodu,
    notlar: a.notlar,
    aktif: a.aktif,
  }
}

/** Marka / renk / yakıt / vites / kasa tipi / araç türü — tek yerden. */
function tanimListesi(tur: TanimTur) {
  return prisma.tanim.findMany({
    where: { tur, aktif: true },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { id: true, ad: true },
  })
}

export function aracDropdownlariGetir() {
  return Promise.all([
    tanimListesi("ARAC_MARKA"),
    tanimListesi("ARAC_RENK"),
    tanimListesi("YAKIT_TURU"),
    tanimListesi("VITES_TURU"),
    tanimListesi("KASA_TIPI"),
    tanimListesi("ARAC_TURU"),
  ]).then(([markalar, renkler, yakitTurleri, vitesTurleri, kasaTipleri, aracTurleri]) => ({
    markalar,
    renkler,
    yakitTurleri,
    vitesTurleri,
    kasaTipleri,
    aracTurleri,
  }))
}

/** Araç sahibi seçilirken kullanılan cari listesi (müşteri + tedarikçi + diğer). */
export function sahipCarileriGetir() {
  return prisma.cari.findMany({
    where: { silindi: false, turu: { not: "PERSONEL" } },
    orderBy: { unvan: "asc" },
    select: { id: true, kod: true, unvan: true },
  })
}

export type AracFiltreleri = {
  q?: string
  marka?: string
  durum?: string
}

/**
 * Liste filtresini tek yerde kuruyoruz — ekran, sayaç ve CSV aynı koşulu
 * kullanır; ayrı yazılsaydı ekrandaki liste ile inen Excel er geç ayrışırdı.
 */
export function aracListeKosulu({
  q = "",
  marka = "",
  durum = "aktif",
}: AracFiltreleri): Prisma.AracWhereInput {
  const arama = q.trim()

  return {
    silindi: durum === "silinen",
    ...(durum === "aktif" ? { aktif: true } : {}),
    ...(durum === "pasif" ? { aktif: false } : {}),
    // Marka filtresi büyük/küçük harf duyarsız: katalogdan "Opel" diye
    // kaydedilen araç, Tanım tablosundan gelen "OPEL" seçeneğiyle de bulunsun
    // (eskiden tam eşleşme aranıyordu, "Opel" ≠ "OPEL" → araç kayboluyordu).
    ...(marka ? { marka: { equals: marka, mode: "insensitive" as const } } : {}),
    // "Garanti / sigorta süresi dolmuş" — hatırlatma raporunun listeye gömülü hâli.
    ...(durum === "sigortasi-bitmis"
      ? { OR: [{ trafikSigBitis: { lt: new Date() } }, { kaskoBitis: { lt: new Date() } }] }
      : {}),
    ...(durum === "muayenesi-gelen" ? { muayeneBitis: { lt: new Date() } } : {}),
    ...(durum === "garantisi-bitmis" ? { garantiBitis: { lt: new Date() } } : {}),
    ...(arama
      ? {
          OR: [
            { plaka: { contains: arama.replace(/\s+/g, ""), mode: "insensitive" as const } },
            ...aramaKosullari<Prisma.AracWhereInput>(
              ["saseNo", "marka", "model", "cari.unvan"],
              arama
            ),
          ],
        }
      : {}),
  }
}

export function aracFiltreSorgusu(f: AracFiltreleri): string {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.marka) p.set("marka", f.marka)
  if (f.durum && f.durum !== "aktif") p.set("durum", f.durum)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}
