import type { NextAuthConfig } from "next-auth"

/**
 * Auth.js'in KENAR (edge) ortamında da çalışabilen kısmı.
 *
 * middleware.ts bu dosyayı kullanır. Bu yüzden burada Prisma, bcrypt gibi
 * Node.js'e özel paketler İTHAL EDİLMEZ — yoksa middleware derlenmez.
 * Şifre doğrulama gibi ağır işler `auth.ts` içindedir.
 */

/** Giriş yapılmadan erişilebilen yollar. */
const ACIK_YOLLAR = ["/giris"]

export const authConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 saat — bir mesai günü
    updateAge: 30 * 60,
  },
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  providers: [], // gerçek sağlayıcı auth.ts içinde eklenir
  callbacks: {
    /** Token'a kullanıcı bilgilerini yaz. */
    jwt({ token, user }) {
      if (user) {
        token.kullaniciId = Number(user.id)
        token.kod = user.kod
        token.ad = user.ad
        token.rol = user.rol
      }
      return token
    },
    /** İstemciye açılan oturum nesnesi. */
    session({ session, token }) {
      if (token.kullaniciId && token.kod && token.ad && token.rol) {
        session.user.id = String(token.kullaniciId)
        session.user.kod = token.kod
        session.user.ad = token.ad
        session.user.rol = token.rol
      }
      return session
    },
    /** middleware bunu kullanır: giriş yoksa /giris'e yönlendirir. */
    authorized({ auth, request }) {
      const girisYapildi = Boolean(auth?.user)
      const yol = request.nextUrl.pathname

      // Bakım uçları (ör. /api/bakim/log-budama) oturumla DEĞİL, kendi
      // içlerinde CRON_SECRET ile korunur — Vercel Cron oturumsuz çağırır.
      if (yol.startsWith("/api/bakim/")) return true

      const acikSayfa = ACIK_YOLLAR.some((p) => yol.startsWith(p))

      if (acikSayfa) {
        // Girişliyken giriş sayfasına gelirse ana sayfaya at.
        if (girisYapildi) {
          return Response.redirect(new URL("/", request.nextUrl))
        }
        return true
      }
      return girisYapildi
    },
  },
} satisfies NextAuthConfig
