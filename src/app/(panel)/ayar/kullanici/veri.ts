import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/** Kullanıcı listesinin adres çubuğundan gelen filtreleri. */
export type KullaniciFiltreleri = {
  q?: string
  rol?: string
  durum?: string
}

/**
 * Liste filtresi tek yerde kuruluyor — Cari listesindeki desenle aynı
 * gerekçe: ekran ve olası dışa aktarma aynı koşulu kullansın.
 */
export function kullaniciListeKosulu({
  q = "",
  rol = "",
  durum = "aktif",
}: KullaniciFiltreleri): Prisma.KullaniciWhereInput {
  const arama = q.trim()

  return {
    silindi: false,
    ...(rol ? { rol: rol as Prisma.KullaniciWhereInput["rol"] } : {}),
    ...(durum === "aktif" ? { aktif: true } : {}),
    ...(durum === "pasif" ? { aktif: false } : {}),
    ...(arama
      ? {
          OR: aramaKosullari<Prisma.KullaniciWhereInput>(
            ["kod", "ad", "soyad", "email"],
            arama
          ),
        }
      : {}),
  }
}

/** "Şu an kilitli mi" — bileşenin render sırasında `Date.now()` çağırması
 * saflık kuralını ihlal ediyor (react-hooks/purity); hesap sunucu
 * fonksiyonunda, render'dan önce yapılıyor. */
export function kilitliMi(kilitBitis: Date | null): boolean {
  return Boolean(kilitBitis && kilitBitis.getTime() > Date.now())
}

export type KullaniciFormVerisi = {
  id: number
  kod: string
  ad: string
  soyad: string | null
  email: string | null
  telefon: string | null
  rol: string
  aktif: boolean
}

export async function kullaniciFormVerisi(id: number): Promise<KullaniciFormVerisi | null> {
  const k = await prisma.kullanici.findUnique({ where: { id } })
  if (!k || k.silindi) return null

  return {
    id: k.id,
    kod: k.kod,
    ad: k.ad,
    soyad: k.soyad,
    email: k.email,
    telefon: k.telefon,
    rol: k.rol,
    aktif: k.aktif,
  }
}

/** Kullanıcının kişiye özel modül istisnaları — sayfaKodu'na göre eriştirilir. */
export async function kullaniciYetkiIstisnalari(kullaniciId: number) {
  const kayitlar = await prisma.kullaniciYetki.findMany({
    where: { kullaniciId },
  })
  return new Map(kayitlar.map((k) => [k.sayfaKodu, k]))
}

/**
 * Sistemde en az bir aktif Yönetici kalıp kalmadığını söyler — kendi kendini
 * kilitleme riskini engellemenin temel sorgusu. `haric` verilirse o kayıt
 * sayıma katılmaz (bir Yönetici'nin KENDİSİ dışındakiler yeterli mi sorusu).
 */
export async function aktifYoneticiSayisi(haric?: number): Promise<number> {
  return prisma.kullanici.count({
    where: {
      rol: "YONETICI",
      aktif: true,
      silindi: false,
      ...(haric ? { NOT: { id: haric } } : {}),
    },
  })
}
