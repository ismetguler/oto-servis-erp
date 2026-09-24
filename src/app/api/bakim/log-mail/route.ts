import { NextResponse } from "next/server"

import { Prisma } from "@/generated/prisma/client"
import { logKaydet } from "@/lib/log"
import { logBudamaCalistir, SAKLAMA } from "@/lib/log-budama"
import { logOzetiUret, ozetMetni } from "@/lib/log-ozet"
import { mailGonder } from "@/lib/mail"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * HAFTALIK LOG MAİLİ (SA-6) — korumalı bakım ucu
 *
 * Vercel Cron her Pazartesi GET ile çağırır (`vercel.json` > `crons`). Auth
 * `log-budama` ile aynı: `Authorization: Bearer ${CRON_SECRET}` yoksa 401.
 *
 * Akış: son 7 günün özeti + CSV eki `Firma.email`'e gönderilir → SADECE
 * gönderim başarılıysa o aralık, Madde 8 saklama politikasıyla tutarlı
 * biçimde temizlenir (GIRIS/CIKIS/YAZDIR/DISA_AKTAR sil · EKLE/GUNCELLE JSON
 * boşalt · SIL/GERI_AL/GIRIS_BASARISIZ dokunma — bunlar zaten CSV ekinde
 * arşivlendi). Mail kurulu değilse hiçbir şey silinmez, durum loglanır.
 */
function haftaAraligi() {
  const bit = new Date()
  const bas = new Date(bit)
  bas.setDate(bas.getDate() - 7)
  return { bas, bit }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 401 })
  }

  const { bas, bit } = haftaAraligi()

  const firma = await prisma.firma.findUnique({ where: { id: 1 }, select: { email: true } })
  const alici = firma?.email?.trim() ?? ""

  const ozet = await logOzetiUret(bas, bit)

  const mail = await mailGonder({
    kime: alici,
    konu: `İşlem kaydı haftalık özet — ${ozet.toplam} işlem`,
    metin: ozetMetni(ozet),
    ekler: [{ dosyaAdi: `islem-kaydi-${bas.toISOString().slice(0, 10)}.csv`, icerik: ozet.csv }],
  })

  // Temizlik yalnızca mail GİDERSE yapılır (aksi hâlde o hafta hiç arşivlenmeden
  // silinmiş olurdu). İki katman:
  //   1) haftaTemizligi — mailin kapsadığı son 7 gün: gürültü tipleri sil,
  //      EKLE/GUNCELLE JSON boşalt (CSV ekinde arşivli).
  //   2) logBudamaCalistir — tam saklama politikası (3ay/12ay silme + 6ay JSON
  //      boşaltma). Ayrı aylık cron kaldırıldı; bu iş artık her hafta burada.
  let haftaTemizligi: { silinen: number; jsonBosaltilan: number } | null = null
  let politika: Awaited<ReturnType<typeof logBudamaCalistir>> | null = null
  if (mail.gonderildi) {
    const bosalt = await prisma.islemLog.updateMany({
      where: {
        tarih: { gte: bas, lte: bit },
        islem: { in: SAKLAMA.orta.tipler },
        OR: [
          { eskiDeger: { not: Prisma.AnyNull } },
          { yeniDeger: { not: Prisma.AnyNull } },
        ],
      },
      data: { eskiDeger: Prisma.DbNull, yeniDeger: Prisma.DbNull },
    })
    const sil = await prisma.islemLog.deleteMany({
      where: { tarih: { gte: bas, lte: bit }, islem: { in: SAKLAMA.kisa.tipler } },
    })
    haftaTemizligi = { silinen: sil.count, jsonBosaltilan: bosalt.count }

    politika = await logBudamaCalistir()
  }

  await logKaydet({
    islem: "DISA_AKTAR",
    tablo: "islem_loglari",
    aciklama: mail.gonderildi
      ? `haftalık log maili gönderildi (${alici}) · ${ozet.toplam} işlem · ` +
        `hafta: silinen ${haftaTemizligi?.silinen ?? 0} / JSON ${haftaTemizligi?.jsonBosaltilan ?? 0} · ` +
        `politika: silinen ${politika?.silinen.toplam ?? 0} / JSON ${politika?.jsonBosaltilan ?? 0}`
      : `haftalık log maili GÖNDERİLEMEDİ (${mail.sebep}) · temizlik yapılmadı`,
  })

  return NextResponse.json({
    tamam: mail.gonderildi,
    alici,
    toplamIslem: ozet.toplam,
    mail,
    haftaTemizligi,
    politika,
  })
}
