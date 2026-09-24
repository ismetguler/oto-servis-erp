"use server"

import { redirect } from "next/navigation"
import { AuthError, CredentialsSignin } from "next-auth"

import { GIRIS_HATA_MESAJLARI, signIn } from "@/lib/auth"

export type GirisDurumu = {
  hata?: string
}

/**
 * Giriş formunun sunucu tarafı.
 * Şifre buraya gelir, doğrulanır ve BİR DAHA hiçbir yere yazılmaz
 * (loglara da düz hâliyle düşmez, bkz. lib/log.ts).
 */
export async function girisYap(
  _oncekiDurum: GirisDurumu,
  form: FormData
): Promise<GirisDurumu> {
  const kod = String(form.get("kod") ?? "").trim()
  const sifre = String(form.get("sifre") ?? "")

  if (!kod || !sifre) {
    return { hata: GIRIS_HATA_MESAJLARI.eksik }
  }

  try {
    await signIn("credentials", { kod, sifre, redirect: false })
  } catch (hata) {
    if (hata instanceof CredentialsSignin) {
      return { hata: GIRIS_HATA_MESAJLARI[hata.code] ?? GIRIS_HATA_MESAJLARI.gecersiz }
    }
    if (hata instanceof AuthError) {
      return { hata: GIRIS_HATA_MESAJLARI.gecersiz }
    }
    // Beklenmeyen hata (ör. veritabanına ulaşılamıyor) — yutulmasın.
    console.error("Giriş sırasında beklenmeyen hata:", hata)
    return {
      hata: "Sisteme şu anda ulaşılamıyor. Lütfen birazdan tekrar deneyin.",
    }
  }

  redirect("/")
}
