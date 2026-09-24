import type { NextRequest } from "next/server"

import { bugunEklenenStokVerisi } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { tarihSaat } from "@/lib/bicim"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { bas: p.get("bas") ?? "", bit: p.get("bit") ?? "" }
  const depoId = p.get("depo") ?? ""
  const urunGrubu = p.get("grup") ?? ""

  const satirlar = await bugunEklenenStokVerisi(filtreler, depoId, urunGrubu)

  const icerik = csvOlustur(
    ["Kod", "Ürün Adı", "Grup", "Depo", "Mevcut Miktar", "Satış Fiyatı", "Ekleyen", "Eklenme Tarihi"],
    satirlar.map((s) => [
      s.kod,
      s.ad,
      s.urunGrubu,
      s.depoAdi,
      csvTutar(s.mevcutMiktar),
      csvTutar(s.satisFiyat),
      s.olusturanAdi,
      tarihSaat(s.olusturmaTarihi),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Bugün Eklenenler raporu dışa aktarıldı (${satirlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `bugun-eklenen-stok-${bugun}.csv`)
}
