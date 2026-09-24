"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { aktifYoneticiSayisi } from "./veri"
import {
  kullaniciDuzenleSemasi,
  kullaniciEkleSemasi,
  sifreSifirlaSemasi,
  yetkiIstisnasiSemasi,
} from "./sema"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { MODUL_ADLARI, YetkiHatasi, yetkiVar, type Modul } from "@/lib/yetki"

/**
 * KULLANICI YÖNETİMİ — yazma tarafı.
 *
 * bcrypt round'u (12) `lib/auth.ts`teki SAHTE_HASH ile aynı — auth.ts'in
 * karşılaştırma mantığı buraya kopyalanmadı, yalnızca hash üretim maliyeti
 * eşitlendi.
 */
const BCRYPT_TUR_SAYISI = 12

function ilkAlanHatalari(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

export type KullaniciFormDurumu = {
  hata?: string
  alanHatalari?: Record<string, string>
}

function tazele(id?: number) {
  revalidatePath("/ayar/kullanici")
  if (id) revalidatePath(`/ayar/kullanici/${id}/duzenle`)
}

/**
 * "Son Yönetici" kontrolü: hedef kayıt şu an aktif bir Yönetici ise ve
 * işlem sonucunda öyle kalmayacaksa (rolü değişiyor ya da pasife alınıyor),
 * sistemde ondan başka aktif Yönetici kalmadığında işlem reddedilir.
 * Cari Birleştir'deki "geri dönüşü olmayan işlem" temkiniyle aynı ruhta,
 * ama burada onay değil doğrudan iş kuralı kilidi var.
 */
async function sonYoneticiKontrolu(
  hedef: { id: number; rol: string; aktif: boolean },
  yeniRol: string,
  yeniAktif: boolean
): Promise<string | null> {
  const oncedenAktifYonetici = hedef.rol === "YONETICI" && hedef.aktif
  const sonrasindaAktifYonetici = yeniRol === "YONETICI" && yeniAktif
  if (!oncedenAktifYonetici || sonrasindaAktifYonetici) return null

  const digerAktifYonetici = await aktifYoneticiSayisi(hedef.id)
  if (digerAktifYonetici === 0) {
    return "Sistemde en az bir aktif Yönetici kalmalı; bu son aktif Yönetici hesabı."
  }
  return null
}

/** Yeni kullanıcı ekler. */
export async function kullaniciEkle(
  _oncekiDurum: KullaniciFormDurumu,
  form: FormData
): Promise<KullaniciFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = kullaniciEkleSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: ilkAlanHatalari(cozum.error.issues),
    }
  }
  const v = cozum.data

  // Büyük/küçük harf duyarsız çakışma: "Ahmet" ile "ahmet" ayrı hesap
  // olmasın (giriş de artık harf-duyarsız, bkz. auth.ts).
  const cakisan = await prisma.kullanici.findFirst({
    where: { kod: { equals: v.kod, mode: "insensitive" } },
  })
  if (cakisan) {
    return {
      hata: `"${v.kod}" kullanıcı adı zaten alınmış.`,
      alanHatalari: { kod: "Bu kullanıcı adı başkasında kullanılıyor." },
    }
  }

  const sifreHash = await bcrypt.hash(v.sifre, BCRYPT_TUR_SAYISI)

  const yeni = await prisma.kullanici.create({
    data: {
      kod: v.kod,
      ad: v.ad,
      soyad: v.soyad ?? null,
      email: v.email ?? null,
      telefon: v.telefon ?? null,
      rol: v.rol,
      sifreHash,
    },
  })

  await logKaydet({
    islem: "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kullanicilar",
    kayitId: yeni.id,
    aciklama: `${yeni.kod} — ${yeni.ad} ${yeni.soyad ?? ""}`.trim(),
    // Şifre hash'i loglanmıyor — log.ts'teki `temizle` zaten maskeliyor,
    // ama alan burada da bilerek dışarıda bırakıldı.
    yeniDeger: { kod: yeni.kod, ad: yeni.ad, soyad: yeni.soyad, email: yeni.email, telefon: yeni.telefon, rol: yeni.rol, aktif: yeni.aktif },
  })

  tazele()
  redirect(`/ayar/kullanici/${yeni.id}/duzenle?eklendi=1`)
}

/** Mevcut kullanıcıyı günceller — kod ve şifre burada değişmez. */
export async function kullaniciDuzenle(
  _oncekiDurum: KullaniciFormDurumu,
  form: FormData
): Promise<KullaniciFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const idMetni = String(form.get("id") ?? "").trim()
  const id = Number(idMetni)
  if (!Number.isInteger(id) || id <= 0) return { hata: "Geçersiz kayıt." }

  const cozum = kullaniciDuzenleSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: ilkAlanHatalari(cozum.error.issues),
    }
  }
  const v = cozum.data

  const onceki = await prisma.kullanici.findUnique({ where: { id } })
  if (!onceki || onceki.silindi) return { hata: "Kullanıcı bulunamadı." }

  const kilitHatasi = await sonYoneticiKontrolu(onceki, v.rol, onceki.aktif)
  if (kilitHatasi) return { hata: kilitHatasi }

  const guncel = await prisma.kullanici.update({
    where: { id },
    data: {
      ad: v.ad,
      soyad: v.soyad ?? null,
      email: v.email ?? null,
      telefon: v.telefon ?? null,
      rol: v.rol,
    },
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kullanicilar",
    kayitId: id,
    aciklama: `${guncel.kod} — ${guncel.ad} ${guncel.soyad ?? ""}`.trim(),
    eskiDeger: { ad: onceki.ad, soyad: onceki.soyad, email: onceki.email, telefon: onceki.telefon, rol: onceki.rol },
    yeniDeger: { ad: guncel.ad, soyad: guncel.soyad, email: guncel.email, telefon: guncel.telefon, rol: guncel.rol },
  })

  tazele(id)
  redirect(`/ayar/kullanici/${id}/duzenle?kaydedildi=1`)
}

/**
 * Kullanıcıyı pasife alır / aktif eder — soft delete DEĞİL. Giriş kaydı
 * (loglar, açtığı kabuller) olduğu için fiziksel silme ya da `silindi`
 * bayrağı yerine `aktif` kullanılıyor; Cari'deki "sil" ile karıştırılmasın
 * diye buton metni de "Pasife Al / Aktif Et".
 */
export async function kullaniciDurumDegistir(
  id: number,
  aktif: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  // Kendi kendini kilitleme riski #1: oturumdaki kullanıcı kendi hesabını
  // pasife alamaz — son Yönetici kontrolünden bağımsız, her zaman geçerli.
  if (id === kullanici.id && !aktif) {
    return { hata: "Kendi hesabınızı pasife alamazsınız." }
  }

  const onceki = await prisma.kullanici.findUnique({ where: { id } })
  if (!onceki || onceki.silindi) return { hata: "Kullanıcı bulunamadı." }
  if (onceki.aktif === aktif) return {}

  const kilitHatasi = await sonYoneticiKontrolu(onceki, onceki.rol, aktif)
  if (kilitHatasi) return { hata: kilitHatasi }

  await prisma.kullanici.update({ where: { id }, data: { aktif } })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kullanicilar",
    kayitId: id,
    aciklama: `${onceki.kod} — ${aktif ? "aktif edildi" : "pasife alındı"}`,
    eskiDeger: { aktif: onceki.aktif },
    yeniDeger: { aktif },
  })

  tazele(id)
  return {}
}

export type SifreSifirlaDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

/**
 * Şifre sıfırlama — aynı zamanda kilidi açmanın tek yolu: `hataliGirisSayisi`
 * ve `kilitBitis` burada da sıfırlanıyor. Ayrı bir "kilidi aç" düğmesi
 * eklenmedi; kilitli bir hesabın açılması zaten yeni şifre vermek kadar
 * hassas bir işlem, iki ayrı yol açmak kafa karıştırırdı.
 */
export async function sifreSifirla(
  _oncekiDurum: SifreSifirlaDurumu,
  form: FormData
): Promise<SifreSifirlaDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = sifreSifirlaSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Şifre en az 6 karakter olmalı.",
      alanHatalari: ilkAlanHatalari(cozum.error.issues),
    }
  }
  const { kullaniciId, yeniSifre } = cozum.data

  const hedef = await prisma.kullanici.findUnique({ where: { id: kullaniciId } })
  if (!hedef || hedef.silindi) return { hata: "Kullanıcı bulunamadı." }

  const sifreHash = await bcrypt.hash(yeniSifre, BCRYPT_TUR_SAYISI)

  await prisma.kullanici.update({
    where: { id: kullaniciId },
    data: {
      sifreHash,
      sifreDegisimTarihi: new Date(),
      hataliGirisSayisi: 0,
      kilitBitis: null,
    },
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kullanicilar",
    kayitId: kullaniciId,
    aciklama: `${hedef.kod} — şifre sıfırlandı`,
    // sifreHash bilerek hiçbir yere yazılmıyor.
  })

  tazele(kullaniciId)
  return { basarili: `"${hedef.kod}" için yeni şifre kaydedildi.` }
}

export type YetkiIstisnasiDurumu = { hata?: string }

/**
 * Kendi kendini "ayar" ekranından kilitleme koruması (adım 11.2 madde 6):
 * 77.5'teki madde 1 ile aynı ruhta — genel "sistemde en az bir yetkili
 * kullanıcı kalsın" hesabı (başka kimin hangi istisnaya sahip olduğunu
 * kullanıcı bazında taramayı gerektirir) yerine BASİT VE MUTLAK bir kural
 * seçildi: oturum sahibi kendi "ayar" istisnasını, sonucunda kendisini bu
 * ekrandan (gör veya düzelt) dışarıda bırakacak şekilde DEĞİŞTİREMEZ —
 * ister yeni istisna yazarak ister var olanı kaldırarak. Rol bazlı
 * varsayılan zaten bu ekrana erişimi olan yeterince kullanıcı bırakıyorsa
 * bu kontrol geçilir; asıl amaç "elimle kendimi dışarıda bıraktım"
 * kazasını önlemek, sistem genelinde başka yetkili arayıp bulmak değil.
 */
function kendiAyarErisiminiKapatiyorMu(
  oturumSahibiId: number,
  hedefKullaniciId: number,
  hedefRol: string,
  sonrakiIstisna: { gorebilir: boolean; duzeltebilir: boolean } | null
): boolean {
  if (oturumSahibiId !== hedefKullaniciId) return false

  const sahte = {
    rol: hedefRol as Parameters<typeof yetkiVar>[0]["rol"],
    istisnalar: sonrakiIstisna
      ? [{ sayfaKodu: "ayar", ekleyebilir: false, silebilir: false, ...sonrakiIstisna }]
      : [],
  }
  return !yetkiVar(sahte, "ayar", "gor") || !yetkiVar(sahte, "ayar", "duzelt")
}

/** Modül istisnası ekler/günceller — schema'daki `@@unique` ile upsert. */
export async function yetkiIstisnasiKaydet(
  _oncekiDurum: YetkiIstisnasiDurumu,
  form: FormData
): Promise<YetkiIstisnasiDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = yetkiIstisnasiSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) return { hata: "Formda eksik veya hatalı alanlar var." }
  const v = cozum.data

  // "Görebilir" kapalıysa diğer üçü anlamsız — yetkiVar zaten hepsini
  // false döndürüyor ama kayıtta da tutarlı dursun diye burada da kapatılıyor.
  const gorebilir = v.gorebilir
  const ekleyebilir = gorebilir && v.ekleyebilir
  const duzeltebilir = gorebilir && v.duzeltebilir
  const silebilir = gorebilir && v.silebilir

  const hedef = await prisma.kullanici.findUnique({ where: { id: v.kullaniciId } })
  if (!hedef || hedef.silindi) return { hata: "Kullanıcı bulunamadı." }

  if (
    v.sayfaKodu === "ayar" &&
    kendiAyarErisiminiKapatiyorMu(kullanici.id, hedef.id, hedef.rol, {
      gorebilir,
      duzeltebilir,
    })
  ) {
    return { hata: "Kendi \"Ayarlar\" erişiminizi kısıtlayamazsınız." }
  }

  const onceki = await prisma.kullaniciYetki.findUnique({
    where: { kullaniciId_sayfaKodu: { kullaniciId: v.kullaniciId, sayfaKodu: v.sayfaKodu } },
  })

  const kayit = await prisma.kullaniciYetki.upsert({
    where: { kullaniciId_sayfaKodu: { kullaniciId: v.kullaniciId, sayfaKodu: v.sayfaKodu } },
    create: { kullaniciId: v.kullaniciId, sayfaKodu: v.sayfaKodu, gorebilir, ekleyebilir, duzeltebilir, silebilir },
    update: { gorebilir, ekleyebilir, duzeltebilir, silebilir },
  })

  const modulAdi = MODUL_ADLARI[v.sayfaKodu as Modul]
  const ozet = `gör=${gorebilir ? "✓" : "✗"} ekle=${ekleyebilir ? "✓" : "✗"} düzelt=${duzeltebilir ? "✓" : "✗"} sil=${silebilir ? "✓" : "✗"}`

  await logKaydet({
    islem: onceki ? "GUNCELLE" : "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kullanici_yetkileri",
    kayitId: kayit.id,
    aciklama: `${hedef.kod} — ${modulAdi} istisnası: ${ozet}`,
    eskiDeger: onceki
      ? { gorebilir: onceki.gorebilir, ekleyebilir: onceki.ekleyebilir, duzeltebilir: onceki.duzeltebilir, silebilir: onceki.silebilir }
      : undefined,
    yeniDeger: { gorebilir, ekleyebilir, duzeltebilir, silebilir },
  })

  tazele(v.kullaniciId)
  return {}
}

/** İstisnayı kaldırır — kayıt fiziksel silinir, kullanıcı rolün varsayılanına döner. */
export async function yetkiIstisnasiKaldir(
  kullaniciId: number,
  sayfaKodu: string
): Promise<YetkiIstisnasiDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("ayar", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const hedef = await prisma.kullanici.findUnique({ where: { id: kullaniciId } })
  if (!hedef || hedef.silindi) return { hata: "Kullanıcı bulunamadı." }

  if (
    sayfaKodu === "ayar" &&
    kendiAyarErisiminiKapatiyorMu(kullanici.id, hedef.id, hedef.rol, null)
  ) {
    return { hata: "Kendi \"Ayarlar\" erişiminizi kısıtlayamazsınız." }
  }

  const onceki = await prisma.kullaniciYetki.findUnique({
    where: { kullaniciId_sayfaKodu: { kullaniciId, sayfaKodu } },
  })
  if (!onceki) return {}

  await prisma.kullaniciYetki.delete({ where: { id: onceki.id } })

  const modulAdi = MODUL_ADLARI[sayfaKodu as Modul] ?? sayfaKodu
  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kullanici_yetkileri",
    kayitId: onceki.id,
    aciklama: `${hedef.kod} — ${modulAdi} istisnası kaldırıldı, role dönüldü`,
    eskiDeger: { gorebilir: onceki.gorebilir, ekleyebilir: onceki.ekleyebilir, duzeltebilir: onceki.duzeltebilir, silebilir: onceki.silebilir },
  })

  tazele(kullaniciId)
  return {}
}
