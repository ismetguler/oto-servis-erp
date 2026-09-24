import type { NextRequest } from "next/server"

import { LOG_ISLEM_ADLARI } from "../sema"
import { logListeKosulu } from "../veri"
import { csvOlustur, csvTarih, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

/**
 * İŞLEM KAYITLARINI EXCEL'E AKTAR
 *
 * Cari listesindeki desenin aynısı (bkz. HAFIZA 57): ekrandaki 100 satırlık
 * sayfa değil, filtreye uyan TÜM kayıtlar iner. Eski/yeni değer JSON
 * olduğu için düz metne çevrilip tek hücreye yazılıyor — Excel'de okunması
 * gereksinimi CSV formatının doğasında sınırlı, ayrıntılı karşılaştırma
 * için ekrandaki satır genişletme kullanılmalı.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("ayar", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    bas: p.get("bas") ?? "",
    bit: p.get("bit") ?? "",
    kullaniciId: p.get("kullaniciId") ?? "",
    tablo: p.get("tablo") ?? "",
    islem: p.get("islem") ?? "",
  }

  const kayitlar = await prisma.islemLog.findMany({
    where: logListeKosulu(filtreler),
    orderBy: { tarih: "desc" },
    select: {
      tarih: true,
      islem: true,
      tablo: true,
      kayitId: true,
      aciklama: true,
      eskiDeger: true,
      yeniDeger: true,
      ip: true,
      tarayici: true,
      kullaniciKod: true,
      kullanici: { select: { ad: true, soyad: true } },
    },
  })

  const icerik = csvOlustur(
    [
      "Tarih",
      "Kullanıcı",
      "İşlem",
      "Tablo",
      "Kayıt No",
      "Açıklama",
      "Eski Değer",
      "Yeni Değer",
      "IP",
      "Tarayıcı",
    ],
    kayitlar.map((k) => [
      csvTarih(k.tarih),
      k.kullanici ? [k.kullanici.ad, k.kullanici.soyad].filter(Boolean).join(" ") : k.kullaniciKod,
      LOG_ISLEM_ADLARI[k.islem],
      k.tablo,
      k.kayitId,
      k.aciklama,
      k.eskiDeger ? JSON.stringify(k.eskiDeger) : "",
      k.yeniDeger ? JSON.stringify(k.yeniDeger) : "",
      k.ip,
      k.tarayici,
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "islem_loglari",
    aciklama: `İşlem kayıtları dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `islem-kayitlari-${bugun}.csv`)
}
