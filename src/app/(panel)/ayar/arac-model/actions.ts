"use server"

import { revalidatePath } from "next/cache"

import { aracModelSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type AracModelDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

function alanHatalariniTopla(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const s of sorunlar) {
    const alan = String(s.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = s.message
  }
  return sonuc
}

function tazele() {
  revalidatePath("/ayar/arac-model")
}

/** Elle yeni marka/model ekler veya var olan elle kaydı düzenler. */
export async function aracModelKaydet(
  _oncekiDurum: AracModelDurumu,
  form: FormData
): Promise<AracModelDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = aracModelSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const { marka, model } = cozum.data

  if (duzenleme) {
    const mevcut = await prisma.aracModelKatalog.findUnique({ where: { id } })
    if (!mevcut) return { hata: "Kayıt bulunamadı." }
    if (mevcut.kilitli) {
      return { hata: "Hazır katalog kaydı düzenlenemez." }
    }
  }

  // `@@unique([marka, model])` — kullanıcıya anlaşılır mesaj için önden bak.
  // Büyük/küçük harf DUYARSIZ kıyas: "toyota" ile "Toyota" ayrı kayıt olarak
  // eklenip marka açılırlarını kirletmesin (TEST-01 araç marka filtresi hatası
  // ile aynı sınıf — orada da `mode: "insensitive"` ile çözülmüştü).
  const cakisan = await prisma.aracModelKatalog.findFirst({
    where: {
      marka: { equals: marka, mode: "insensitive" },
      model: { equals: model, mode: "insensitive" },
      ...(duzenleme ? { NOT: { id } } : {}),
    },
    select: { id: true },
  })
  if (cakisan) {
    return { hata: "Bu marka/model zaten katalogda var.", alanHatalari: { model: "Zaten kayıtlı." } }
  }

  const kayit = duzenleme
    ? await prisma.aracModelKatalog.update({ where: { id }, data: { marka, model } })
    : await prisma.aracModelKatalog.create({
        data: { marka, model, kilitli: false, olusturanId: kullanici.id },
      })

  await logKaydet({
    islem: duzenleme ? "GUNCELLE" : "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "arac_model_katalog",
    kayitId: kayit.id,
    aciklama: `Araç modeli: ${kayit.marka} ${kayit.model}`,
    yeniDeger: kayit,
  })

  tazele()
  return { basarili: duzenleme ? "Model güncellendi." : "Model eklendi." }
}

/** Elle eklenmiş kaydı siler. Hazır katalog kayıtları silinemez. */
export async function aracModelSil(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kayit = await prisma.aracModelKatalog.findUnique({ where: { id } })
  if (!kayit) return { hata: "Kayıt bulunamadı." }
  if (kayit.kilitli) return { hata: "Hazır katalog kaydı silinemez." }

  await prisma.aracModelKatalog.delete({ where: { id } })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "arac_model_katalog",
    kayitId: id,
    aciklama: `Araç modeli silindi: ${kayit.marka} ${kayit.model}`,
    eskiDeger: kayit,
  })

  tazele()
  return {}
}
