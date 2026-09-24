import type { NextRequest } from "next/server"

import { CARI_TUR_ADLARI } from "../../sema"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { gunSonu } from "@/lib/bicim"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/** Mizan tablosunu ekrandakiyle aynı kurallarla Excel'e aktarır. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const bugun = new Date()
  const bas = p.get("bas") ?? `${bugun.getFullYear()}-01-01`
  const bit = p.get("bit") ?? bugun.toISOString().slice(0, 10)
  const tur = p.get("tur") ?? ""
  const sifirGoster = p.get("sifir") === "1"

  const baslangic = new Date(`${bas}T00:00:00`)
  const bitis = gunSonu(new Date(`${bit}T00:00:00`))

  const [cariler, devirler, donemler] = await Promise.all([
    prisma.cari.findMany({
      where: { silindi: false, ...(tur ? { turu: tur as "MUSTERI" } : {}) },
      orderBy: { unvan: "asc" },
      select: { id: true, kod: true, unvan: true, turu: true },
    }),
    prisma.cariHareket.groupBy({
      by: ["cariId"],
      where: { silindi: false, tarih: { lt: baslangic } },
      _sum: { borc: true, alacak: true },
    }),
    prisma.cariHareket.groupBy({
      by: ["cariId"],
      where: { silindi: false, tarih: { gte: baslangic, lte: bitis } },
      _sum: { borc: true, alacak: true },
    }),
  ])

  const devirHaritasi = new Map(
    devirler.map((d) => [
      d.cariId,
      Number(d._sum.borc?.toString() ?? 0) - Number(d._sum.alacak?.toString() ?? 0),
    ])
  )
  const donemHaritasi = new Map(
    donemler.map((d) => [
      d.cariId,
      {
        borc: Number(d._sum.borc?.toString() ?? 0),
        alacak: Number(d._sum.alacak?.toString() ?? 0),
      },
    ])
  )

  const satirlar = cariler
    .map((c) => {
      const devir = devirHaritasi.get(c.id) ?? 0
      const donem = donemHaritasi.get(c.id) ?? { borc: 0, alacak: 0 }
      return { ...c, devir, ...donem, bakiye: devir + donem.borc - donem.alacak }
    })
    .filter((r) => sifirGoster || r.devir !== 0 || r.borc !== 0 || r.alacak !== 0)

  const icerik = csvOlustur(
    ["Kod", "Ünvan", "Tür", "Devir", "Dönem Borç", "Dönem Alacak", "Bakiye", "B/A"],
    satirlar.map((r) => [
      r.kod,
      r.unvan,
      CARI_TUR_ADLARI[r.turu],
      csvTutar(Math.abs(r.devir)),
      csvTutar(r.borc),
      csvTutar(r.alacak),
      csvTutar(Math.abs(r.bakiye)),
      r.bakiye > 0 ? "B" : r.bakiye < 0 ? "A" : "",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    aciklama: `Cari mizan dışa aktarıldı (${bas} — ${bit}, ${satirlar.length} cari)`,
  })

  return csvYaniti(icerik, `cari-mizan-${bas}_${bit}.csv`)
}
