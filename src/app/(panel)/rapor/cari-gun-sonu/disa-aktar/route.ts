import type { NextRequest } from "next/server"

import { cariGunSonuVerisi } from "../../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const satirlar = await cariGunSonuVerisi(filtreler)

  const icerik = csvOlustur(
    ["Tarih", "Fatura", "Servis", "Tahsilat", "Ödeme", "Diğer", "Gün Net", "Yürüyen Bakiye"],
    satirlar.map((s) => [
      csvTarih(s.gun),
      csvTutar(s.faturaToplam),
      csvTutar(s.servisToplam),
      csvTutar(s.tahsilat),
      csvTutar(s.odeme),
      csvTutar(s.digerNet),
      csvTutar(s.gunNet),
      csvTutar(s.kumulatifBakiye),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    aciklama: `Cari Gün Sonu raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `cari-gun-sonu-${bugun}.csv`)
}
