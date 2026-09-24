"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { evrakKalemSemasi, evrakSemasi } from "./sema"
import {
  evrakStoklariniArtir,
  evrakStoklariniGeriAl,
  evrakToplamlariniYenile,
} from "./stok-islem"
import { katalogAraAlis } from "./veri"
import { bakiyeyiHesapla } from "@/app/(panel)/cari/actions"
import { siparisSevkiniGeriAl } from "@/app/(panel)/siparis/donustur"
import { kalemHesapla } from "@/lib/hesap"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

export type EvrakFormDurumu = { hata?: string; alanHatalari?: Record<string, string> }
export type KalemDurumu = { hata?: string }

// ============================================================================
//  EVRAK KARTI — kaydet / durum / sil
// ============================================================================

/**
 * ALIŞ FATURASI — satış faturasının (`evrak/satis/actions.ts`) aynası.
 * Kabulden dönüştürme burada yok (o yalnız satış/servis tarafına özgü,
 * adım 9.2); kart doğrudan boş açılır, kalemler ayrı ekranda eklenir.
 */

/** Alış faturası kartını kaydeder (yeni veya taslakken güncelleme). */
export async function evrakKaydet(
  _oncekiDurum: EvrakFormDurumu,
  form: FormData
): Promise<EvrakFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("evrak", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = evrakSemasi.safeParse(Object.fromEntries(form))
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
  if (!cari || cari.silindi) {
    return { hata: "Seçilen tedarikçi bulunamadı.", alanHatalari: { cariId: "Cari geçersiz." } }
  }

  const alanlar = {
    evrakNo: v.evrakNo,
    tarih: v.tarih ? new Date(`${v.tarih}T00:00:00`) : new Date(),
    vadeTarihi: v.vadeTarihi ? new Date(`${v.vadeTarihi}T00:00:00`) : null,
    aciklama: v.aciklama ?? null,
    // Adım 11.8: baskı şablonlarını beslemek için elle girilen alanlar.
    kaynakEvrakNo: v.kaynakEvrakNo ?? null,
    irsaliyeNo: v.irsaliyeNo ?? null,
    irsaliyeTarihi: v.irsaliyeTarihi ? new Date(`${v.irsaliyeTarihi}T00:00:00`) : null,
    tasiyiciPlaka: v.tasiyiciPlaka ?? null,
    sevkAdresi: v.sevkAdresi ?? null,
    tevkifatKodu: v.tevkifatKodu ?? null,
    tevkifatOrani: v.tevkifatOrani ?? null,
  }

  let kayitId: number
  try {
    kayitId = await prisma.$transaction(async (tx) => {
      if (duzenleme) {
        const onceki = await tx.evrak.findUnique({ where: { id } })
        if (!onceki || onceki.silindi || (onceki.tur !== "ALIS" && onceki.tur !== "IADE_ALIS")) {
          throw new BulunamadiHatasi()
        }
        if (onceki.durum !== "TASLAK") throw new KilitliHatasi()

        const evrak = await tx.evrak.update({
          where: { id },
          data: { ...alanlar, cari: { connect: { id: v.cariId } }, guncelleyenId: kullanici.id },
        })

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "evraklar",
          kayitId: evrak.id,
          aciklama: evrak.evrakNo,
          eskiDeger: onceki,
          yeniDeger: evrak,
        })
        return evrak.id
      }

      const evrak = await tx.evrak.create({
        data: {
          ...alanlar,
          tur: v.iade ? "IADE_ALIS" : "ALIS",
          cari: { connect: { id: v.cariId } },
          olusturanId: kullanici.id,
        },
      })

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "evraklar",
        kayitId: evrak.id,
        aciklama: evrak.evrakNo,
        yeniDeger: evrak,
      })
      return evrak.id
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Fatura bulunamadı; silinmiş olabilir." }
    if (hata instanceof KilitliHatasi) {
      return { hata: "Kesilmiş/iptal edilmiş fatura düzenlenemez." }
    }
    if (hata instanceof Error && hata.message.includes("Unique constraint")) {
      return {
        hata: "Bu fatura no zaten kullanılmış.",
        alanHatalari: { evrakNo: "Bu numara zaten var." },
      }
    }
    console.error("Evrak kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/evrak/alis")
  revalidatePath(`/evrak/alis/${kayitId}`)
  redirect(`/evrak/alis/${kayitId}?kaydedildi=1`)
}

// ============================================================================
//  KALEM (stok satırı)
// ============================================================================

export async function kalemKaydet(
  _oncekiDurum: KalemDurumu,
  form: FormData
): Promise<KalemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("evrak", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = evrakKalemSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Satır bilgileri hatalı." }
  }
  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      const evrak = await tx.evrak.findUnique({
        where: { id: v.evrakId },
        select: { id: true, durum: true, silindi: true },
      })
      if (!evrak || evrak.silindi) throw new BulunamadiHatasi()
      if (evrak.durum !== "TASLAK") throw new KilitliHatasi()

      const hesap = kalemHesapla(v)
      const alanlar = {
        aciklama: v.aciklama,
        birim: v.birim,
        miktar: v.miktar,
        birimFiyat: v.birimFiyat,
        kdvOrani: v.kdvOrani,
        tutar: hesap.tutar,
        kdvTutar: hesap.kdvTutar,
        toplam: hesap.toplam,
      }

      if (v.id) {
        const onceki = await tx.evrakKalem.findUnique({ where: { id: v.id } })
        if (!onceki || onceki.evrakId !== v.evrakId) throw new BulunamadiHatasi()

        await tx.evrakKalem.update({
          where: { id: v.id },
          data: { ...alanlar, stok: v.stokId ? { connect: { id: v.stokId } } : { disconnect: true } },
        })
      } else {
        const sonSira = await tx.evrakKalem.aggregate({
          where: { evrakId: v.evrakId },
          _max: { sira: true },
        })
        await tx.evrakKalem.create({
          data: {
            ...alanlar,
            sira: (sonSira._max.sira ?? 0) + 1,
            evrak: { connect: { id: v.evrakId } },
            ...(v.stokId ? { stok: { connect: { id: v.stokId } } } : {}),
          },
        })
      }

      await evrakToplamlariniYenile(tx, v.evrakId)

      await logKaydet({
        islem: v.id ? "GUNCELLE" : "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "evrak_kalemleri",
        kayitId: v.id ?? 0,
        aciklama: `${v.aciklama} (${v.miktar} × ${v.birimFiyat})`,
        yeniDeger: alanlar,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Satır veya fatura bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Kesilmiş faturaya satır eklenemez." }
    console.error("Kalem kaydedilemedi:", hata)
    return { hata: "Satır kaydedilemedi." }
  }

  revalidatePath(`/evrak/alis/${v.evrakId}`)
  return {}
}

export async function kalemSil(kalemId: number): Promise<KalemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("evrak", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let evrakId = 0
  try {
    await prisma.$transaction(async (tx) => {
      const kalem = await tx.evrakKalem.findUnique({
        where: { id: kalemId },
        include: { evrak: { select: { id: true, durum: true, silindi: true } } },
      })
      if (!kalem) throw new BulunamadiHatasi()
      if (kalem.evrak.durum !== "TASLAK") throw new KilitliHatasi()

      evrakId = kalem.evrakId
      await tx.evrakKalem.delete({ where: { id: kalemId } })
      await evrakToplamlariniYenile(tx, evrakId)

      await logKaydet({
        islem: "SIL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "evrak_kalemleri",
        kayitId: kalemId,
        aciklama: kalem.aciklama,
        eskiDeger: kalem,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Satır bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Kesilmiş faturanın satırı silinemez." }
    console.error("Kalem silinemedi:", hata)
    return { hata: "Satır silinemedi." }
  }

  revalidatePath(`/evrak/alis/${evrakId}`)
  return {}
}

// ============================================================================
//  KESİNLEŞTİR / İPTAL / SİL
// ============================================================================

/**
 * Faturayı keser: stok satırları artar (+ stok kartının alış fiyatı
 * güncellenir), tedarikçi cariye borç (bizim tedarikçiye borcumuz —
 * `alacak` alanı) yazılır, kart kilitlenir.
 */
export async function evrakKesinlestir(
  evrakId: number
): Promise<{ hata?: string; bilgi?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("evrak", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let cariId = 0
  try {
    await prisma.$transaction(async (tx) => {
      const evrak = await tx.evrak.findUnique({
        where: { id: evrakId },
        include: { _count: { select: { kalemler: true } } },
      })
      if (!evrak || evrak.silindi) throw new BulunamadiHatasi()
      if (evrak.durum !== "TASLAK") throw new KilitliHatasi()
      if (evrak._count.kalemler === 0) {
        throw new IsKuraliHatasi("Satırı olmayan fatura kesilemez.")
      }

      cariId = evrak.cariId
      const iade = evrak.tur === "IADE_ALIS"
      const toplam = await evrakToplamlariniYenile(tx, evrakId)

      await evrakStoklariniArtir(tx, evrakId, evrak.evrakNo, kullanici.id, iade)

      await tx.evrak.update({
        where: { id: evrakId },
        data: { durum: "KESILDI", guncelleyenId: kullanici.id },
      })

      if (toplam.genelToplam > 0) {
        // İade alışta tedarikçiye ALACAK değil BORÇ yazılır — ona olan
        // borcumuz azalır (malı geri verdik).
        await tx.cariHareket.create({
          data: {
            cari: { connect: { id: evrak.cariId } },
            evrak: { connect: { id: evrakId } },
            tur: "EVRAK",
            borc: iade ? toplam.genelToplam : 0,
            alacak: iade ? 0 : toplam.genelToplam,
            aciklama: `${iade ? "İade faturası" : "Alış faturası"} ${evrak.evrakNo}`,
            olusturanId: kullanici.id,
          },
        })
      }
      await bakiyeyiHesapla(tx, evrak.cariId)

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "evraklar",
        kayitId: evrakId,
        aciklama: `${evrak.evrakNo} kesildi — ${toplam.genelToplam.toFixed(2)} TL`,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Fatura bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Fatura zaten kesilmiş veya iptal edilmiş." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Fatura kesilemedi:", hata)
    return { hata: "Fatura kesilemedi." }
  }

  revalidatePath("/evrak/alis")
  revalidatePath(`/evrak/alis/${evrakId}`)
  revalidatePath(`/cari/${cariId}`)
  revalidatePath("/stok")
  return {}
}

/** Kesilmiş faturayı iptal eder: stok geri alınır, cari borcu kaldırılır. */
export async function evrakIptalEt(evrakId: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("evrak", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let cariId = 0
  try {
    await prisma.$transaction(async (tx) => {
      const evrak = await tx.evrak.findUnique({ where: { id: evrakId } })
      if (!evrak || evrak.silindi) throw new BulunamadiHatasi()
      if (evrak.durum === "IPTAL") throw new KilitliHatasi()

      cariId = evrak.cariId

      if (evrak.durum === "KESILDI") {
        await evrakStoklariniGeriAl(tx, evrakId, evrak.tur === "IADE_ALIS")
        await tx.cariHareket.deleteMany({ where: { evrakId, tur: "EVRAK" } })
        await bakiyeyiHesapla(tx, evrak.cariId)
      }

      // Z3-A (alış tarafı): verilen siparişten kesilmiş faturaysa sevkMiktar'ı
      // ve sipariş durumunu geri al.
      await siparisSevkiniGeriAl(tx, evrakId)

      await tx.evrak.update({
        where: { id: evrakId },
        data: { durum: "IPTAL", guncelleyenId: kullanici.id },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "evraklar",
        kayitId: evrakId,
        aciklama: `${evrak.evrakNo} iptal edildi`,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Fatura bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Fatura zaten iptal edilmiş." }
    console.error("Fatura iptal edilemedi:", hata)
    return { hata: "İptal edilemedi." }
  }

  revalidatePath("/evrak/alis")
  revalidatePath(`/evrak/alis/${evrakId}`)
  revalidatePath(`/cari/${cariId}`)
  revalidatePath("/stok")
  revalidatePath("/siparis/verilen")
  return {}
}

/** Taslak/iptal faturayı siler (soft delete). Kesilmiş fatura önce iptal edilmeli. */
export async function evrakSil(evrakId: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("evrak", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const evrak = await prisma.evrak.findUnique({ where: { id: evrakId } })
  if (!evrak || evrak.silindi) return { hata: "Fatura bulunamadı." }
  if (evrak.durum === "KESILDI") {
    return { hata: "Kesilmiş fatura silinemez; önce iptal edin." }
  }

  await prisma.$transaction(async (tx) => {
    // Z3-A: TASLAK bir sipariş faturası siliniyorsa sevkMiktar hâlâ artmış —
    // geri al. IPTAL durumunda evrakIptalEt zaten yaptı.
    if (evrak.durum === "TASLAK") {
      await siparisSevkiniGeriAl(tx, evrakId)
    }

    await tx.evrak.update({
      where: { id: evrakId },
      data: { silindi: true, silmeTarihi: new Date(), guncelleyenId: kullanici.id },
    })

    await logKaydet({
      islem: "SIL",
      kullaniciId: kullanici.id,
      kullaniciKod: kullanici.kod,
      tablo: "evraklar",
      kayitId: evrakId,
      aciklama: evrak.evrakNo,
    })
  })

  revalidatePath("/evrak/alis")
  if (evrak.siparisId) {
    revalidatePath("/siparis/verilen")
    revalidatePath(`/siparis/verilen/${evrak.siparisId}`)
  }
  return {}
}

// ============================================================================

/** Kalem satırındaki stok arama kutusunu besler — alış fiyatı öneren varyant. */
export async function katalogAraAction(q: string) {
  await yetkiliOturum("evrak", "gor")
  return katalogAraAlis(q)
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}
class KilitliHatasi extends Error {
  constructor() {
    super("Fatura kilitli.")
    this.name = "KilitliHatasi"
  }
}
class IsKuraliHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = "IsKuraliHatasi"
  }
}
