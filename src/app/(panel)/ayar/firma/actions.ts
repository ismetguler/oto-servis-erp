"use server"

import { revalidatePath } from "next/cache"

import { firmaBilgisi } from "./veri"
import { firmaSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { metniSayiyaCevir } from "@/lib/sayi"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type FirmaFormDurumu = {
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

/**
 * Tek satırı kaydeder — id her zaman 1, "yeni kayıt" kavramı yok. İlk
 * kaydında satır yoktur (EKLE), sonrasında hep aynı satır güncellenir
 * (GUNCELLE); log akışı bu yüzden `onceki`nin var/yok oluşuna bakıyor.
 */
export async function firmaKaydet(
  _oncekiDurum: FirmaFormDurumu,
  form: FormData
): Promise<FirmaFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = firmaSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: ilkAlanHatalari(cozum.error.issues),
    }
  }
  const v = cozum.data

  const kdv = metniSayiyaCevir(v.varsayilanKdv)
  if (!Number.isFinite(kdv) || kdv < 0 || kdv > 100) {
    return {
      hata: "Varsayılan KDV oranı 0-100 arasında bir sayı olmalı.",
      alanHatalari: { varsayilanKdv: "Geçerli bir yüzde girin." },
    }
  }

  const onceki = await firmaBilgisi()

  const veri = {
    unvan: v.unvan,
    vergiNo: v.vergiNo ?? null,
    vergiDair: v.vergiDair ?? null,
    adres: v.adres ?? null,
    il: v.il ?? null,
    ilce: v.ilce ?? null,
    telefon: v.telefon ?? null,
    gsm: v.gsm ?? null,
    email: v.email ?? null,
    webAdresi: v.webAdresi ?? null,
    logoUrl: v.logoUrl ?? null,
    logo: v.logo ?? null,
    bankaAdi: v.bankaAdi ?? null,
    ibanNo: v.ibanNo ?? null,
    varsayilanKdv: kdv,
    paraBirimi: v.paraBirimi,
  }

  const guncel = await prisma.firma.upsert({
    where: { id: 1 },
    create: { id: 1, ...veri },
    update: veri,
  })

  await logKaydet({
    islem: onceki ? "GUNCELLE" : "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "firma",
    kayitId: 1,
    aciklama: onceki ? "Firma bilgileri güncellendi" : "Firma bilgileri ilk kez kaydedildi",
    eskiDeger: onceki
      ? {
          unvan: onceki.unvan,
          vergiNo: onceki.vergiNo,
          vergiDair: onceki.vergiDair,
          adres: onceki.adres,
          il: onceki.il,
          ilce: onceki.ilce,
          telefon: onceki.telefon,
          gsm: onceki.gsm,
          email: onceki.email,
          webAdresi: onceki.webAdresi,
          logoUrl: onceki.logoUrl,
          // Base64 logo çok uzun — audit loguna yalnız "var/yok" yazılır.
          logo: onceki.logo ? "(yüklü)" : null,
          bankaAdi: onceki.bankaAdi,
          ibanNo: onceki.ibanNo,
          varsayilanKdv: onceki.varsayilanKdv.toString(),
          paraBirimi: onceki.paraBirimi,
        }
      : undefined,
    yeniDeger: {
      unvan: guncel.unvan,
      vergiNo: guncel.vergiNo,
      vergiDair: guncel.vergiDair,
      adres: guncel.adres,
      il: guncel.il,
      ilce: guncel.ilce,
      telefon: guncel.telefon,
      gsm: guncel.gsm,
      email: guncel.email,
      webAdresi: guncel.webAdresi,
      logoUrl: guncel.logoUrl,
      logo: guncel.logo ? "(yüklü)" : null,
      bankaAdi: guncel.bankaAdi,
      ibanNo: guncel.ibanNo,
      varsayilanKdv: guncel.varsayilanKdv.toString(),
      paraBirimi: guncel.paraBirimi,
    },
  })

  revalidatePath("/ayar/firma")
  return { basarili: "Firma bilgileri kaydedildi." }
}
