import "server-only"

import type { FiyatAlani } from "./sema"
import { prisma } from "@/lib/prisma"

export type TopluFiyatSatiri = {
  id: number
  kod: string
  ad: string
  eskiFiyat: number
  yeniFiyat: number
}

/**
 * Yeni fiyatı hesaplar. Yüzde zamda/indirimde eski fiyat üzerinden oran,
 * sabit tutarda direkt ekleme/çıkarma. İndirim sonucu negatife düşerse 0'a
 * sabitlenir — eksi fiyat anlamsız.
 */
export function yeniFiyatHesapla(
  eskiFiyat: number,
  tip: "YUZDE" | "TUTAR",
  yon: "ZAM" | "INDIRIM",
  deger: number
): number {
  const fark = tip === "YUZDE" ? eskiFiyat * (deger / 100) : deger
  const yeni = yon === "ZAM" ? eskiFiyat + fark : eskiFiyat - fark
  return Math.round(Math.max(0, yeni) * 10000) / 10000
}

/**
 * Seçili id'lerin, seçili fiyat alanındaki eski/yeni değerlerini döndürür.
 * Önizleme ve uygulama AYNI fonksiyondan besleniyor — kullanıcının
 * önizlemede gördüğünden başka bir tutar kaydedilmesin diye (bakım
 * paketindeki `uygulamaVerisi` deseninin aynısı).
 */
export async function topluFiyatOnizlemesi(
  idler: number[],
  alan: FiyatAlani,
  tip: "YUZDE" | "TUTAR",
  yon: "ZAM" | "INDIRIM",
  deger: number
): Promise<TopluFiyatSatiri[]> {
  if (idler.length === 0) return []

  const kayitlar = await prisma.stok.findMany({
    where: { id: { in: idler }, silindi: false },
    select: {
      id: true,
      kod: true,
      ad: true,
      satisFiyat: true,
      alisFiyat: true,
    },
    orderBy: { ad: "asc" },
  })

  return kayitlar.map((k) => {
    const eskiFiyat = Number(k[alan].toString())
    return {
      id: k.id,
      kod: k.kod,
      ad: k.ad,
      eskiFiyat,
      yeniFiyat: yeniFiyatHesapla(eskiFiyat, tip, yon, deger),
    }
  })
}
