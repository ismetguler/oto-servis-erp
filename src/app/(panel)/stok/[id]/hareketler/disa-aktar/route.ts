import type { NextRequest } from "next/server"

import { belgeEtiketiCoz, belgeNoHaritalari, donemBasiBakiye } from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { gunSonu } from "@/lib/bicim"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

const HAREKET_ADI: Record<string, string> = {
  GIRIS: "Giriş",
  CIKIS: "Çıkış",
  DEVIR: "Devir",
  SAYIM: "Sayım Farkı",
  TRANSFER: "Transfer",
}

/** Çıkış hareketleri miktarı düşürür, diğerleri arttırır (ekrandaki sayfayla aynı işaret kuralı). */
function isaretliMiktar(tur: string, miktar: number) {
  return tur === "CIKIS" ? -miktar : miktar
}

/** csvTutar gibi Türkçe yazım ama kuruş yok — miktar 3 ondalığa kadar tutulabiliyor. */
function csvMiktar(deger: number): string {
  return deger.toLocaleString("tr-TR", { maximumFractionDigits: 3 })
}

/**
 * Stok hareket dökümünü Excel'e aktarır. Ekrandaki tabloyla birebir aynı
 * olmalı: devir satırı ve yürüyen "kalan" burada da var (Cari ekstresindeki
 * dışa aktarma deseninin aynısı).
 */
export async function GET(
  istek: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const { id } = await params
  const stokId = Number(id)
  if (!Number.isInteger(stokId)) return new Response("Geçersiz kayıt", { status: 400 })

  const p = istek.nextUrl.searchParams
  const bas = p.get("bas") ?? `${new Date().getFullYear()}-01-01`
  const bit = p.get("bit") ?? new Date().toISOString().slice(0, 10)
  const baslangic = new Date(`${bas}T00:00:00`)
  const bitis = gunSonu(new Date(`${bit}T00:00:00`))

  const stok = await prisma.stok.findUnique({
    where: { id: stokId },
    select: { kod: true, ad: true, mevcutMiktar: true },
  })
  if (!stok) return new Response("Stok bulunamadı", { status: 404 })

  const [devir, hareketler] = await Promise.all([
    // Ekrandaki dökümle aynı "Devir" mantığı (bkz. ../veri.ts — Z5-B).
    donemBasiBakiye(stokId, baslangic, Number(stok.mevcutMiktar.toString())),
    prisma.stokHareket.findMany({
      where: { stokId, tarih: { gte: baslangic, lte: bitis } },
      orderBy: [{ tarih: "asc" }, { id: "asc" }],
    }),
  ])

  // StokHareket'te Kullanici'ya Prisma ilişkisi yok, ad-soyad ayrı sorguyla eşleniyor.
  const kullaniciIdler = [...new Set(hareketler.map((h) => h.kullaniciId).filter((v): v is number => v != null))]
  const kullanicilar = kullaniciIdler.length
    ? await prisma.kullanici.findMany({
        where: { id: { in: kullaniciIdler } },
        select: { id: true, ad: true, soyad: true },
      })
    : []
  const kullaniciAdiMap = new Map(kullanicilar.map((k) => [k.id, `${k.ad} ${k.soyad ?? ""}`.trim()]))

  const { kabulNolari, evrakNolari } = await belgeNoHaritalari(hareketler)

  let kalan = devir
  const satirlar: string[][] = [
    [
      csvTarih(baslangic),
      "Devir",
      "Önceki dönemden devreden miktar",
      "",
      devir > 0 ? csvMiktar(devir) : "",
      devir < 0 ? csvMiktar(Math.abs(devir)) : "",
      "",
      csvMiktar(devir),
    ],
  ]

  for (const h of hareketler) {
    const im = isaretliMiktar(h.tur, Number(h.miktar.toString()))
    kalan += im
    const belge = belgeEtiketiCoz(h, kabulNolari, evrakNolari)
    satirlar.push([
      csvTarih(h.tarih),
      HAREKET_ADI[h.tur] ?? h.tur,
      belge,
      h.kullaniciId ? (kullaniciAdiMap.get(h.kullaniciId) ?? "") : "",
      im > 0 ? csvMiktar(im) : "",
      im < 0 ? csvMiktar(Math.abs(im)) : "",
      Number(h.tutar.toString()) ? csvTutar(Number(h.tutar.toString())) : "",
      csvMiktar(kalan),
    ])
  }

  const icerik = csvOlustur(
    ["Tarih", "Tür", "Belge", "Kullanıcı", "Giriş", "Çıkış", "Tutar", "Kalan"],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stok_hareketleri",
    kayitId: stokId,
    aciklama: `${stok.kod} hareket dökümü dışa aktarıldı (${bas} — ${bit})`,
  })

  return csvYaniti(icerik, `stok-hareket-${stok.kod}-${bas}_${bit}.csv`)
}
