"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { stokGirisiSemasi } from "./sema"
import { parcaOku } from "@/app/(panel)/servis/parca-cikis/veri"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type StokGirisiDurumu = { hata?: string }

/**
 * Ürün arama — Kabul Parça Çıkışı'ndaki `parcaOku` motoru (barkod/kod tam
 * eşleşme, yoksa geniş arama). Dönen adayların alış fiyatı ayrıca okunur:
 * stok girişinde satırın ön değeri kartın son alış fiyatı olmalı.
 */
export async function stokGirisiAra(metin: string) {
  await yetkiliOturum("stok", "gor")
  const sonuc = await parcaOku(metin)

  const idler = [
    ...(sonuc.tam ? [sonuc.tam.id] : []),
    ...sonuc.adaylar.map((a) => a.id),
  ]
  if (idler.length === 0) return { tam: null, adaylar: [] }

  const kartlar = await prisma.stok.findMany({
    where: { id: { in: idler } },
    select: { id: true, alisFiyat: true, mevcutMiktar: true },
  })
  const ek = new Map(
    kartlar.map((k) => [
      k.id,
      { alisFiyat: Number(k.alisFiyat), mevcutMiktar: Number(k.mevcutMiktar) },
    ])
  )
  const zenginlestir = (p: { id: number; kod: string; ad: string; barkod: string | null; birim: string }) => ({
    id: p.id,
    kod: p.kod,
    ad: p.ad,
    barkod: p.barkod,
    birim: p.birim,
    alisFiyat: ek.get(p.id)?.alisFiyat ?? 0,
    mevcutMiktar: ek.get(p.id)?.mevcutMiktar ?? 0,
  })

  return {
    tam: sonuc.tam ? zenginlestir(sonuc.tam) : null,
    adaylar: sonuc.adaylar.map(zenginlestir),
  }
}

/**
 * Stok girişini kaydeder ve TEK transaction'da uygular:
 *  - Fiş ONAYLANDI olarak açılır (ayrı onay adımı yok — form zaten önizleme).
 *  - Her satır için StokGirisKalem + StokHareket (tur=GIRIS).
 *  - `Stok.mevcutMiktar` artırılır, ağırlıklı ortalama maliyet + son alış
 *    fiyatı güncellenir (alış faturasındaki `evrakStoklariniArtir` mantığı).
 */
export async function stokGirisiKaydet(
  _oncekiDurum: StokGirisiDurumu,
  form: FormData
): Promise<StokGirisiDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = stokGirisiSemasi.safeParse({
    depoId: form.get("depoId"),
    saticiAdi: form.get("saticiAdi") ?? "",
    aciklama: form.get("aciklama") ?? "",
    stokId: form.getAll("stokId"),
    miktar: form.getAll("miktar"),
    birimFiyat: form.getAll("birimFiyat"),
  })
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Formda hata var." }
  }
  const v = cozum.data

  let fisId: number
  try {
    fisId = await prisma.$transaction(async (tx) => {
      const stoklar = await tx.stok.findMany({
        where: { id: { in: v.stokId }, silindi: false },
        select: { id: true, depoId: true, mevcutMiktar: true, ortalamaMaliyet: true },
      })
      const stokHaritasi = new Map(stoklar.map((s) => [s.id, s]))
      if (stoklar.length !== v.stokId.length) {
        throw new Error("Seçili ürünlerden biri bulunamadı; sayfayı yenileyin.")
      }

      const yil = new Date().getFullYear()
      const onEk = `SG${yil}-`
      await tx.numarator.updateMany({
        where: { tur: "STOK_GIRIS", yil, NOT: { onEk: { contains: String(yil) } } },
        data: { onEk },
      })
      const fisNo = await siradakiNumara(tx, "STOK_GIRIS", {
        yilBazli: true,
        varsayilanOnEk: onEk,
        basamak: 5,
      })

      const fis = await tx.stokGirisFisi.create({
        data: {
          fisNo,
          depoId: v.depoId ?? null,
          saticiAdi: v.saticiAdi,
          aciklama: v.aciklama,
          durum: "ONAYLANDI",
          olusturanId: kullanici.id,
          onaylayanId: kullanici.id,
          onayTarihi: new Date(),
        },
      })

      let toplam = 0
      for (let i = 0; i < v.stokId.length; i++) {
        const stokId = v.stokId[i]
        const miktar = v.miktar[i]
        const birimFiyat = v.birimFiyat[i]
        const tutar = Number((miktar * birimFiyat).toFixed(2))
        toplam += tutar
        const kart = stokHaritasi.get(stokId)!
        // Fişte depo seçildiyse hareket ve (depoID'siz kartta) kart o depoya;
        // yoksa kartın kendi deposu.
        const hedefDepoId = v.depoId ?? kart.depoId ?? null

        await tx.stokGirisKalem.create({
          data: { stokGirisFisiId: fis.id, stokId, miktar, birimFiyat, tutar },
        })

        await tx.stokHareket.create({
          data: {
            stok: { connect: { id: stokId } },
            ...(hedefDepoId ? { depo: { connect: { id: hedefDepoId } } } : {}),
            tur: "GIRIS",
            miktar,
            birimFiyat,
            tutar,
            stokGirisFisiId: fis.id,
            aciklama: `Stok girişi ${fisNo}`,
            kullaniciId: kullanici.id,
          },
        })

        // Ağırlıklı ortalama maliyet — alış faturasındaki formülün aynısı.
        const eskiMiktar = Number(kart.mevcutMiktar)
        const eskiOrt = Number(kart.ortalamaMaliyet)
        const tabanOrt = eskiOrt > 0 ? eskiOrt : birimFiyat
        const yeniMiktar = eskiMiktar + miktar
        const yeniOrt =
          yeniMiktar > 0
            ? (eskiMiktar * tabanOrt + miktar * birimFiyat) / yeniMiktar
            : birimFiyat

        await tx.stok.update({
          where: { id: stokId },
          data: {
            mevcutMiktar: { increment: miktar },
            alisFiyat: birimFiyat,
            ortalamaMaliyet: yeniOrt.toFixed(2),
            // depo hiç atanmamışsa fişteki depoya bağla (Cari açılış deseni)
            ...(v.depoId && !kart.depoId ? { depo: { connect: { id: v.depoId } } } : {}),
          },
        })
      }

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "stok_giris_fisleri",
        kayitId: fis.id,
        aciklama: `${fis.fisNo} — ${v.stokId.length} kalem · ${toplam.toFixed(2)} ₺`,
      })

      return fis.id
    })
  } catch (hata) {
    console.error("Stok girişi kaydedilemedi:", hata)
    return {
      hata: hata instanceof Error ? hata.message : "Kayıt sırasında beklenmeyen bir hata oluştu.",
    }
  }

  revalidatePath("/stok/giris")
  redirect(`/stok/giris/${fisId}?kaydedildi=1`)
}

/**
 * Onaylanmış fişi geri alır: her kalem kadar `mevcutMiktar` düşürülür,
 * fişin StokHareket satırları silinir, fiş GERI_ALINDI'ya taşınır.
 * `alisFiyat` / `ortalamaMaliyet` bilerek geri alınmaz (alış faturası
 * iptalindeki ilkeyle aynı: fiyat tek yön güncellenir).
 */
export async function stokGirisiGeriAl(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const fis = await tx.stokGirisFisi.findUnique({
        where: { id },
        include: { kalemler: true },
      })
      if (!fis) throw new Error("Fiş bulunamadı.")
      if (fis.durum !== "ONAYLANDI") throw new Error("Yalnızca onaylı fiş geri alınabilir.")

      for (const k of fis.kalemler) {
        await tx.stok.update({
          where: { id: k.stokId },
          data: { mevcutMiktar: { decrement: k.miktar } },
        })
      }
      await tx.stokHareket.deleteMany({ where: { stokGirisFisiId: id } })
      await tx.stokGirisFisi.update({
        where: { id },
        data: { durum: "GERI_ALINDI", geriAlanId: kullanici.id, geriAlmaTarihi: new Date() },
      })

      await logKaydet({
        islem: "GERI_AL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "stok_giris_fisleri",
        kayitId: id,
        aciklama: `${fis.fisNo} geri alındı`,
      })
    })
  } catch (hata) {
    return { hata: hata instanceof Error ? hata.message : "Geri alınamadı." }
  }

  revalidatePath("/stok/giris")
  revalidatePath(`/stok/giris/${id}`)
  return {}
}

/** Geri alınmış fişi kalıcı siler (hareket zaten yok). */
export async function stokGirisiSil(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const fis = await prisma.stokGirisFisi.findUnique({ where: { id } })
  if (!fis) return { hata: "Fiş bulunamadı." }
  if (fis.durum === "ONAYLANDI") {
    return { hata: "Onaylı fiş silinemez; önce geri alın." }
  }

  await prisma.$transaction([
    prisma.stokGirisKalem.deleteMany({ where: { stokGirisFisiId: id } }),
    prisma.stokGirisFisi.delete({ where: { id } }),
  ])

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stok_giris_fisleri",
    kayitId: id,
    aciklama: `${fis.fisNo} silindi`,
  })

  revalidatePath("/stok/giris")
  redirect("/stok/giris")
}
