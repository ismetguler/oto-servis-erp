"use server"

import { revalidatePath } from "next/cache"

import { FIYAT_ALANLARI, topluFiyatSemasi, type FiyatAlani } from "./sema"
import { topluFiyatOnizlemesi, type TopluFiyatSatiri } from "./veri"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type TopluFiyatOnizleme = {
  hata?: string
  satirlar?: TopluFiyatSatiri[]
  alanAdi?: string
}

type TopluFiyatGirdiHam = {
  alan: string
  tip: string
  yon: string
  deger: string
  idler: number[]
}

function girdiyiCoz(girdi: TopluFiyatGirdiHam) {
  return topluFiyatSemasi.safeParse(girdi)
}

/**
 * Adım 1: seçilen kartların eski/yeni fiyatını hesaplayıp gösterir, kayıt
 * yapmaz. Önizleme ve uygulama aynı hesap fonksiyonunu (`yeniFiyatHesapla`)
 * kullanır — kullanıcı burada gördüğünden başka bir tutar kaydedilemez.
 */
export async function topluFiyatOnizle(girdi: TopluFiyatGirdiHam): Promise<TopluFiyatOnizleme> {
  try {
    await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = girdiyiCoz(girdi)
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Form geçersiz." }
  }

  const v = cozum.data
  const satirlar = await topluFiyatOnizlemesi(v.idler, v.alan, v.tip, v.yon, v.deger)
  if (satirlar.length === 0) return { hata: "Seçili kartlar bulunamadı." }

  return { satirlar, alanAdi: FIYAT_ALANLARI[v.alan] }
}

/**
 * Adım 2: transaction içinde toplu güncelleme + TEK log satırı.
 * Her kart için ayrı log YAZILMIYOR — 200 kart seçilse log tablosu 200
 * satır şişerdi; tek satırda etkilenen id/kod listesi `yeniDeger` içinde
 * tutuluyor, "kim ne zaman ne yaptı" sorusu yine cevaplanabiliyor.
 */
export async function topluFiyatUygula(
  girdi: TopluFiyatGirdiHam
): Promise<{ hata?: string; basarili?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = girdiyiCoz(girdi)
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Form geçersiz." }
  }

  const v = cozum.data
  const satirlar = await topluFiyatOnizlemesi(v.idler, v.alan, v.tip, v.yon, v.deger)
  if (satirlar.length === 0) return { hata: "Seçili kartlar bulunamadı." }

  const alan: FiyatAlani = v.alan

  try {
    await prisma.$transaction(async (tx) => {
      for (const s of satirlar) {
        await tx.stok.update({
          where: { id: s.id },
          data: { [alan]: s.yeniFiyat, guncelleyenId: kullanici.id },
        })
      }

      const yon = v.yon === "ZAM" ? "artırıldı" : "azaltıldı"
      const tip = v.tip === "YUZDE" ? `%${v.deger}` : `${v.deger} ₺`
      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "stoklar",
        aciklama: `Toplu fiyat güncelleme: ${satirlar.length} stok kartında ${FIYAT_ALANLARI[alan]} ${tip} ${yon}`,
        yeniDeger: {
          alan,
          tip: v.tip,
          yon: v.yon,
          deger: v.deger,
          kartlar: satirlar.map((s) => ({
            id: s.id,
            kod: s.kod,
            eski: s.eskiFiyat,
            yeni: s.yeniFiyat,
          })),
        },
      })
    })
  } catch (hata) {
    console.error("Toplu fiyat güncellenemedi:", hata)
    return { hata: "Güncelleme sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/stok")
  revalidatePath("/stok/toplu-fiyat")
  return { basarili: `${satirlar.length} stok kartında ${FIYAT_ALANLARI[alan]} güncellendi.` }
}
