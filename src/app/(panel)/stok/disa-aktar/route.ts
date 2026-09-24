import type { NextRequest } from "next/server"

import { stokListeKosulu } from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * STOK LİSTESİNİ EXCEL'E AKTAR
 *
 * Ekrandaki 50 satırlık sayfa değil, filtreye uyan TÜM kayıtlar iner
 * (Cari/İşçilik dışa aktarmalarındaki desenin aynısı).
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    depo: p.get("depo") ?? "",
    grup: p.get("grup") ?? "",
    durum: p.get("durum") ?? "aktif",
  }

  const kayitlar = await prisma.stok.findMany({
    where: stokListeKosulu(filtreler),
    orderBy: { ad: "asc" },
    include: { depo: { select: { ad: true } } },
  })

  const icerik = csvOlustur(
    [
      "Kod",
      "Ürün Adı",
      "Barkod",
      "Tipi",
      "Marka / Üretici",
      "Üretici Kodu",
      "Orijinal (OEM) Kodu",
      "Muadil Kodları",
      "Ürün Grubu",
      "Birim",
      "Depo",
      "Raf / Konum",
      "Mevcut Miktar",
      "Min. Seviye",
      "Maks. Seviye",
      "Alış Fiyatı",
      "Satış Fiyatı",
      "Ortalama Maliyet",
      "KDV %",
      "Aktif",
      "Kayıt Tarihi",
    ],
    kayitlar.map((s) => [
      s.kod,
      s.ad,
      s.barkod,
      s.tipi,
      s.uretici,
      s.ureticiKodu,
      s.orijinalKodu,
      s.muadilNo,
      s.urunGrubu,
      s.birim,
      s.depo?.ad,
      s.rafYeri,
      csvTutar(s.mevcutMiktar),
      csvTutar(s.minSeviye),
      csvTutar(s.maxSeviye),
      csvTutar(s.alisFiyat),
      csvTutar(s.satisFiyat),
      csvTutar(s.ortalamaMaliyet),
      csvTutar(s.kdvOrani),
      s.aktif ? "EVET" : "HAYIR",
      csvTarih(s.olusturmaTarihi),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Stok listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `stok-listesi-${bugun}.csv`)
}
