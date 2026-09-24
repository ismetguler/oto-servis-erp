import type { NextRequest } from "next/server"

import { vknMukerrerVerisi } from "../../veri"
import { CARI_TUR_ADLARI } from "../../../cari/sema"
import { csvOlustur, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const gruplar = await vknMukerrerVerisi(filtreler)
  const satirlar = gruplar.flatMap((g) => g.kayitlar.map((k) => ({ vkn: g.vergiNo, ...k })))

  const icerik = csvOlustur(
    ["VKN", "Kod", "Ünvan", "Tür", "Telefon", "Açılış Tarihi", "Aralık İçinde"],
    satirlar.map((s) => [
      s.vkn,
      s.kod,
      s.unvan,
      CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu,
      s.telefon ?? "",
      s.olusturmaTarihi.toLocaleString("tr-TR"),
      s.aralikIcinde ? "Evet" : "Hayır",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    aciklama: `VKN Aynı Olanlar raporu dışa aktarıldı (${satirlar.length} kayıt, ${gruplar.length} VKN)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `vkn-mukerrer-${bugun}.csv`)
}
