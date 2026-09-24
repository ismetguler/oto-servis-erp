import type { NextRequest } from "next/server"

import { iscilikToplamlariVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("rapor", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await iscilikToplamlariVerisi(filtreler)

  const icerik = csvOlustur(
    ["Bölüm", "İş Sayısı", "Süre (saat)", "Tutar"],
    satirlar.map((s) => [s.bolumAdi, s.islemSayisi, csvTutar(s.sure), csvTutar(s.tutar)])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabul_kalemleri",
    aciklama: `İşçilik Toplamları raporu dışa aktarıldı (${satirlar.length} bölüm)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `iscilik-toplamlari-${bugun}.csv`)
}
