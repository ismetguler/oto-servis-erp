import type { NextRequest } from "next/server"

import { defterVerisi, HAREKET_TUR_ADI, varsayilanAralik, type DefterFiltreleri } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * KASA DEFTERİ CSV.
 * Ekrandaki filtrenin AYNISINI kullanır — muhasebeci ekranda gördüğü rakamın
 * dosyada da aynı çıkacağına güvenebilsin diye devreden satırı da yazılıyor.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")

  const p = istek.nextUrl.searchParams
  const v = varsayilanAralik()
  const f: DefterFiltreleri = {
    kasa: p.get("kasa") ?? "tumu",
    q: p.get("q") ?? "",
    tur: p.get("tur") ?? "tumu",
    bas: p.get("bas") || v.bas,
    bit: p.get("bit") || v.bit,
  }

  const defter = await defterVerisi(f)

  const satirlar: (string | number | null | undefined)[][] = [
    ["", "", "", "DEVREDEN BAKİYE", "", "", "", "", csvTutar(defter.devreden)],
  ]

  for (const s of defter.satirlar) {
    satirlar.push([
      csvTarih(s.tarih),
      s.kasaAdi,
      HAREKET_TUR_ADI[s.tur],
      s.aciklama,
      s.masrafTuru,
      s.cariUnvan,
      s.belgeNo,
      s.giris > 0 ? csvTutar(s.giris) : "",
      s.cikis > 0 ? csvTutar(s.cikis) : "",
      defter.tekKasa ? csvTutar(s.yuruyenBakiye) : "",
    ])
  }

  satirlar.push([
    "",
    "",
    "",
    "DÖNEM TOPLAMI",
    "",
    "",
    "",
    csvTutar(defter.girisToplam),
    csvTutar(defter.cikisToplam),
    csvTutar(defter.kapanis),
  ])

  const icerik = csvOlustur(
    [
      "Tarih",
      "Kasa",
      "Tür",
      "Açıklama",
      "Masraf Türü",
      "Cari",
      "Belge No",
      "Giriş",
      "Çıkış",
      "Yürüyen Bakiye",
    ],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kasa_hareketleri",
    aciklama: `Kasa defteri dışa aktarıldı (${defter.satirlar.length} satır)`,
    yeniDeger: f,
  })

  return csvYaniti(icerik, `kasa-defteri-${f.bas}-${f.bit}.csv`)
}
