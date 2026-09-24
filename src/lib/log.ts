import "server-only"

import { headers } from "next/headers"

import type { LogIslem } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

/**
 * İŞLEM LOGU — "kim, ne zaman, ne yaptı"
 *
 * Selim Abi'nin "kusursuz ve güvenilir olsun" isteğinin karşılığı.
 * Kayıt ekleyen/değiştiren/silen her işlem buradan geçer; eski ve yeni değer
 * JSON olarak saklanır, böylece "bu fiyatı kim değiştirmiş" sorusu cevaplanabilir.
 *
 * Log yazımı asıl işlemi ASLA bloklamaz: hata olursa sessizce geçilir.
 */

type LogVerisi = {
  islem: LogIslem
  kullaniciId?: number | null
  kullaniciKod?: string | null
  tablo?: string
  kayitId?: number
  aciklama?: string
  eskiDeger?: unknown
  yeniDeger?: unknown
}

export async function logKaydet(veri: LogVerisi): Promise<void> {
  try {
    const baslik = await headers()
    const iletilen = baslik.get("x-forwarded-for")
    const ip = iletilen ? iletilen.split(",")[0].trim() : baslik.get("x-real-ip")

    await prisma.islemLog.create({
      data: {
        islem: veri.islem,
        kullaniciId: veri.kullaniciId ?? undefined,
        kullaniciKod: veri.kullaniciKod ?? undefined,
        tablo: veri.tablo,
        kayitId: veri.kayitId,
        aciklama: veri.aciklama,
        eskiDeger: temizle(veri.eskiDeger),
        yeniDeger: temizle(veri.yeniDeger),
        ip: ip ?? undefined,
        tarayici: baslik.get("user-agent") ?? undefined,
      },
    })
  } catch {
    // loglama başarısız olursa kullanıcının işlemi yine de tamamlanır
  }
}

/** Şifre gibi hassas alanlar loga ASLA yazılmaz; Decimal/Date düz metne çevrilir. */
function temizle(deger: unknown) {
  if (deger === undefined || deger === null) return undefined
  const gizli = ["sifre", "sifreHash", "sifreTekrar", "token", "secret"]
  return JSON.parse(
    JSON.stringify(deger, (anahtar, deger) => {
      if (gizli.includes(anahtar)) return "***"
      if (typeof deger === "bigint") return deger.toString()
      return deger
    })
  )
}
