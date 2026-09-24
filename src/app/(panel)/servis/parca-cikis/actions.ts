"use server"

import { revalidatePath } from "next/cache"

import { parcaCikisSemasi } from "./sema"
import { parcaOku } from "./veri"
import { kalemSil } from "../kabul/actions"
import { stokCikisiYaz, toplamlariYenile } from "../kabul/stok-islem"
import { kalemHesapla } from "@/lib/hesap"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * KABUL PARÇA ÇIKIŞI — yazma tarafı
 *
 * Stok düşümü ve kart toplamı burada YENİDEN YAZILMADI: kabul kartıyla
 * ortak `kabul/stok-islem.ts` çağrılıyor. Böylece iki ekran aynı stok
 * hareketini üretiyor ve satır bu ekrandan da kart ekranından da aynı
 * şekilde geri alınabiliyor.
 */

export type CikisDurumu = {
  hata?: string
  /** Stok yetersiz — kullanıcı onaylarsa aynı istek `stokUyarisiOnaylandi` ile tekrar gelir. */
  uyari?: string
  basari?: string
}

export async function parcaOkuAction(metin: string) {
  await yetkiliOturum("kabul", "gor")
  return parcaOku(metin)
}

export async function parcaCikisYap(form: FormData): Promise<CikisDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = parcaCikisSemasi.safeParse({
    ...Object.fromEntries(form),
    stokUyarisiOnaylandi: form.get("stokUyarisiOnaylandi") === "on",
    garantili: form.get("garantili") === "on",
  })
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Satır bilgileri hatalı." }
  }
  const v = cozum.data

  const kabul = await prisma.kabul.findUnique({
    where: { id: v.kabulId },
    select: {
      id: true,
      kabulNo: true,
      durum: true,
      silindi: true,
      kdvDahilGirilir: true,
    },
  })
  if (!kabul || kabul.silindi) return { hata: "Kabul kartı bulunamadı." }
  if (kabul.durum === "TESLIM_EDILDI") {
    return { hata: "Teslim edilmiş karta parça çıkılamaz. Önce kartı geri açın." }
  }

  const stok = await prisma.stok.findUnique({
    where: { id: v.stokId },
    select: {
      id: true,
      kod: true,
      ad: true,
      birim: true,
      satisFiyat: true,
      kdvOrani: true,
      mevcutMiktar: true,
      aktif: true,
      silindi: true,
    },
  })
  if (!stok || stok.silindi || !stok.aktif) return { hata: "Stok kartı bulunamadı." }

  // Selpar'da stok bakiyesi eksiye düşebiliyor (parça gelmiş ama girişi
  // yapılmamış olabilir) — bu yüzden çıkış ENGELLENMİYOR, sadece onay
  // isteniyor. Onay verilmezse satır hiç yazılmaz.
  const mevcut = Number(stok.mevcutMiktar.toString())
  if (v.miktar > mevcut && !v.stokUyarisiOnaylandi) {
    return {
      uyari: `Stokta ${mevcut} ${stok.birim.toLowerCase()} var, ${v.miktar} çıkılmak isteniyor. Yine de çıkılsın mı?`,
    }
  }

  const birimFiyat = v.birimFiyat ?? Number(stok.satisFiyat.toString())
  const kdvOrani = Number(stok.kdvOrani.toString())

  const hesap = kalemHesapla(
    { miktar: v.miktar, birimFiyat, kdvOrani },
    kabul.kdvDahilGirilir
  )

  try {
    await prisma.$transaction(async (tx) => {
      const sonSira = await tx.kabulKalem.aggregate({
        where: { kabulId: v.kabulId },
        _max: { sira: true },
      })

      const kalem = await tx.kabulKalem.create({
        data: {
          kabul: { connect: { id: v.kabulId } },
          stok: { connect: { id: stok.id } },
          sira: (sonSira._max.sira ?? 0) + 1,
          tur: "PARCA",
          // Kabul kartındaki kalem formuyla aynı yazım: "KOD — AD".
          aciklama: `${stok.kod} — ${stok.ad}`,
          birim: stok.birim,
          miktar: v.miktar,
          birimFiyat,
          kdvOrani,
          tutar: hesap.tutar,
          kdvTutar: hesap.kdvTutar,
          toplam: hesap.toplam,
          garantili: v.garantili,
        },
      })

      await stokCikisiYaz(tx, {
        kalemId: kalem.id,
        kabulId: v.kabulId,
        stokId: stok.id,
        miktar: v.miktar,
        birimFiyat,
        tutar: hesap.tutar,
        kullaniciId: kullanici.id,
        aciklama: `Hızlı parça çıkışı — ${kabul.kabulNo}`,
      })

      await toplamlariYenile(tx, v.kabulId)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kabul_kalemleri",
        kayitId: kalem.id,
        aciklama: `${kabul.kabulNo} parça çıkışı: ${stok.kod} — ${stok.ad} (${v.miktar} ${stok.birim})`,
        yeniDeger: { stokId: stok.id, miktar: v.miktar, birimFiyat, kdvOrani },
      })
    })
  } catch (hata) {
    console.error("Parça çıkışı yazılamadı:", hata)
    return { hata: "Parça çıkışı kaydedilemedi." }
  }

  revalidatePath(`/servis/parca-cikis/${v.kabulId}`)
  revalidatePath(`/servis/kabul/${v.kabulId}`)
  return { basari: `${stok.ad} — ${v.miktar} ${stok.birim.toLowerCase()} çıkıldı.` }
}

/**
 * Yanlış okunan satırı geri alır. Silme ve stok iadesi kabul kartındaki
 * `kalemSil` ile birebir aynı iş olduğu için o fonksiyon çağrılıyor —
 * burada sadece bu ekranın önbelleği tazeleniyor.
 */
export async function parcaCikisGeriAl(kalemId: number, kabulId: number) {
  const sonuc = await kalemSil(kalemId)
  if (!sonuc.hata) revalidatePath(`/servis/parca-cikis/${kabulId}`)
  return sonuc
}
