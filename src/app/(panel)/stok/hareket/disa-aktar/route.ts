import type { NextRequest } from "next/server"

import { hareketVerisi, HAREKET_TUR_ADI, varsayilanAralik, type StokHareketFiltreleri } from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * STOK HAREKETLERİ CSV (tüm kartlar). Ekrandaki filtrenin aynısını kullanır.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const v = varsayilanAralik()
  const f: StokHareketFiltreleri = {
    stok: p.get("stok") ?? "tumu",
    q: p.get("q") ?? "",
    tur: p.get("tur") ?? "tumu",
    bas: p.get("bas") || v.bas,
    bit: p.get("bit") || v.bit,
  }

  const veri = await hareketVerisi(f)

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

  satirlar.push([
    "",
    "",
    "",
    "DÖNEM TOPLAMI",
    "",
    csvTutar(veri.toplamGiris),
    csvTutar(veri.toplamCikis),
    "",
  ])

  const icerik = csvOlustur(
    ["Tarih", "Stok Kodu", "Stok Adı", "Tür", "Belge / Açıklama", "Giriş", "Çıkış", "Tutar"],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stok_hareketleri",
    aciklama: `Stok hareket dökümü dışa aktarıldı (${veri.satirlar.length} satır)`,
    yeniDeger: f,
  })

  return csvYaniti(icerik, `stok-hareketleri-${f.bas}-${f.bit}.csv`)
}
