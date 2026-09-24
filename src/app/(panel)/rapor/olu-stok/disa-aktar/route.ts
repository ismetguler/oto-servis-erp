import type { NextRequest } from "next/server"

import { oluStokVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { tarih } from "@/lib/bicim"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }

  const { satirlar } = await oluStokVerisi(filtreler)

  const icerik = csvOlustur(
    ["Kod", "Ürün Adı", "Grup", "Depo", "Mevcut Miktar", "Bağlı Değer", "Son Hareket", "Gün Farkı"],
    satirlar.map((s) => [
      s.kod,
      s.ad,
      s.urunGrubu,
      s.depoAdi,
      csvTutar(s.mevcutMiktar),
      csvTutar(s.baglananDeger),
      s.sonHareketTarihi ? tarih(s.sonHareketTarihi) : "Hiç hareket yok",
      s.gunFarki !== null ? String(s.gunFarki) : "",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Ölü Stok raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `olu-stok-${bugun}.csv`)
}
