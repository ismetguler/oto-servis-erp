import type { NextRequest } from "next/server"

import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { gunSonu } from "@/lib/bicim"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

const HAREKET_ADI: Record<string, string> = {
  ACILIS: "Açılış",
  EVRAK: "Fatura",
  KABUL: "Servis",
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
  MAHSUP: "Mahsup",
}

/**
 * Cari ekstresini Excel'e aktarır. Ekrandaki tabloyla birebir aynı olmalı:
 * devir satırı, yürüyen bakiye ve dönem toplamı burada da var — muhasebeci
 * indirdiği dosyayı ekranla karşılaştırıp fark görürse hiçbirine güvenmez.
 */
export async function GET(
  istek: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const { id } = await params
  const cariId = Number(id)
  if (!Number.isInteger(cariId)) return new Response("Geçersiz kayıt", { status: 400 })

  const p = istek.nextUrl.searchParams
  const bas = p.get("bas") ?? `${new Date().getFullYear()}-01-01`
  const bit = p.get("bit") ?? new Date().toISOString().slice(0, 10)
  const baslangic = new Date(`${bas}T00:00:00`)
  const bitis = gunSonu(new Date(`${bit}T00:00:00`))

  const cari = await prisma.cari.findUnique({
    where: { id: cariId },
    select: { kod: true, unvan: true },
  })
  if (!cari) return new Response("Cari bulunamadı", { status: 404 })

  const [devirToplam, hareketler] = await Promise.all([
    prisma.cariHareket.aggregate({
      where: { cariId, silindi: false, tarih: { lt: baslangic } },
      _sum: { borc: true, alacak: true },
    }),
    prisma.cariHareket.findMany({
      where: { cariId, silindi: false, tarih: { gte: baslangic, lte: bitis } },
      orderBy: [{ tarih: "asc" }, { id: "asc" }],
    }),
  ])

  // Ekrandaki ekstre ile aynı gün-bazlı sıralama (bkz. ekstre/page.tsx):
  // aynı gün içinde "Açılış" en üstte, tahsilat/ödeme fişi onu doğuran
  // satırın önüne geçmesin.
  const gunAnahtari = (d: Date) => new Date(d).toISOString().slice(0, 10)
  hareketler.sort((a, b) => {
    const gunFark = gunAnahtari(a.tarih).localeCompare(gunAnahtari(b.tarih))
    if (gunFark !== 0) return gunFark
    if (a.tur === "ACILIS" && b.tur !== "ACILIS") return -1
    if (b.tur === "ACILIS" && a.tur !== "ACILIS") return 1
    const saatFark = a.tarih.getTime() - b.tarih.getTime()
    if (saatFark !== 0) return saatFark
    return a.id - b.id
  })

  const devir =
    Number(devirToplam._sum.borc?.toString() ?? 0) -
    Number(devirToplam._sum.alacak?.toString() ?? 0)

  let yuruyen = devir
  const satirlar: (string | number)[][] = [
    [
      csvTarih(baslangic),
      "Devir",
      "Önceki dönemden devreden bakiye",
      "",
      devir > 0 ? csvTutar(devir) : "",
      devir < 0 ? csvTutar(Math.abs(devir)) : "",
      csvTutar(Math.abs(devir)),
      devir > 0 ? "B" : devir < 0 ? "A" : "",
    ],
  ]

  for (const h of hareketler) {
    const borc = Number(h.borc.toString())
    const alacak = Number(h.alacak.toString())
    yuruyen += borc - alacak
    satirlar.push([
      csvTarih(h.tarih),
      HAREKET_ADI[h.tur] ?? h.tur,
      h.aciklama ?? "",
      csvTarih(h.vadeTarihi),
      borc ? csvTutar(borc) : "",
      alacak ? csvTutar(alacak) : "",
      csvTutar(Math.abs(yuruyen)),
      yuruyen > 0 ? "B" : yuruyen < 0 ? "A" : "",
    ])
  }

  const icerik = csvOlustur(
    ["Tarih", "Tür", "Açıklama", "Vade", "Borç", "Alacak", "Bakiye", "B/A"],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    kayitId: cariId,
    aciklama: `${cari.kod} ekstresi dışa aktarıldı (${bas} — ${bit})`,
  })

  return csvYaniti(icerik, `ekstre-${cari.kod}-${bas}_${bit}.csv`)
}
