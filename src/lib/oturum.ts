import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { yetkiZorunlu, type Islem, type Modul, type YetkiSahibi } from "@/lib/yetki"

/**
 * Sunucu tarafında "şu an kim giriş yapmış?" sorusunun tek cevabı.
 *
 * Cookie'deki JWT'ye körü körüne güvenmiyoruz: kullanıcı hâlâ var mı, aktif mi,
 * silinmiş mi diye veritabanından da kontrol ediyoruz. Böylece bir kullanıcı
 * pasife alındığı anda elindeki oturum da geçersiz oluyor.
 *
 * `cache` sayesinde aynı istek içinde kaç kez çağrılırsa çağrılsın
 * veritabanına yalnızca bir kez gidilir.
 */
export type OturumKullanicisi = YetkiSahibi & {
  id: number
  kod: string
  ad: string
  soyad: string | null
  tamAd: string
  email: string | null
}

export const oturumKullanicisi = cache(async (): Promise<OturumKullanicisi | null> => {
  const oturum = await auth()
  const id = Number(oturum?.user?.id)
  if (!id || Number.isNaN(id)) return null

  const kullanici = await prisma.kullanici.findUnique({
    where: { id },
    select: {
      id: true,
      kod: true,
      ad: true,
      soyad: true,
      email: true,
      rol: true,
      aktif: true,
      silindi: true,
      yetkiler: {
        select: {
          sayfaKodu: true,
          gorebilir: true,
          ekleyebilir: true,
          duzeltebilir: true,
          silebilir: true,
        },
      },
    },
  })

  if (!kullanici || !kullanici.aktif || kullanici.silindi) return null

  return {
    id: kullanici.id,
    kod: kullanici.kod,
    ad: kullanici.ad,
    soyad: kullanici.soyad,
    tamAd: [kullanici.ad, kullanici.soyad].filter(Boolean).join(" "),
    email: kullanici.email,
    rol: kullanici.rol,
    istisnalar: kullanici.yetkiler,
  }
})

/** Giriş yapılmamışsa giriş sayfasına yönlendirir. Sayfaların başında çağrılır. */
export async function oturumZorunlu(): Promise<OturumKullanicisi> {
  const kullanici = await oturumKullanicisi()
  if (!kullanici) redirect("/giris")
  return kullanici
}

/** Hem oturumu hem de modül yetkisini kontrol eder. */
export async function yetkiliOturum(
  modul: Modul,
  islem: Islem = "gor"
): Promise<OturumKullanicisi> {
  const kullanici = await oturumZorunlu()
  yetkiZorunlu(kullanici, modul, islem)
  return kullanici
}
