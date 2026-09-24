"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { kabulKalemleriniKopyala } from "./kabul-donustur"
import { evrakKalemSemasi, evrakSemasi } from "./sema"
import {
  evrakStoklariniDus,
  evrakStoklariniGeriYukle,
  evrakToplamlariniYenile,
} from "./stok-islem"
import { katalogAra } from "./veri"
import { bakiyeyiHesapla } from "@/app/(panel)/cari/actions"
import { siparisSevkiniGeriAl } from "@/app/(panel)/siparis/donustur"
import { tahsilatEtkisiniUygula } from "@/app/(panel)/tahsilat/actions"
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

/** Satış faturası kartını kaydeder (yeni veya taslakken güncelleme). */
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
    return { hata: "Seçilen müşteri bulunamadı.", alanHatalari: { cariId: "Cari geçersiz." } }
  }

  /**
   * Kabulden dönüştürme (adım 9.2): kabul bağı YALNIZ yeni faturada
   * kurulur. Düzenleme ekranında forma kabulId hiç basılmıyor; buraya
   * yine de gelirse sessizce yok sayılıyor (bağ sonradan değişmemeli).
   */
  const kabulId = duzenleme ? undefined : v.kabulId
  let kabulKdvDahil = false
  if (kabulId) {
    const kabul = await prisma.kabul.findUnique({
      where: { id: kabulId },
      select: {
        silindi: true,
        durum: true,
        cariId: true,
        kdvDahilGirilir: true,
        _count: { select: { kalemler: true } },
      },
    })
    if (!kabul || kabul.silindi) return { hata: "Kabul kartı bulunamadı." }
    // Teslim edilmemiş kartın satırları hâlâ değişebilir; faturası kesilirse
    // stok/cari tarafı kartla ayrışır. Kabul kartındaki "önce kapat, sonra
    // faturala" ilkesi burada da geçerli.
    if (kabul.durum !== "TESLIM_EDILDI") {
      return { hata: "Yalnız teslim edilmiş kabul kartı faturaya dönüştürülebilir." }
    }
    if (kabul._count.kalemler === 0) return { hata: "Satırı olmayan kabul kartı faturalanamaz." }
    if (kabul.cariId !== v.cariId) {
      return {
        hata: "Fatura, kabul kartının carisine kesilmelidir.",
        alanHatalari: { cariId: "Kabul kartının carisiyle aynı olmalı." },
      }
    }
    const mevcut = await prisma.evrak.findFirst({
      where: { kabulId, silindi: false, durum: { not: "IPTAL" } },
      select: { evrakNo: true },
    })
    if (mevcut) return { hata: `Bu kabul kartı zaten faturalanmış (${mevcut.evrakNo}).` }
    kabulKdvDahil = kabul.kdvDahilGirilir
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
        if (!onceki || onceki.silindi || (onceki.tur !== "SATIS" && onceki.tur !== "IADE_SATIS")) {
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
          tur: v.iade ? "IADE_SATIS" : "SATIS",
          cari: { connect: { id: v.cariId } },
          ...(kabulId ? { kabul: { connect: { id: kabulId } } } : {}),
          olusturanId: kullanici.id,
        },
      })

      if (kabulId) {
        await kabulKalemleriniKopyala(tx, kabulId, evrak.id, kabulKdvDahil)
        await evrakToplamlariniYenile(tx, evrak.id)
      }

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

  revalidatePath("/evrak/satis")
  revalidatePath(`/evrak/satis/${kayitId}`)
  redirect(`/evrak/satis/${kayitId}?kaydedildi=1`)
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

  revalidatePath(`/evrak/satis/${v.evrakId}`)
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

  revalidatePath(`/evrak/satis/${evrakId}`)
  return {}
}

// ============================================================================
//  KESİNLEŞTİR / İPTAL / SİL
// ============================================================================

/**
 * Faturayı keser: stok satırları düşer, cariye borç yazılır, kart kilitlenir.
 * Kabul kartındaki "teslim" akışıyla aynı ilke — geri almak için `evrakIptalEt`.
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
  let bagliKabulId: number | null = null
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
      bagliKabulId = evrak.kabulId
      const iade = evrak.tur === "IADE_SATIS"
      const toplam = await evrakToplamlariniYenile(tx, evrakId)

      /**
       * ÇİFT STOK DÜŞÜMÜ ENGELİ (adım 9.2): kabulden dönüştürülen faturanın
       * parçaları, kabul kartına satır eklenirken ZATEN stoktan çıkmıştı
       * (`kabul/stok-islem.ts` → `stokCikisiYaz`). Burada ikinci kez
       * düşülseydi ambar her serviste bir kat daha eksiye giderdi. Serbest
       * (kabulsüz) faturada stok yalnızca burada düşer.
       */
      if (!evrak.kabulId) {
        await evrakStoklariniDus(tx, evrakId, evrak.evrakNo, kullanici.id, iade)
      }

      await tx.evrak.update({
        where: { id: evrakId },
        data: { durum: "KESILDI", guncelleyenId: kullanici.id },
      })

      /**
       * ÇİFT BORÇ ENGELİ (adım 9.2): araç teslim edilirken cariye zaten
       * `KABUL` türü bir borç hareketi yazılmıştı. Aynı iş ikinci kez
       * borçlandırılmasın diye o hareket SİLİNİR, yerine `EVRAK` hareketi
       * geçer — ekstrede iş tek satır olarak, artık fatura numarasıyla
       * görünür. Fatura iptal edilirse kabul borcu geri yazılıyor
       * (`evrakIptalEt`), yani hareket kaybolmuyor, sahibi değişiyor.
       */
      if (evrak.kabulId) {
        await tx.cariHareket.deleteMany({ where: { kabulId: evrak.kabulId, tur: "KABUL" } })
        await tx.kabul.update({
          where: { id: evrak.kabulId },
          data: { faturaKesildi: true, guncelleyenId: kullanici.id },
        })
      }

      if (toplam.genelToplam > 0) {
        // İade satışta cariye BORÇ değil ALACAK yazılır — müşteriden olan
        // alacağımız azalır (mal geri geldi).
        await tx.cariHareket.create({
          data: {
            cari: { connect: { id: evrak.cariId } },
            evrak: { connect: { id: evrakId } },
            tur: "EVRAK",
            borc: iade ? 0 : toplam.genelToplam,
            alacak: iade ? toplam.genelToplam : 0,
            aciklama: `${iade ? "İade faturası" : "Satış faturası"} ${evrak.evrakNo}`,
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

  revalidatePath("/evrak/satis")
  revalidatePath(`/evrak/satis/${evrakId}`)
  revalidatePath(`/cari/${cariId}`)
  revalidatePath("/stok")
  if (bagliKabulId) {
    revalidatePath("/servis/kabul")
    revalidatePath(`/servis/kabul/${bagliKabulId}`)
    return {
      bilgi:
        "Fatura kesildi. Parçalar kabul kartında zaten stoktan düşüldüğü için " +
        "stoğa yeniden dokunulmadı; cari borcu kabulden faturaya devredildi.",
    }
  }
  return {}
}

/** Kesilmiş faturayı iptal eder: stok geri yüklenir, cari borcu kaldırılır. */
export async function evrakIptalEt(evrakId: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("evrak", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let cariId = 0
  let bagliKabulId: number | null = null
  try {
    await prisma.$transaction(async (tx) => {
      const evrak = await tx.evrak.findUnique({ where: { id: evrakId } })
      if (!evrak || evrak.silindi) throw new BulunamadiHatasi()
      if (evrak.durum === "IPTAL") throw new KilitliHatasi()

      cariId = evrak.cariId
      bagliKabulId = evrak.kabulId

      if (evrak.durum === "KESILDI") {
        // Kabul kaynaklı faturada kesinleştirmede hiç stok hareketi
        // yazılmadığı için bu çağrı orada zaten boş geçiyor (stok kabule ait).
        // İade satış faturası stoğa GİRİŞ yazmıştı; geri alırken o yön kullanılır.
        await evrakStoklariniGeriYukle(tx, evrakId, evrak.tur === "IADE_SATIS")
        await tx.cariHareket.deleteMany({ where: { evrakId, tur: "EVRAK" } })

        /**
         * Hızlı satış (PERAKENDE) faturası kesilirken otomatik bir tahsilat
         * fişi de açılmıştı (`evrak/hizli-satis/actions.ts`). Fatura iptal
         * edilince o fiş de geri alınmalı — yoksa kasa girişi ve cariye yazılan
         * alacak (avans) yetim kalır, kasa/cari bakiyesi şişik durur.
         */
        if (evrak.tur === "PERAKENDE") {
          const fis = await tx.tahsilat.findFirst({
            where: { evrakId, silindi: false },
            select: { id: true },
          })
          if (fis) await tahsilatEtkisiniUygula(tx, fis.id, true, kullanici)
        }

        /**
         * Kabul borcunu geri yaz: fatura kesilirken kabulün `KABUL` hareketi
         * silinmişti. İptalde geri yazılmazsa yapılan iş cari ekstreden
         * TAMAMEN kaybolur (araç teslim edilmiş, borç yok) — kabul kartı
         * yeniden faturalanabilir duruma dönerken borç da yerine dönmeli.
         */
        if (evrak.kabulId) {
          const kabul = await tx.kabul.findUnique({
            where: { id: evrak.kabulId },
            select: {
              kabulNo: true,
              durum: true,
              silindi: true,
              genelToplam: true,
              teslimTarihi: true,
            },
          })
          const kabulToplam = Number((kabul?.genelToplam ?? 0).toString())
          if (kabul && !kabul.silindi && kabul.durum === "TESLIM_EDILDI" && kabulToplam > 0) {
            await tx.cariHareket.create({
              data: {
                cari: { connect: { id: evrak.cariId } },
                kabul: { connect: { id: evrak.kabulId } },
                tur: "KABUL",
                // Hareketin tarihi iptal günü değil, aracın teslim tarihi
                // olmalı — ekstre kronolojik sırasını korusun diye.
                tarih: kabul.teslimTarihi ?? undefined,
                borc: kabulToplam,
                aciklama: `Servis kabul ${kabul.kabulNo}`,
                olusturanId: kullanici.id,
              },
            })
          }
          await tx.kabul.update({
            where: { id: evrak.kabulId },
            data: { faturaKesildi: false, guncelleyenId: kullanici.id },
          })
        }

        await bakiyeyiHesapla(tx, evrak.cariId)
      }

      // Z3-A: bir siparişten kesilmiş faturaysa, sipariş satırlarının
      // sevkMiktar'ını ve durumunu geri al — yoksa sipariş "Tamamlandı"
      // yetim kalır, yeniden faturalanamaz/silinemez. TASLAK aşamada da
      // sevkMiktar artmış olabilir (dönüştürme onu TASLAK evrakta yapıyor).
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

  revalidatePath("/evrak/satis")
  revalidatePath(`/evrak/satis/${evrakId}`)
  revalidatePath(`/cari/${cariId}`)
  revalidatePath("/stok")
  revalidatePath("/tahsilat")
  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  revalidatePath("/siparis/alinan")
  if (bagliKabulId) {
    revalidatePath("/servis/kabul")
    revalidatePath(`/servis/kabul/${bagliKabulId}`)
  }
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
    // Z3-A: TASLAK bir sipariş faturası siliniyorsa sevkMiktar hâlâ artmış
    // durumda (dönüştürme onu TASLAK evrakta yapıyor) — geri al. IPTAL
    // durumunda bu zaten evrakIptalEt sırasında yapıldı, tekrarlama.
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

  revalidatePath("/evrak/satis")
  if (evrak.siparisId) {
    revalidatePath("/siparis/alinan")
    revalidatePath(`/siparis/alinan/${evrak.siparisId}`)
  }
  return {}
}

// ============================================================================

/** Kalem satırındaki stok arama kutusunu besler — kabuldeki katalog araması yeniden kullanılıyor. */
export async function katalogAraAction(q: string) {
  await yetkiliOturum("evrak", "gor")
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
