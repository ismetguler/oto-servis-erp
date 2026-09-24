import type { Rol } from "@/generated/prisma/enums"
import type { DefaultSession } from "next-auth"

/**
 * Auth.js'in hazır tiplerini kendi alanlarımızla genişletiyoruz.
 * Böylece `session.user.rol` yazınca TypeScript ne olduğunu biliyor.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      kod: string
      ad: string
      rol: Rol
    } & DefaultSession["user"]
  }

  interface User {
    kod: string
    ad: string
    rol: Rol
  }
}

/**
 * JWT tipi `next-auth/jwt` uzerinden yeniden disa aktarilan
 * `@auth/core/jwt` modulunde tanimli; genisletme oraya yapilmali.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    kullaniciId?: number
    kod?: string
    ad?: string
    rol?: Rol
  }
}

export {}
