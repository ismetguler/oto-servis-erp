"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  ISCILIK_SATIRLARI,
  ekspertizSemasi,
  kalemlerSemasi,
  panelleriOku,
} from "./sema"
import { panelAdi } from "@/config/arac-panel"
import type { Prisma } from "@/generated/prisma/client"
import { kalemHesapla, kurusaYuvarla } from "@/lib/hesap"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * EKSPERTİZ — server action'lar
 *
 * TEMEL KURAL: Ekspertiz HİÇBİR muhasebe hareketi üretmez. Cari hareketi
 * yok, kasa hareketi yok, stok düşümü yok. Kâğıdın kendi ibaresi "BU
 * EKSPERTİZ BİR ÖN TAHMİNDİR" diyor; onaylanmamış tahminler cari bakiyeye
 * girerse müşteri borcu sahte şişer, mizan ve tahsilat raporları bozulur.
 * Para ancak `kabuleDonustur` ile kabul kartı açıldığında, mevcut kabul
 * akışıyla işler.
 */

export type EkspertizFormDurumu = {
  hata?: string
  alanHatalari?: Record<string, string>
}

class BulunamadiHatasi extends Error {}
class KapaliKartHatasi extends Error {}

/** Kabule dönüşmüş kart kilitlenir — iş emri açıldıktan sonra tahmin değişmez. */
function kilitliMi(durum: string) {
  return durum === "KABULE_DONDU"
}

// ============================================================================
//  KAYDET
// ============================================================================

export async function ekspertizKaydet(
  _oncekiDurum: EkspertizFormDurumu,
  form: FormData
): Promise<EkspertizFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = ekspertizSemasi.safeParse({
    ...Object.fromEntries(form),
    kdvDahilGirilir: form.get("kdvDahilGirilir") === "on",
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

  const kalemCozum = kalemlerSemasi.safeParse({
    kalemAciklama: form.getAll("kalemAciklama").map(String),
    kalemMiktar: form.getAll("kalemMiktar").map(String),
    kalemBirim: form.getAll("kalemBirim").map(String),
    kalemBirimFiyat: form.getAll("kalemBirimFiyat").map(String),
    kalemKdvOrani: form.getAll("kalemKdvOrani").map(String),
  })
  if (!kalemCozum.success) {
    return { hata: kalemCozum.error.issues[0]?.message ?? "Parça satırlarında hata var." }
  }
  const kalemler = kalemCozum.data
  const paneller = panelleriOku(form)

  // Araç ile müşterinin tutarlılığı — kabul ekranındaki kontrolün aynısı.
  const arac = await prisma.arac.findUnique({
    where: { id: v.aracId },
    select: { id: true, silindi: true },
  })
  if (!arac || arac.silindi) {
    return { hata: "Seçilen araç bulunamadı.", alanHatalari: { aracId: "Araç geçersiz." } }
  }
  const cari = await prisma.cari.findUnique({
    where: { id: v.cariId },
    select: { id: true, silindi: true },
  })
  if (!cari || cari.silindi) {
    return { hata: "Seçilen müşteri bulunamadı.", alanHatalari: { cariId: "Cari geçersiz." } }
  }

  const tarihe = (d?: string) => (d ? new Date(`${d}T00:00:00`) : null)

  // --- toplamlar ---
  // Parça satırları kendi KDV oranını taşır; işçilik bloğu tek oran kullanır
  // (matbu formda işçilik satırlarının ayrı KDV sütunu yok).
  let parcaTutar = 0
  let kdvToplam = 0
  const kalemVerileri = kalemler.map((k, sira) => {
    const h = kalemHesapla(
      { miktar: k.miktar, birimFiyat: k.birimFiyat, kdvOrani: k.kdvOrani },
      v.kdvDahilGirilir
    )
    parcaTutar += h.tutar
    kdvToplam += h.kdvTutar
    return {
      sira,
      aciklama: k.aciklama,
      miktar: k.miktar,
      birim: k.birim,
      birimFiyat: k.birimFiyat,
      kdvOrani: k.kdvOrani,
      tutar: h.tutar,
      kdvTutar: h.kdvTutar,
      toplam: h.toplam,
    }
  })

  const iscilikGirilen = ISCILIK_SATIRLARI.reduce(
    (acc, satir) => acc + (v[satir.ad] ?? 0),
    0
  )
  const iscilikHesap = kalemHesapla(
    { miktar: 1, birimFiyat: iscilikGirilen, kdvOrani: v.iscilikKdvOrani },
    v.kdvDahilGirilir
  )

  const parcaToplam = kurusaYuvarla(parcaTutar)
  const iscilikToplam = iscilikHesap.tutar
  const araToplam = kurusaYuvarla(parcaToplam + iscilikToplam)
  const toplamKdv = kurusaYuvarla(kdvToplam + iscilikHesap.kdvTutar)
  const genelToplam = kurusaYuvarla(araToplam + toplamKdv)

  const kartAlanlari = {
    matbuNo: v.matbuNo ?? null,
    durum: v.durum,
    cariId: v.cariId,
    aracId: v.aracId,
    soforTc: v.soforTc ?? null,
    tcKimlikNo: v.tcKimlikNo ?? null,
    karsiAracTel: v.karsiAracTel ?? null,
    karsiAracTc: v.karsiAracTc ?? null,
    policeNo: v.policeNo ?? null,
    dosyaNo: v.dosyaNo ?? null,
    hdNo: v.hdNo ?? null,
    sigortaAdi: v.sigortaAdi ?? null,
    eksperAdi: v.eksperAdi ?? null,
    km: v.km ?? null,
    baslangicTarihi: tarihe(v.baslangicTarihi) ?? new Date(),
    teslimTarihi: tarihe(v.teslimTarihi),
    immobilizer: v.immobilizer ?? null,
    airbag: v.airbag ?? null,
    abs: v.abs ?? null,
    klima: v.klima ?? null,
    stepne: v.stepne ?? null,
    kriko: v.kriko ?? null,
    cdCalar: v.cdCalar ?? null,
    lpg: v.lpg ?? null,
    sunroof: v.sunroof ?? null,
    kaportaIscilik: v.kaportaIscilik,
    boyaIscilik: v.boyaIscilik,
    dosemeIscilik: v.dosemeIscilik,
    mekanikIscilik: v.mekanikIscilik,
    hariciIscilik: v.hariciIscilik,
    elektrikIscilik: v.elektrikIscilik,
    camciIscilik: v.camciIscilik,
    saseIscilik: v.saseIscilik,
    rotBalansIscilik: v.rotBalansIscilik,
    klimaGaziIscilik: v.klimaGaziIscilik,
    iscilikKdvOrani: v.iscilikKdvOrani,
    kdvDahilGirilir: v.kdvDahilGirilir,
    parcaToplam,
    iscilikToplam,
    araToplam,
    kdvToplam: toplamKdv,
    genelToplam,
    notlar: v.notlar ?? null,
  } satisfies Prisma.EkspertizUncheckedUpdateInput

  let kayitId: number
  try {
    kayitId = await prisma.$transaction(async (tx) => {
      let ekspertizId: number

      if (duzenleme) {
        const mevcut = await tx.ekspertiz.findUnique({
          where: { id },
          select: { id: true, durum: true, silindi: true },
        })
        if (!mevcut || mevcut.silindi) throw new BulunamadiHatasi()
        if (kilitliMi(mevcut.durum)) throw new KapaliKartHatasi()

        await tx.ekspertiz.update({
          where: { id },
          data: { ...kartAlanlari, guncelleyenId: kullanici.id },
        })
        ekspertizId = id
      } else {
        const ekspertizNo = await siradakiNumara(tx, "EKSPERTIZ", {
          yilBazli: true,
          varsayilanOnEk: `EKS${new Date().getFullYear()}-`,
          basamak: 5,
        })
        const yeni = await tx.ekspertiz.create({
          data: { ...kartAlanlari, ekspertizNo, olusturanId: kullanici.id },
          select: { id: true },
        })
        ekspertizId = yeni.id
      }

      // Kalemler ve paneller "sil–yeniden yaz": satır sayısı ve sırası
      // serbestçe değişebiliyor, fark hesaplamak sessizce yanlış sonuç
      // verirdi. Stok/muhasebe hareketi üretmedikleri için bu güvenli.
      await tx.ekspertizKalem.deleteMany({ where: { ekspertizId } })
      if (kalemVerileri.length) {
        await tx.ekspertizKalem.createMany({
          data: kalemVerileri.map((k) => ({ ...k, ekspertizId })),
        })
      }

      await tx.ekspertizPanel.deleteMany({ where: { ekspertizId } })
      if (paneller.length) {
        await tx.ekspertizPanel.createMany({
          data: paneller.map((p) => ({ ...p, ekspertizId })),
        })
      }

      return ekspertizId
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) {
      return { hata: "Ekspertiz kaydı bulunamadı; silinmiş olabilir." }
    }
    if (hata instanceof KapaliKartHatasi) {
      return {
        hata: "Kabule dönüştürülmüş ekspertiz düzenlenemez. Değişiklik kabul kartından yapılır.",
      }
    }
    console.error("Ekspertiz kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  await logKaydet({
    islem: duzenleme ? "GUNCELLE" : "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "ekspertizler",
    kayitId,
    aciklama: `Ekspertiz ${duzenleme ? "güncellendi" : "açıldı"} — ${kalemVerileri.length} parça, ${paneller.length} işaretli panel`,
  })

  revalidatePath("/servis/ekspertiz")
  revalidatePath(`/servis/ekspertiz/${kayitId}`)
  redirect(`/servis/ekspertiz/${kayitId}?kaydedildi=1`)
}

// ============================================================================
//  DURUM / SİLME
// ============================================================================

export type IslemDurumu = { hata?: string; bilgi?: string }

export async function ekspertizDurumDegistir(
  id: number,
  yeniDurum: string
): Promise<IslemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  // KABULE_DONDU elle seçilemez: o durum yalnızca gerçekten kabul kartı
  // açıldığında `kabuleDonustur` tarafından yazılır. Elle seçilebilseydi
  // ortada kabul kartı olmadan "dönüştürüldü" görünen kayıtlar olurdu.
  const izinli = ["TASLAK", "GONDERILDI", "ONAYLANDI", "RED"]
  if (!izinli.includes(yeniDurum)) return { hata: "Geçersiz durum." }

  const mevcut = await prisma.ekspertiz.findUnique({
    where: { id },
    select: { durum: true, silindi: true },
  })
  if (!mevcut || mevcut.silindi) return { hata: "Kayıt bulunamadı." }
  if (kilitliMi(mevcut.durum)) {
    return { hata: "Kabule dönüşmüş ekspertizin durumu değiştirilemez." }
  }

  await prisma.ekspertiz.update({
    where: { id },
    data: { durum: yeniDurum as never, guncelleyenId: kullanici.id },
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "ekspertizler",
    kayitId: id,
    aciklama: `Durum: ${mevcut.durum} → ${yeniDurum}`,
  })

  revalidatePath("/servis/ekspertiz")
  revalidatePath(`/servis/ekspertiz/${id}`)
  return { bilgi: "Durum güncellendi." }
}

export async function ekspertizSil(id: number): Promise<IslemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const mevcut = await prisma.ekspertiz.findUnique({
    where: { id },
    select: { durum: true, silindi: true, kabulId: true, ekspertizNo: true },
  })
  if (!mevcut || mevcut.silindi) return { hata: "Kayıt bulunamadı." }
  if (mevcut.kabulId) {
    return {
      hata: "Bu ekspertizden kabul kartı açılmış; silinemez. Önce kabul kartını iptal edin.",
    }
  }

  // Soft delete — projenin her yerindeki davranış: kayıt silinmez,
  // `silindi` işaretlenir, böylece "hangi ekspertiz silinmiş" sorulabilir.
  await prisma.ekspertiz.update({
    where: { id },
    data: { silindi: true, silmeTarihi: new Date(), guncelleyenId: kullanici.id },
  })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "ekspertizler",
    kayitId: id,
    aciklama: `Ekspertiz silindi — ${mevcut.ekspertizNo}`,
  })

  revalidatePath("/servis/ekspertiz")
  return { bilgi: "Ekspertiz silindi." }
}

// ============================================================================
//  KABULE DÖNÜŞTÜR
// ============================================================================

/**
 * Onaylanan ekspertizden araç kabul (iş emri) kartı açar.
 *
 * Teklif → Sipariş akışının kardeşi. Aktarılanlar:
 *  - müşteri, araç, km
 *  - parça satırları → kabul kalemleri (tur = PARCA)
 *  - işçilik kırılımı → TEK satır işçilik kalemi (kaporta/boya/… toplamı)
 *  - şema ve dosya bilgileri → kabul notuna metin olarak
 *
 * Neden işçilik tek satır: kabul kartındaki işçilik kalemleri KATALOGDAN
 * seçilmek zorunda (stok-işlem mantığı buna dayanıyor). Ekspertizdeki 10
 * kırılım serbest tutar, katalog karşılığı yok. Tek "Ekspertiz işçiliği"
 * satırı olarak giriyor, ayrıntı kabul notunda duruyor — usta kalemi
 * kabulde katalogdan yeniden düzenleyebiliyor.
 *
 * Para hareketi BURADA başlar: kabul kartı normal akışın içinde.
 */
export async function kabuleDonustur(id: number): Promise<IslemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let kabulId: number
  try {
    kabulId = await prisma.$transaction(async (tx) => {
      const eks = await tx.ekspertiz.findUnique({
        where: { id },
        include: { kalemler: { orderBy: { sira: "asc" } }, paneller: true },
      })
      if (!eks || eks.silindi) throw new BulunamadiHatasi()
      if (eks.kabulId) throw new KapaliKartHatasi()

      const kabulNo = await siradakiNumara(tx, "KABUL", {
        yilBazli: true,
        varsayilanOnEk: `KB${new Date().getFullYear()}-`,
        basamak: 5,
      })

      const dosyaBilgisi = [
        eks.sigortaAdi ? `Sigorta: ${eks.sigortaAdi}` : null,
        eks.dosyaNo ? `Dosya No: ${eks.dosyaNo}` : null,
        eks.policeNo ? `Poliçe No: ${eks.policeNo}` : null,
        eks.eksperAdi ? `Eksper: ${eks.eksperAdi}` : null,
      ]
        .filter(Boolean)
        .join(" · ")

      // İşçilik kabule TEK satır olarak giriyor (aşağıda); 10'lu kırılım
      // kaybolmasın diye "yapılan işler" notuna metin olarak yazılıyor.
      // Usta hangi kalemin ne kadar tahmin edildiğini kartta görebilsin.
      const iscilikKirilimi = ISCILIK_SATIRLARI.map((satir) => {
        const tutar = Number(eks[satir.ad].toString())
        return tutar > 0 ? `${satir.etiket}: ${tutar.toFixed(2)}` : null
      }).filter(Boolean)

      const panelOzeti = eks.paneller.length
        ? `Ekspertizde işaretli parçalar: ${eks.paneller
            .map((p) => `${panelAdi(p.panelKodu)} (${p.durum})`)
            .join(", ")}`
        : null

      const kabulNotu = [
        iscilikKirilimi.length
          ? `Ekspertiz işçilik tahmini — ${iscilikKirilimi.join(" · ")}`
          : null,
        panelOzeti,
      ]
        .filter(Boolean)
        .join("\n")

      const kabul = await tx.kabul.create({
        data: {
          kabulNo,
          kartTuru: "SİGORTA",
          durum: "ACIK",
          cariId: eks.cariId,
          aracId: eks.aracId,
          girisKm: eks.km,
          evrakKdvOrani: eks.iscilikKdvOrani,
          kdvDahilGirilir: eks.kdvDahilGirilir,
          sikayet: `Ekspertiz ${eks.ekspertizNo} üzerinden açıldı.${dosyaBilgisi ? ` ${dosyaBilgisi}` : ""}`,
          yapilanIsler: kabulNotu || null,
          aracNotlari: eks.notlar,
          tahminiTutar: eks.genelToplam,
          olusturanId: kullanici.id,
        },
        select: { id: true },
      })

      // Parça satırları — ekspertizde katalog zorunluluğu yoktu, bu yüzden
      // stokId boş geçiyor. Kabulde usta satırı katalogla eşleştirecek.
      let sira = 0
      for (const k of eks.kalemler) {
        await tx.kabulKalem.create({
          data: {
            kabulId: kabul.id,
            sira: sira++,
            tur: "PARCA",
            aciklama: k.aciklama,
            miktar: k.miktar,
            birim: k.birim,
            birimFiyat: k.birimFiyat,
            kdvOrani: k.kdvOrani,
            tutar: k.tutar,
            kdvTutar: k.kdvTutar,
            toplam: k.toplam,
          },
        })
      }

      const iscilikTutar = Number(eks.iscilikToplam.toString())
      if (iscilikTutar > 0) {
        const kdvOrani = Number(eks.iscilikKdvOrani.toString())
        const h = kalemHesapla({ miktar: 1, birimFiyat: iscilikTutar, kdvOrani }, false)
        await tx.kabulKalem.create({
          data: {
            kabulId: kabul.id,
            sira: sira++,
            tur: "ISCILIK",
            aciklama: `Ekspertiz işçiliği (${eks.ekspertizNo})`,
            miktar: 1,
            birim: "ADET",
            birimFiyat: iscilikTutar,
            kdvOrani,
            tutar: h.tutar,
            kdvTutar: h.kdvTutar,
            toplam: h.toplam,
          },
        })
      }

      await tx.kabul.update({
        where: { id: kabul.id },
        data: {
          parcaToplam: eks.parcaToplam,
          iscilikToplam: eks.iscilikToplam,
          araToplam: eks.araToplam,
          kdvToplam: eks.kdvToplam,
          genelToplam: eks.genelToplam,
        },
      })

      await tx.ekspertiz.update({
        where: { id },
        data: {
          kabulId: kabul.id,
          durum: "KABULE_DONDU",
          guncelleyenId: kullanici.id,
        },
      })

      return kabul.id
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Ekspertiz bulunamadı." }
    if (hata instanceof KapaliKartHatasi) {
      return { hata: "Bu ekspertizden zaten kabul kartı açılmış." }
    }
    console.error("Ekspertiz kabule dönüştürülemedi:", hata)
    return { hata: "Dönüştürme sırasında beklenmeyen bir hata oluştu." }
  }

  await logKaydet({
    islem: "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    kayitId: kabulId,
    aciklama: `Ekspertiz #${id} kabule dönüştürüldü`,
  })

  revalidatePath("/servis/ekspertiz")
  revalidatePath(`/servis/ekspertiz/${id}`)
  revalidatePath("/servis/kabul")
  redirect(`/servis/kabul/${kabulId}?kaydedildi=1`)
}
