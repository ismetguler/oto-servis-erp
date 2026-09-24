import "server-only"

import nodemailer from "nodemailer"

import { MARKA } from "@/config/marka"

/**
 * MAIL GÖNDERİMİ — tek nokta (SA-6 haftalık log maili)
 *
 * Ücretsiz yol: Gmail SMTP + uygulama şifresi (App Password). Gönderen hesap
 * işletmenin/geliştiricinin kontrolündeki bir Gmail; alıcı `Firma.email`.
 * Müşteri hiçbir yere giriş yapmaz, yalnızca maili alır.
 *
 * `GMAIL_KULLANICI` / `GMAIL_APP_SIFRE` tanımlı değilse mail SESSİZCE atlanır
 * (`{ gonderildi:false, sebep }` döner) — sistem asla bloklanmaz, çağıran
 * route yine 200 döner ve durumu loglar.
 */
type MailEk = { dosyaAdi: string; icerik: string; tur?: string }

export type MailSonucu =
  | { gonderildi: true; mesajId: string }
  | { gonderildi: false; sebep: string }

export async function mailGonder(opts: {
  kime: string
  konu: string
  metin: string
  html?: string
  ekler?: MailEk[]
}): Promise<MailSonucu> {
  const kullanici = process.env.GMAIL_KULLANICI
  const sifre = process.env.GMAIL_APP_SIFRE

  if (!kullanici || !sifre) {
    return { gonderildi: false, sebep: "GMAIL_KULLANICI / GMAIL_APP_SIFRE tanımlı değil" }
  }
  if (!opts.kime?.trim()) {
    return { gonderildi: false, sebep: "alıcı adresi boş (Ayarlar > Firma Bilgileri > e-posta girilmemiş)" }
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: kullanici, pass: sifre },
  })

  try {
    const bilgi = await transporter.sendMail({
      from: `"${MARKA.ad} Sistem" <${kullanici}>`,
      to: opts.kime,
      subject: opts.konu,
      text: opts.metin,
      html: opts.html,
      attachments: opts.ekler?.map((e) => ({
        filename: e.dosyaAdi,
        content: e.icerik,
        contentType: e.tur ?? "text/csv; charset=utf-8",
      })),
    })
    return { gonderildi: true, mesajId: bilgi.messageId }
  } catch (e) {
    return { gonderildi: false, sebep: e instanceof Error ? e.message : String(e) }
  }
}
