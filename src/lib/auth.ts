import bcrypt from "bcryptjs"
import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

import { authConfig } from "@/lib/auth.config"
import { prisma } from "@/lib/prisma"

/**
 * Kullanıcı bulunamadığında da bcrypt karşılaştırması yapılır ki cevap süresi
 * aynı olsun. Aksi hâlde saldırgan süreye bakarak hangi kodun var olduğunu anlar.
 */
const SAHTE_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO1Xb0PtJZLsOJz0Jf4qkvcYnzr6nJj4."

const girisSemasi = z.object({
  kod: z.string().trim().min(1, "Kullanıcı adı zorunlu").max(60),
  sifre: z.string().min(1, "Şifre zorunlu").max(200),
})

/** Auth.js'e hata kodunu taşıyan özel hata sınıfı. */
class GirisHatasi extends CredentialsSignin {
  constructor(public code: string) {
    super(code)
  }
}

/** Hata kodlarının kullanıcıya gösterilecek Türkçe karşılıkları. */
export const GIRIS_HATA_MESAJLARI: Record<string, string> = {
  gecersiz: "Kullanıcı adı veya şifre hatalı.",
  pasif: "Bu kullanıcı pasif durumda. Yöneticinize başvurun.",
  eksik: "Kullanıcı adı ve şifre giriniz.",
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "kod-sifre",
      credentials: {
        kod: { label: "Kullanıcı Adı", type: "text" },
        sifre: { label: "Şifre", type: "password" },
      },
      async authorize(bilgiler, istek) {
        const sonuc = girisSemasi.safeParse(bilgiler)
        if (!sonuc.success) throw new GirisHatasi("eksik")

        const { kod, sifre } = sonuc.data
        const ip = istekIpsi(istek)
        const tarayici = istek?.headers?.get("user-agent") ?? null

        // Kod büyük/küçük harf DUYARSIZ: kullanıcı "Admin" ya da "ADMIN"
        // yazsa da "admin" hesabıyla giriş yapabilsin (kod yalnız harf/rakam/
        // ._- içerir, Türkçe karakter yok → düz insensitive yeter).
        const kullanici = await prisma.kullanici.findFirst({
          where: { kod: { equals: kod, mode: "insensitive" } },
        })

        // Kullanıcı yoksa bile karşılaştırma yapılır (zaman sızıntısını önler).
        const hash = kullanici?.sifreHash ?? SAHTE_HASH
        const sifreDogru = await bcrypt.compare(sifre, hash)

        if (!kullanici || kullanici.silindi) {
          await logYaz({ islem: "GIRIS_BASARISIZ", kullaniciKod: kod, ip, tarayici, aciklama: "Kullanıcı bulunamadı" })
          throw new GirisHatasi("gecersiz")
        }

        if (!kullanici.aktif) {
          await logYaz({ islem: "GIRIS_BASARISIZ", kullaniciId: kullanici.id, kullaniciKod: kod, ip, tarayici, aciklama: "Pasif kullanıcı" })
          throw new GirisHatasi("pasif")
        }

        // NOT: Hesap kilitleme (art arda hatalı denemede 15 dk kilit) İsmet'in
        // isteğiyle kaldırıldı — yaşlı esnak sık sık şifreyi yanlış girip
        // kilitleniyordu. Hatalı denemeler yine "Kim Ne Yaptı" loguna yazılır;
        // `Kullanici.hataliGirisSayisi` / `kilitBitis` alanları şemada kalıyor
        // ama artık kullanılmıyor (migration yok).
        if (!sifreDogru) {
          await logYaz({
            islem: "GIRIS_BASARISIZ",
            kullaniciId: kullanici.id,
            kullaniciKod: kod,
            ip,
            tarayici,
            aciklama: "Hatalı şifre",
          })
          throw new GirisHatasi("gecersiz")
        }

        // --- başarılı giriş ---
        await prisma.kullanici.update({
          where: { id: kullanici.id },
          data: {
            // Eski kilit alanlarını temizle: kaldırmadan önce kilitlenmiş
            // hesaplar bir daha takılmasın.
            hataliGirisSayisi: 0,
            kilitBitis: null,
            sonGirisTarihi: new Date(),
            sonGirisIp: ip,
          },
        })
        await logYaz({
          islem: "GIRIS",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          ip,
          tarayici,
        })

        return {
          id: String(kullanici.id),
          kod: kullanici.kod,
          ad: [kullanici.ad, kullanici.soyad].filter(Boolean).join(" "),
          name: [kullanici.ad, kullanici.soyad].filter(Boolean).join(" "),
          email: kullanici.email ?? undefined,
          rol: kullanici.rol,
        }
      },
    }),
  ],
})

/** İstek başlıklarından gerçek istemci IP'sini çıkarır (Vercel arkasında da doğru çalışır). */
function istekIpsi(istek: Request | undefined): string | null {
  if (!istek) return null
  const iletilen = istek.headers.get("x-forwarded-for")
  if (iletilen) return iletilen.split(",")[0].trim()
  return istek.headers.get("x-real-ip")
}

/** Giriş denemelerini işlem loguna yazar. Log hatası girişi engellemez. */
async function logYaz(veri: {
  islem: "GIRIS" | "GIRIS_BASARISIZ"
  kullaniciId?: number
  kullaniciKod?: string
  ip?: string | null
  tarayici?: string | null
  aciklama?: string
}) {
  try {
    await prisma.islemLog.create({
      data: {
        islem: veri.islem,
        kullaniciId: veri.kullaniciId,
        kullaniciKod: veri.kullaniciKod,
        ip: veri.ip ?? undefined,
        tarayici: veri.tarayici ?? undefined,
        aciklama: veri.aciklama,
        tablo: "kullanicilar",
        kayitId: veri.kullaniciId,
      },
    })
  } catch {
    // log yazılamazsa sessiz geç — kullanıcı girişini bloklamaz
  }
}
