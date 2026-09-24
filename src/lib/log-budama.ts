import "server-only"

import { Prisma } from "@/generated/prisma/client"
import type { LogIslem } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

/**
 * LOG BUDAMA — `islem_loglari` otomatik temizlik (GUNCELLEMELER madde 8 / SA-6)
 *
 * Neden gerekli: `lib/log.ts` her ekle/güncelle/sil işleminde kaydın eski + yeni
 * hâlini JSON olarak `islem_loglari`'na yazıyor. Zamanla Neon Free'nin 0.5 GB
 * kotasını dolduracak TEK tablo bu — iş/muhasebe verisi değil.
 *
 * SADECE `islem_loglari` budanır. `StokHareket` LOG DEĞİL (stok bakiyesi ondan
 * hesaplanır) — ona ve tüm iş verisine DOKUNULMAZ.
 *
 * Sıra: önce 6 aydan eski satırların JSON'u boşaltılır (satır KALIR, "kim ne
 * zaman ne yaptı" izi kalır, yerin büyük kısmı boşalır) → sonra tip bazlı
 * saklama sürelerine göre satır silinir.
 *
 * Saklama süreleri ileride Ayar'dan değişebilsin diye TEK objede (`SAKLAMA`).
 * Şimdilik kodda sabit; DB'ye taşımak ayrı iş.
 */
export const SAKLAMA = {
  /** Bu aydan eski TÜM tiplerde `eskiDeger`/`yeniDeger` → null (satır kalır). */
  jsonBosaltAy: 6,
  /** Gürültü tipleri: bu aydan sonra satır tamamen silinir. */
  kisa: {
    ay: 3,
    tipler: ["GIRIS", "CIKIS", "YAZDIR", "DISA_AKTAR"] as LogIslem[],
  },
  /** "Bu fiyatı kim değiştirdi" tipleri: bir yıl geriye yeter. */
  orta: {
    ay: 12,
    tipler: ["EKLE", "GUNCELLE"] as LogIslem[],
  },
  /** Kritik iz: ASLA silinmez (kayıp kayıt / şüpheli giriş). */
  suresiz: ["SIL", "GERI_AL", "GIRIS_BASARISIZ"] as LogIslem[],
} as const

/** N ay öncesinin tarihi (bugünden geriye). */
function ayOnce(ay: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - ay)
  return d
}

export type LogBudamaSonucu = {
  jsonBosaltilan: number
  silinen: { kisa: number; orta: number; toplam: number }
  sure: number
}

/**
 * Budamayı çalıştırır. Gerçek eski kayıt yoksa her sayaç 0 döner, hata vermez.
 * Bu fonksiyon KENDİ işlemini loglamaz — çağıran route `logKaydet` ile loglar
 * (böylece "otomatik budama" log satırı `/ayar/log` üstündeki bilgi satırını
 * besleyebiliyor, yeni tablo/alan açmadan).
 */
export async function logBudamaCalistir(): Promise<LogBudamaSonucu> {
  const basla = Date.now()

  // 1) JSON boşaltma — 6 aydan eski, JSON'u hâlâ dolu satırlar
  const bosalt = await prisma.islemLog.updateMany({
    where: {
      tarih: { lt: ayOnce(SAKLAMA.jsonBosaltAy) },
      OR: [
        { eskiDeger: { not: Prisma.AnyNull } },
        { yeniDeger: { not: Prisma.AnyNull } },
      ],
    },
    data: { eskiDeger: Prisma.DbNull, yeniDeger: Prisma.DbNull },
  })

  // 2) Tip bazlı silme — önce gürültü (3 ay), sonra ekle/güncelle (12 ay).
  //    SAKLAMA.suresiz tipleri bilinçli olarak HİÇ silinmez.
  const kisaSil = await prisma.islemLog.deleteMany({
    where: {
      islem: { in: SAKLAMA.kisa.tipler },
      tarih: { lt: ayOnce(SAKLAMA.kisa.ay) },
    },
  })
  const ortaSil = await prisma.islemLog.deleteMany({
    where: {
      islem: { in: SAKLAMA.orta.tipler },
      tarih: { lt: ayOnce(SAKLAMA.orta.ay) },
    },
  })

  return {
    jsonBosaltilan: bosalt.count,
    silinen: {
      kisa: kisaSil.count,
      orta: ortaSil.count,
      toplam: kisaSil.count + ortaSil.count,
    },
    sure: Date.now() - basla,
  }
}
