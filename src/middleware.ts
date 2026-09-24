import NextAuth from "next-auth"

import { authConfig } from "@/lib/auth.config"

/**
 * Her istekten once calisir. Oturumu olmayan kullaniciyi /giris'e yollar.
 * Burada sadece cerezdeki JWT okunur; veritabanina gidilmez (hizli olsun diye).
 */
export const { auth: middleware } = NextAuth(authConfig)

export default middleware

export const config = {
  matcher: [
    // _next (derleme ciktilari), statik dosyalar ve favicon disinda her yol
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2)$).*)",
  ],
}
