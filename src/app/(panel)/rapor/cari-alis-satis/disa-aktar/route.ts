import type { NextRequest } from "next/server"

import { cariAlisSatisVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await cariAlisSatisVerisi(filtreler)

  const icerik = csvOlustur(
    ["Kod", "Ünvan", "VKN", "Alış Fatura", "Alış Toplam", "Satış Fatura", "Satış Toplam", "Fark"],
    satirlar.map((s) => [
      s.kod,
      s.unvan,
      s.vkn ?? "",
      s.alisFaturaSayisi,
      csvTutar(s.alisToplam),
      s.satisFaturaSayisi,
      csvTutar(s.satisToplam),
      csvTutar(s.fark),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "evraklar",
    aciklama: `Cari Alış-Satış raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `cari-alis-satis-${bugun}.csv`)
}
