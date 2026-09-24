"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { siparisKalemSemasi, siparisSemasi } from "./sema"
import { siparisToplamlariniYenile } from "./toplam"
import { katalogAra } from "./veri"
import {
  type FaturalanacakSecim,
  SiparisDonusturHatasi,
  siparisiFaturayaDonustur,
} from "@/app/(panel)/siparis/donustur"
import { kalemHesapla } from "@/lib/hesap"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { metniSayiyaCevir } from "@/lib/sayi"
import { YetkiHatasi } from "@/lib/yetki"

export type SiparisFormDurumu = { hata?: string; alanHatalari?: Record<string, string> }
export type KalemDurumu = { hata?: string }
export type DonusturDurumu = { hata?: string }

// ============================================================================
//  SİPARİŞ KARTI — kaydet / durum / sil
// ============================================================================

/** Alınan sipariş kartını kaydeder (yeni veya taslakken güncelleme). */
export async function siparisKaydet(
  _oncekiDurum: SiparisFormDurumu,
  form: FormData
): Promise<SiparisFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("siparis", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = siparisSemasi.safeParse(Object.fromEntries(form))
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
    return { hata: "Seçilen müşteri bulunamadı.", alanHatalari: { cariId: "Cari geçersiz." } }
  }

  const alanlar = {
    tarih: v.tarih ? new Date(`${v.tarih}T00:00:00`) : new Date(),
    teslimTarihi: v.teslimTarihi ? new Date(`${v.teslimTarihi}T00:00:00`) : null,
    aciklama: v.aciklama ?? null,
  }

  let kayitId: number
  try {
    kayitId = await prisma.$transaction(async (tx) => {
      if (duzenleme) {
        const onceki = await tx.siparis.findUnique({ where: { id } })
        if (!onceki || onceki.silindi || onceki.tip !== "ALINAN") throw new BulunamadiHatasi()
        if (onceki.durum !== "TASLAK") throw new KilitliHatasi()

        const siparis = await tx.siparis.update({
          where: { id },
          data: { ...alanlar, cari: { connect: { id: v.cariId } }, guncelleyenId: kullanici.id },
        })

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "siparisler",
          kayitId: siparis.id,
          aciklama: siparis.siparisNo,
          eskiDeger: onceki,
          yeniDeger: siparis,
        })
        return siparis.id
      }

      const siparisNo = await siradakiNumara(tx, "SIPARIS", {
        yilBazli: true,
        varsayilanOnEk: `SP${new Date().getFullYear()}-`,
        basamak: 5,
      })

      const siparis = await tx.siparis.create({
        data: {
          ...alanlar,
          siparisNo,
          tip: "ALINAN",
          cari: { connect: { id: v.cariId } },
          olusturanId: kullanici.id,
        },
      })

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "siparisler",
        kayitId: siparis.id,
        aciklama: siparis.siparisNo,
        yeniDeger: siparis,
      })
      return siparis.id
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Sipariş bulunamadı; silinmiş olabilir." }
    if (hata instanceof KilitliHatasi) {
      return { hata: "Onaylanmış/iptal edilmiş sipariş düzenlenemez." }
    }
    console.error("Sipariş kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/siparis/alinan")
  revalidatePath(`/siparis/alinan/${kayitId}`)
  redirect(`/siparis/alinan/${kayitId}?kaydedildi=1`)
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
    kullanici = await yetkiliOturum("siparis", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = siparisKalemSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Satır bilgileri hatalı." }
  }
  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      const siparis = await tx.siparis.findUnique({
        where: { id: v.siparisId },
        select: { id: true, durum: true, silindi: true },
      })
      if (!siparis || siparis.silindi) throw new BulunamadiHatasi()
      if (siparis.durum !== "TASLAK") throw new KilitliHatasi()

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
        const onceki = await tx.siparisKalem.findUnique({ where: { id: v.id } })
        if (!onceki || onceki.siparisId !== v.siparisId) throw new BulunamadiHatasi()

        await tx.siparisKalem.update({
          where: { id: v.id },
          data: {
            ...alanlar,
            stok: v.stokId ? { connect: { id: v.stokId } } : { disconnect: true },
          },
        })
      } else {
        const sonSira = await tx.siparisKalem.aggregate({
          where: { siparisId: v.siparisId },
          _max: { sira: true },
        })
        await tx.siparisKalem.create({
          data: {
            ...alanlar,
            sira: (sonSira._max.sira ?? 0) + 1,
            siparis: { connect: { id: v.siparisId } },
            ...(v.stokId ? { stok: { connect: { id: v.stokId } } } : {}),
          },
        })
      }

      await siparisToplamlariniYenile(tx, v.siparisId)

      await logKaydet({
        islem: v.id ? "GUNCELLE" : "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "siparis_kalemleri",
        kayitId: v.id ?? 0,
        aciklama: `${v.aciklama} (${v.miktar} × ${v.birimFiyat})`,
        yeniDeger: alanlar,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Satır veya sipariş bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Onaylanmış siparişe satır eklenemez." }
    console.error("Kalem kaydedilemedi:", hata)
    return { hata: "Satır kaydedilemedi." }
  }

  revalidatePath(`/siparis/alinan/${v.siparisId}`)
  return {}
}

export async function kalemSil(kalemId: number): Promise<KalemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("siparis", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let siparisId = 0
  try {
    await prisma.$transaction(async (tx) => {
      const kalem = await tx.siparisKalem.findUnique({
        where: { id: kalemId },
        include: { siparis: { select: { id: true, durum: true, silindi: true } } },
      })
      if (!kalem) throw new BulunamadiHatasi()
      if (kalem.siparis.durum !== "TASLAK") throw new KilitliHatasi()

      siparisId = kalem.siparisId
      await tx.siparisKalem.delete({ where: { id: kalemId } })
      await siparisToplamlariniYenile(tx, siparisId)

      await logKaydet({
        islem: "SIL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "siparis_kalemleri",
        kayitId: kalemId,
        aciklama: kalem.aciklama,
        eskiDeger: kalem,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Satır bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Onaylanmış siparişin satırı silinemez." }
    console.error("Kalem silinemedi:", hata)
    return { hata: "Satır silinemedi." }
  }

  revalidatePath(`/siparis/alinan/${siparisId}`)
  return {}
}

// ============================================================================
//  ONAYLA / İPTAL / SİL
// ============================================================================

/**
 * Siparişi onaylar: kart kilitlenir (satırlar artık değiştirilemez), fakat
 * evrak modülünün aksine STOK ARTMAZ, CARİYE BORÇ YAZILMAZ — bunlar ancak
 * siparişten faturaya dönüştürüldüğünde (adım 9.7) doğar. Onay yalnız
 * "bu sipariş kesinleşti, sevkiyat takibine hazır" anlamına geliyor.
 */
export async function siparisOnayla(siparisId: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("siparis", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const siparis = await tx.siparis.findUnique({
        where: { id: siparisId },
        include: { _count: { select: { kalemler: true } } },
      })
      if (!siparis || siparis.silindi) throw new BulunamadiHatasi()
      if (siparis.durum !== "TASLAK") throw new KilitliHatasi()
      if (siparis._count.kalemler === 0) {
        throw new IsKuraliHatasi("Satırı olmayan sipariş onaylanamaz.")
      }

      await siparisToplamlariniYenile(tx, siparisId)

      await tx.siparis.update({
        where: { id: siparisId },
        data: { durum: "ONAYLANDI", guncelleyenId: kullanici.id },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "siparisler",
        kayitId: siparisId,
        aciklama: `${siparis.siparisNo} onaylandı`,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Sipariş bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Sipariş zaten onaylanmış veya iptal edilmiş." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Sipariş onaylanamadı:", hata)
    return { hata: "Sipariş onaylanamadı." }
  }

  revalidatePath("/siparis/alinan")
  revalidatePath(`/siparis/alinan/${siparisId}`)
  return {}
}

/** Onaylanmış/taslak siparişi iptal eder. Stok/cari hareketi olmadığı için geri alınacak bir şey yok. */
export async function siparisIptalEt(siparisId: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("siparis", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const siparis = await tx.siparis.findUnique({ where: { id: siparisId } })
      if (!siparis || siparis.silindi) throw new BulunamadiHatasi()
      if (siparis.durum === "IPTAL" || siparis.durum === "TAMAMLANDI") throw new KilitliHatasi()

      await tx.siparis.update({
        where: { id: siparisId },
        data: { durum: "IPTAL", guncelleyenId: kullanici.id },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "siparisler",
        kayitId: siparisId,
        aciklama: `${siparis.siparisNo} iptal edildi`,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Sipariş bulunamadı." }
    if (hata instanceof KilitliHatasi) return { hata: "Sipariş zaten iptal/tamamlanmış." }
    console.error("Sipariş iptal edilemedi:", hata)
    return { hata: "İptal edilemedi." }
  }

  revalidatePath("/siparis/alinan")
  revalidatePath(`/siparis/alinan/${siparisId}`)
  return {}
}

/** Taslak/iptal siparişi siler (soft delete). Onaylanmış sipariş önce iptal edilmeli. */
export async function siparisSil(siparisId: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("siparis", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const siparis = await prisma.siparis.findUnique({ where: { id: siparisId } })
  if (!siparis || siparis.silindi) return { hata: "Sipariş bulunamadı." }
  if (siparis.durum === "ONAYLANDI" || siparis.durum === "KISMI_SEVK" || siparis.durum === "TAMAMLANDI") {
    return { hata: "Onaylanmış sipariş silinemez; önce iptal edin." }
  }

  await prisma.siparis.update({
    where: { id: siparisId },
    data: { silindi: true, silmeTarihi: new Date(), guncelleyenId: kullanici.id },
  })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "siparisler",
    kayitId: siparisId,
    aciklama: siparis.siparisNo,
  })

  revalidatePath("/siparis/alinan")
  return {}
}

// ============================================================================
//  FATURAYA DÖNÜŞTÜRME (adım 9.7)
// ============================================================================

/**
 * Seçilen satırları/miktarları satış faturasına (TASLAK) dönüştürür — ortak
 * mantık `siparis/donustur.ts`'te. Kısmi sevkiyat: her satır için ayrı
 * miktar girilebilir (form alanı `miktar_<kalemId>`), kalanı aşamaz.
 */
export async function alinanFaturayaDonustur(
  _oncekiDurum: DonusturDurumu,
  form: FormData
): Promise<DonusturDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("siparis", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const siparisId = Number(form.get("siparisId"))
  if (!Number.isInteger(siparisId) || siparisId <= 0) return { hata: "Geçersiz sipariş." }

  const evrakNo = String(form.get("evrakNo") ?? "").trim()
  if (!evrakNo) return { hata: "Fatura no zorunlu." }
  if (evrakNo.length > 40) return { hata: "Fatura no en fazla 40 karakter olabilir." }

  const tarihMetni = String(form.get("tarih") ?? "").trim()
  const vadeMetni = String(form.get("vadeTarihi") ?? "").trim()
  const aciklama = String(form.get("aciklama") ?? "").trim() || null

  const secimler: FaturalanacakSecim[] = []
  for (const [anahtar, deger] of form.entries()) {
    if (!anahtar.startsWith("miktar_")) continue
    const kalemId = Number(anahtar.slice("miktar_".length))
    const miktar = metniSayiyaCevir(String(deger))
    if (Number.isInteger(kalemId) && Number.isFinite(miktar) && miktar > 0) {
      secimler.push({ siparisKalemId: kalemId, miktar })
    }
  }

  let evrakId: number
  try {
    evrakId = await prisma.$transaction(
      async (tx) => {
        const id = await siparisiFaturayaDonustur(tx, {
          siparisId,
          beklenenTip: "ALINAN",
          evrakTur: "SATIS",
          evrakNo,
          tarih: tarihMetni ? new Date(`${tarihMetni}T00:00:00`) : new Date(),
          vadeTarihi: vadeMetni ? new Date(`${vadeMetni}T00:00:00`) : null,
          aciklama,
          secimler,
          kullaniciId: kullanici.id,
        })

        await logKaydet({
          islem: "EKLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "evraklar",
          kayitId: id,
          aciklama: `${evrakNo} — sipariş #${siparisId}'den dönüştürüldü`,
        })
        return id
      },
      { timeout: 20_000, maxWait: 10_000 }
    )
  } catch (hata) {
    if (hata instanceof SiparisDonusturHatasi) return { hata: hata.message }
    if (hata instanceof Error && hata.message.includes("Unique constraint")) {
      return { hata: "Bu fatura no zaten kullanılmış." }
    }
    console.error("Sipariş faturaya dönüştürülemedi:", hata)
    return { hata: "Dönüştürme sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/siparis/alinan")
  revalidatePath(`/siparis/alinan/${siparisId}`)
  revalidatePath("/evrak/satis")
  redirect(`/evrak/satis/${evrakId}?donusturuldu=1`)
}

// ============================================================================

/** Kalem satırındaki stok arama kutusunu besler — satış fiyatını öneren varyant. */
export async function katalogAraAction(q: string) {
  await yetkiliOturum("siparis", "gor")
  return katalogAra("PARCA", q)
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}
class KilitliHatasi extends Error {
  constructor() {
    super("Sipariş kilitli.")
    this.name = "KilitliHatasi"
  }
}
class IsKuraliHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = "IsKuraliHatasi"
  }
}
