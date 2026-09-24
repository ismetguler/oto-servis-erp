import type { NextRequest } from "next/server"

import { alisEvraklariGetir } from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

const TUR_ADI: Record<string, string> = {
  ALIS: "Alış Faturası",
  IADE_ALIS: "İade Faturası",
}
const DURUM_ADI: Record<string, string> = {
  TASLAK: "Taslak",
  KESILDI: "Kesildi",
  IPTAL: "İptal",
}

/** ALIŞ EVRAKLARI CSV. Ekrandaki filtrenin (ara / durum / tarih) AYNISINI kullanır. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("evrak", "gor")

  const p = istek.nextUrl.searchParams
  const f = {
    q: p.get("q") ?? "",
    durum: p.get("durum") ?? "",
    bas: p.get("bas") ?? "",
    bit: p.get("bit") ?? "",
  }

  const evraklar = await alisEvraklariGetir(f)

  const satirlar = evraklar.map((e) => [
    e.evrakNo,
    TUR_ADI[e.tur] ?? e.tur,
    csvTarih(e.tarih),
    e.cari.kod,
    e.cari.unvan,
    csvTutar(e.genelToplam),
    DURUM_ADI[e.durum] ?? e.durum,
  ])

  const icerik = csvOlustur(
    ["Fatura No", "Tür", "Tarih", "Cari Kodu", "Cari Unvanı", "Genel Toplam", "Durum"],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "evraklar",
    aciklama: `Alış evrakları listesi dışa aktarıldı (${evraklar.length} kayıt)`,
    yeniDeger: f,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `alis-evraklari-${bugun}.csv`)
}
