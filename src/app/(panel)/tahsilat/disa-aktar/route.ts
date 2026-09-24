import type { NextRequest } from "next/server"

import {
  ODEME_SEKLI_ADI,
  tahsilatlariGetir,
  TUR_ADI,
  varsayilanAralik,
  type TahsilatFiltreleri,
} from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

/** TAHSİLAT / ÖDEME CSV. Ekrandaki filtrenin AYNISINI kullanır. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")

  const p = istek.nextUrl.searchParams
  const varsayilan = varsayilanAralik()
  const f: TahsilatFiltreleri = {
    tur: p.get("tur") ?? "tumu",
    odeme: p.get("odeme") ?? "tumu",
    kasa: p.get("kasa") ?? "tumu",
    cari: p.get("cari") ?? "",
    bas: p.get("bas") ?? varsayilan.bas,
    bit: p.get("bit") ?? varsayilan.bit,
    q: p.get("q") ?? "",
  }

  const kayitlar = await tahsilatlariGetir(f)

  const satirlar = kayitlar.map((k) => [
    k.fisNo,
    TUR_ADI[k.tur],
    csvTarih(k.tarih),
    k.cariKod,
    k.cariUnvan,
    ODEME_SEKLI_ADI[k.odemeSekli],
    k.kasaAd,
    k.aciklama,
    csvTutar(k.tutar),
    // Net sütunu: ödeme eksi işaretli gelsin ki Excel'de toplam alınabilsin.
    csvTutar(k.tur === "TAHSILAT" ? k.tutar : -k.tutar),
  ])

  const icerik = csvOlustur(
    [
      "Fiş No",
      "Tür",
      "Tarih",
      "Cari Kodu",
      "Cari Unvanı",
      "Ödeme Şekli",
      "Kasa",
      "Açıklama",
      "Tutar",
      "Net Etki",
    ],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tahsilatlar",
    aciklama: `Tahsilat/ödeme listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: f,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `tahsilat-${bugun}.csv`)
}
