import "server-only"

import { plakaSadelestir } from "@/lib/plaka"
import { prisma } from "@/lib/prisma"

/** Bir carinin filo sözleşmeleri — cari kartındaki panel için. */
export async function cariFiloSozlesmeleriGetir(cariId: number) {
  const kayitlar = await prisma.filoSozlesmesi.findMany({
    where: { cariId, silindi: false },
    orderBy: [{ aktif: "desc" }, { bitis: "desc" }],
    select: {
      id: true,
      ad: true,
      baslangic: true,
      bitis: true,
      vadeGun: true,
      kapsamPlakalari: true,
      aktif: true,
      notu: true,
    },
  })
  return kayitlar
}

/**
 * Bugün geçerli TÜM aktif filo sözleşmeleri — kabul formuna öneri bandı
 * için. Genelde bir avuç kayıt; client tarafında seçilen cari/plakaya göre
 * eşleştirilir (bkz. kabul-formu.tsx). `aktifFiloSozlesmesiBul` ile aynı
 * "geçerli" tanımı (aktif, silinmemiş, tarih aralığında).
 */
export async function tumAktifFiloSozlesmeleriGetir() {
  const bugun = new Date()
  const kayitlar = await prisma.filoSozlesmesi.findMany({
    where: {
      silindi: false,
      aktif: true,
      baslangic: { lte: bugun },
      bitis: { gte: bugun },
    },
    select: {
      id: true,
      cariId: true,
      ad: true,
      vadeGun: true,
      kapsamPlakalari: true,
    },
  })
  return kayitlar
}

export type AktifFiloSozlesmesi = Awaited<
  ReturnType<typeof tumAktifFiloSozlesmeleriGetir>
>[number]

export async function filoSozlesmesiGetir(id: number) {
  const s = await prisma.filoSozlesmesi.findFirst({
    where: { id, silindi: false },
  })
  if (!s) return null
  return s
}

/**
 * SA-3.3 — kabul açılırken öneri için: bir carinin BUGÜN geçerli (aktif,
 * silinmemiş, başlangıç ≤ bugün ≤ bitiş) filo sözleşmesi. Plaka verilirse,
 * `kapsamPlakalari` boş olan (tüm araçlar) VEYA o plakayı içeren sözleşmeler
 * eşleşir; plakaya özel sözleşme, "tüm araçlar" sözleşmesine tercih edilir.
 */
export async function aktifFiloSozlesmesiBul(cariId: number, plaka?: string | null) {
  const bugun = new Date()
  const adaylar = await prisma.filoSozlesmesi.findMany({
    where: {
      cariId,
      silindi: false,
      aktif: true,
      baslangic: { lte: bugun },
      bitis: { gte: bugun },
    },
    orderBy: { bitis: "desc" },
    select: {
      id: true,
      ad: true,
      vadeGun: true,
      bitis: true,
      kapsamPlakalari: true,
    },
  })
  if (adaylar.length === 0) return null

  const hedef = plaka ? plakaSadelestir(plaka).toLocaleUpperCase("tr-TR") : ""
  const kapsarMi = (liste: string | null) => {
    const ham = (liste ?? "").trim()
    if (ham === "") return { eslesir: true, plakayaOzel: false }
    if (!hedef) return { eslesir: false, plakayaOzel: true }
    const plakalar = ham
      .split(/[\s,;\n]+/)
      .map((p) => plakaSadelestir(p).toLocaleUpperCase("tr-TR"))
      .filter(Boolean)
    return { eslesir: plakalar.includes(hedef), plakayaOzel: true }
  }

  // Önce plakaya özel eşleşme, yoksa "tüm araçlar" sözleşmesi.
  let genel: (typeof adaylar)[number] | null = null
  for (const a of adaylar) {
    const { eslesir, plakayaOzel } = kapsarMi(a.kapsamPlakalari)
    if (!eslesir) continue
    if (plakayaOzel) return a
    if (!genel) genel = a
  }
  return genel
}
