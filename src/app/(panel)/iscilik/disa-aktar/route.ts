import type { NextRequest } from "next/server"

import { iscilikListeKosulu } from "../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/** İŞÇİLİK KATALOĞUNU EXCEL'E AKTAR — araç/cari modülündeki aynı desen. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("iscilik", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    bolum: p.get("bolum") ?? "",
    durum: p.get("durum") ?? "aktif",
  }

  const kayitlar = await prisma.iscilik.findMany({
    where: iscilikListeKosulu(filtreler),
    orderBy: { ad: "asc" },
    include: {
      bolum: { select: { ad: true } },
      _count: { select: { kabulKalemleri: true } },
    },
  })

  const icerik = csvOlustur(
    [
      "Kod",
      "İşçilik Adı",
      "Bölüm",
      "Süre (saat)",
      "Birim Fiyat",
      "KDV Oranı",
      "KDV Dahil Tutar",
      "Kullanım Adedi",
      "Açıklama",
      "Aktif",
    ],
    kayitlar.map((i) => {
      const matrah = Number(i.sure.toString()) * Number(i.fiyat.toString())
      const dahil = matrah * (1 + Number(i.kdvOrani.toString()) / 100)
      return [
        i.kod,
        i.ad,
        i.bolum?.ad,
        csvTutar(i.sure),
        csvTutar(i.fiyat),
        csvTutar(i.kdvOrani),
        csvTutar(dahil),
        i._count.kabulKalemleri,
        i.aciklama,
        i.aktif ? "EVET" : "HAYIR",
      ]
    })
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "iscilikler",
    aciklama: `İşçilik kataloğu dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `iscilik-katalogu-${bugun}.csv`)
}
