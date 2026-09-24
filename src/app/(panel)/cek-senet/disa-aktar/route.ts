import type { NextRequest } from "next/server"

import {
  cekSenetleriGetir,
  DURUM_ADI,
  ONAY_ADI,
  TUR_ADI,
  YON_ADI,
  type CekSenetFiltreleri,
} from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * ÇEK / SENET CSV. Ekrandaki filtrenin AYNISINI kullanır.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")

  const p = istek.nextUrl.searchParams
  const f: CekSenetFiltreleri = {
    yon: p.get("yon") ?? "tumu",
    tur: p.get("tur") ?? "tumu",
    durum: p.get("durum") ?? "acik",
    onay: p.get("onay") ?? "tumu",
    vade: p.get("vade") ?? "tumu",
    q: p.get("q") ?? "",
    bas: p.get("bas") ?? undefined,
    bit: p.get("bit") ?? undefined,
    cari: p.get("cari") ?? undefined,
  }

  const kayitlar = await cekSenetleriGetir(f)

  const satirlar = kayitlar.map((k) => [
    k.portfoyNo,
    YON_ADI[k.yon],
    TUR_ADI[k.tur],
    k.cariUnvan,
    k.borclu,
    k.banka,
    k.belgeNo,
    csvTarih(k.vadeTarihi),
    k.kalanGun ?? "",
    DURUM_ADI[k.durum],
    ONAY_ADI[k.onayDurumu],
    csvTutar(k.tutar),
    k.paraBirimi,
  ])

  const icerik = csvOlustur(
    [
      "Portföy No",
      "Yön",
      "Tür",
      "Cari",
      "Keşideci/Borçlu",
      "Banka",
      "Belge No",
      "Vade Tarihi",
      "Kalan Gün",
      "Durum",
      "Onay",
      "Tutar",
      "Para Birimi",
    ],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cek_senetler",
    aciklama: `Çek/senet listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: f,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `cek-senet-${bugun}.csv`)
}
