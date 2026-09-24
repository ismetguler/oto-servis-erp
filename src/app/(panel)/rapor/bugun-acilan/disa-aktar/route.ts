import type { NextRequest } from "next/server"

import { bugunAcilanCarilerVerisi } from "../../veri"
import { CARI_TUR_ADLARI } from "../../../cari/sema"
import { csvOlustur, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }
  const turu = p.get("turu") ?? ""

  const satirlar = await bugunAcilanCarilerVerisi(filtreler, turu)

  const icerik = csvOlustur(
    ["Kod", "Ünvan", "Tür", "Telefon", "VKN", "Oluşturan", "Oluşturma Tarihi"],
    satirlar.map((s) => [
      s.kod,
      s.unvan,
      CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu,
      s.telefon ?? "",
      s.vergiNo ?? "",
      s.olusturanAdi,
      s.olusturmaTarihi.toLocaleString("tr-TR"),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    aciklama: `Bugün Açılan Cariler raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `bugun-acilan-cariler-${bugun}.csv`)
}
