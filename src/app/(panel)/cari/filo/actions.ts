"use server"

import { revalidatePath } from "next/cache"

import { filoSozlesmesiSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

export type FiloSozlesmesiDurumu = {
  hata?: string
  alanHatalari?: Record<string, string>
  basarili?: string
}

/** Filo sözleşmesi kaydet (yeni veya güncelleme). Gizli `id` alanı ayırır. */
export async function filoSozlesmesiKaydet(
  _oncekiDurum: FiloSozlesmesiDurumu,
  form: FormData
): Promise<FiloSozlesmesiDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = filoSozlesmesiSemasi.safeParse({
    ...Object.fromEntries(form),
    aktif: form.get("aktif") === "on",
  })
  if (!cozum.success) {
    const alanHatalari: Record<string, string> = {}
    for (const sorun of cozum.error.issues) {
      const alan = String(sorun.path[0] ?? "")
      if (alan && !alanHatalari[alan]) alanHatalari[alan] = sorun.message
    }
    return { hata: "Formda eksik veya hatalı alanlar var.", alanHatalari }
  }

  const v = cozum.data

  const cari = await prisma.cari.findUnique({
    where: { id: v.cariId },
    select: { id: true, silindi: true },
  })
  if (!cari || cari.silindi) return { hata: "Cari bulunamadı." }

  const alanlar = {
    ad: v.ad,
    baslangic: new Date(v.baslangic),
    bitis: new Date(v.bitis),
    vadeGun: v.vadeGun,
    kapsamPlakalari: v.kapsamPlakalari ? v.kapsamPlakalari : null,
    notu: v.notu ? v.notu : null,
    aktif: v.aktif,
  }

  try {
    if (duzenleme) {
      const onceki = await prisma.filoSozlesmesi.findFirst({
        where: { id, silindi: false },
      })
      if (!onceki) return { hata: "Sözleşme bulunamadı." }

      const yeni = await prisma.filoSozlesmesi.update({
        where: { id },
        data: { ...alanlar, guncelleyenId: kullanici.id },
      })
      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "filo_sozlesmeleri",
        kayitId: yeni.id,
        aciklama: `Filo sözleşmesi: ${yeni.ad}`,
        eskiDeger: onceki,
        yeniDeger: yeni,
      })
    } else {
      const yeni = await prisma.filoSozlesmesi.create({
        data: { ...alanlar, cariId: v.cariId, olusturanId: kullanici.id },
      })
      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "filo_sozlesmeleri",
        kayitId: yeni.id,
        aciklama: `Filo sözleşmesi: ${yeni.ad}`,
        yeniDeger: yeni,
      })
    }
  } catch (hata) {
    console.error("Filo sözleşmesi kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath(`/cari/${v.cariId}`)
  return { basarili: duzenleme ? "Sözleşme güncellendi." : "Sözleşme eklendi." }
}

/** Filo sözleşmesini siler (soft delete). */
export async function filoSozlesmesiSil(id: number): Promise<{ hata?: string; basarili?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const onceki = await prisma.filoSozlesmesi.findFirst({
    where: { id, silindi: false },
    select: { id: true, ad: true, cariId: true },
  })
  if (!onceki) return { hata: "Sözleşme bulunamadı." }

  await prisma.filoSozlesmesi.update({
    where: { id },
    data: { silindi: true, silmeTarihi: new Date(), guncelleyenId: kullanici.id },
  })
  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "filo_sozlesmeleri",
    kayitId: onceki.id,
    aciklama: `Filo sözleşmesi silindi: ${onceki.ad}`,
    eskiDeger: onceki,
  })

  revalidatePath(`/cari/${onceki.cariId}`)
  return { basarili: "Sözleşme silindi." }
}
