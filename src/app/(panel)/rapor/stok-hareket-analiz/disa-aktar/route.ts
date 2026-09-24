import type { NextRequest } from "next/server"

import { varsayilanRaporAraligi } from "../../veri"
import { hareketVerisi, HAREKET_TUR_ADI } from "../../../stok/hareket/veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

/** Rapor kapısının CSV'si — sorgu mantığı `hareketVerisi()`den, kopyalanmadı. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const varsayilan = varsayilanRaporAraligi()
  const bas = p.get("bas") || varsayilan.bas
  const bit = p.get("bit") || varsayilan.bit

  const veri = await hareketVerisi({ stok: "tumu", tur: "tumu", bas, bit })

  const satirlar: (string | number | null | undefined)[][] = veri.satirlar.map((h) => [
    csvTarih(h.tarih),
    h.stokKodu,
    h.stokAdi,
    HAREKET_TUR_ADI[h.tur],
    h.belgeEtiketi,
    h.giris > 0 ? csvTutar(h.giris) : "",
    h.cikis > 0 ? csvTutar(h.cikis) : "",
    h.tutar ? csvTutar(h.tutar) : "",
  ])

  satirlar.push(["", "", "", "DÖNEM TOPLAMI", "", csvTutar(veri.toplamGiris), csvTutar(veri.toplamCikis), ""])

  const icerik = csvOlustur(
    ["Tarih", "Stok Kodu", "Stok Adı", "Tür", "Belge / Açıklama", "Giriş", "Çıkış", "Tutar"],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stok_hareketleri",
    aciklama: `Stok Hareket Analizi raporu dışa aktarıldı (${veri.satirlar.length} satır)`,
    yeniDeger: { bas, bit },
  })

  return csvYaniti(icerik, `stok-hareket-analiz-${bas}-${bit}.csv`)
}
