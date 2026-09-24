"use server"

import { revalidatePath } from "next/cache"

import { karaListedenCikarSemasi, karaListeyeAlSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * KARA LİSTE İŞLEMLERİ — yazma tarafı.
 *
 * Cari kartındaki `karaListe` bayrağı ile `kara_liste_kayitlari` tablosu
 * DAİMA birlikte değişir; ikisi de tek transaction içinde yazılıyor. Yarım
 * kalırsa "kara listede görünen ama geçmişi olmayan" (ya da tersi) kayıt
 * oluşur ve kabul ekranındaki uyarı yalan söylemeye başlar.
 *
 * Yetki: cari modülünün "duzelt" izni. Kara listeye almak yeni kayıt açmak
 * değil, mevcut kartın durumunu değiştirmek.
 */

export type KaraListeDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

function ilkAlanHatalari(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

/** Kara liste durumu cari listesinde, kartında ve kabul ekranında görünüyor. */
function tazele(cariId: number) {
  revalidatePath("/cari/kara-liste")
  revalidatePath("/cari")
  revalidatePath(`/cari/${cariId}`)
  revalidatePath(`/cari/${cariId}/duzenle`)
  revalidatePath("/servis/kabul/yeni")
}

export async function karaListeyeAl(
  _oncekiDurum: KaraListeDurumu,
  form: FormData
): Promise<KaraListeDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = karaListeyeAlSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Kara liste nedeni yazılmalı.",
      alanHatalari: ilkAlanHatalari(cozum.error.issues),
    }
  }
  const { cariId, neden } = cozum.data

  const cari = await prisma.cari.findUnique({
    where: { id: cariId },
    select: { id: true, kod: true, unvan: true, silindi: true, karaListe: true },
  })
  if (!cari || cari.silindi) return { hata: "Cari bulunamadı." }
  if (cari.karaListe) return { hata: `"${cari.unvan}" zaten kara listede.` }

  await prisma.$transaction(async (tx) => {
    await tx.cari.update({
      where: { id: cariId },
      data: { karaListe: true, karaListeNedeni: neden, guncelleyenId: kullanici.id },
    })
    await tx.karaListeKaydi.create({
      data: {
        cariId,
        neden,
        ekleyenId: kullanici.id,
        ekleyenKod: kullanici.kod,
      },
    })
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    kayitId: cariId,
    aciklama: `KARA LİSTEYE ALINDI — ${cari.kod} ${cari.unvan}`,
    eskiDeger: { karaListe: false },
    yeniDeger: { karaListe: true, karaListeNedeni: neden },
  })

  tazele(cariId)
  return { basarili: `"${cari.unvan}" kara listeye alındı.` }
}

export async function karaListedenCikar(
  _oncekiDurum: KaraListeDurumu,
  form: FormData
): Promise<KaraListeDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = karaListedenCikarSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Kaldırma nedeni yazılmalı.",
      alanHatalari: ilkAlanHatalari(cozum.error.issues),
    }
  }
  const { cariId, kaldirmaNedeni } = cozum.data

  const cari = await prisma.cari.findUnique({
    where: { id: cariId },
    select: {
      id: true,
      kod: true,
      unvan: true,
      silindi: true,
      karaListe: true,
      karaListeNedeni: true,
    },
  })
  if (!cari || cari.silindi) return { hata: "Cari bulunamadı." }
  if (!cari.karaListe) return { hata: `"${cari.unvan}" zaten kara listede değil.` }

  await prisma.$transaction(async (tx) => {
    await tx.cari.update({
      where: { id: cariId },
      data: { karaListe: false, karaListeNedeni: null, guncelleyenId: kullanici.id },
    })

    const kapanan = await tx.karaListeKaydi.updateMany({
      where: { cariId, kaldirmaTarihi: null },
      data: {
        kaldirmaTarihi: new Date(),
        kaldirmaNedeni,
        kaldiranId: kullanici.id,
        kaldiranKod: kullanici.kod,
      },
    })

    // Açık kayıt yoksa (kart bu tablo açılmadan önce elle kara listeye
    // alınmışsa) kaldırma işlemi izsiz kalmasın diye kapalı bir satır
    // üretiliyor: kaldırıldığı an biliniyor, konulduğu an bilinmiyor.
    if (kapanan.count === 0) {
      await tx.karaListeKaydi.create({
        data: {
          cariId,
          neden: cari.karaListeNedeni ?? "Geçmiş kaydı bulunamadı",
          ekleyenKod: "DEVIR",
          kaldirmaTarihi: new Date(),
          kaldirmaNedeni,
          kaldiranId: kullanici.id,
          kaldiranKod: kullanici.kod,
        },
      })
    }
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    kayitId: cariId,
    aciklama: `KARA LİSTEDEN ÇIKARILDI — ${cari.kod} ${cari.unvan}`,
    eskiDeger: { karaListe: true, karaListeNedeni: cari.karaListeNedeni },
    yeniDeger: { karaListe: false, kaldirmaNedeni },
  })

  tazele(cariId)
  return { basarili: `"${cari.unvan}" kara listeden çıkarıldı.` }
}
