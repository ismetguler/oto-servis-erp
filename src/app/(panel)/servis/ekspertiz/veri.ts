import "server-only"

import type { PanelDurumKodu } from "@/config/arac-panel"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * EKSPERTİZ — veri okuma katmanı
 *
 * Kabul modülündeki `veri.ts` ile aynı görevi görüyor: sayfalar doğrudan
 * Prisma çağırmıyor, sorgu burada tek yerde duruyor.
 */

/**
 * `<input type="date">` "YYYY-MM-DD" ister — YEREL güne göre.
 *
 * `toISOString()` KULLANILAMAZ: UTC'ye çevirir. Kayıt `new Date("...T00:00:00")`
 * ile yerel gece yarısı olarak yazılıyor; Türkiye UTC+3 olduğu için bu, UTC'de
 * bir önceki günün 21:00'ı oluyor. Forma UTC günü basılsaydı düzenleme ekranı
 * tarihi bir gün geri gösterir, kullanıcı dokunmadan kaydettiğinde tarih
 * gerçekten bir gün geri kayardı — her düzenlemede bir gün daha.
 * (Testte yakalandı: 21.09 girildi, ikinci kayıtta 19.09'a düşmüştü.)
 */
const gun = (d: Date | null) => {
  if (!d) return null
  const yil = d.getFullYear()
  const ay = String(d.getMonth() + 1).padStart(2, "0")
  const gunNo = String(d.getDate()).padStart(2, "0")
  return `${yil}-${ay}-${gunNo}`
}

/** Decimal alanları forma/ekrana verirken düz sayıya çevirir. */
const sayi = (d: Prisma.Decimal) => Number(d.toString())

/** Müşteri seçimi — personel kayıtları listeye girmez. */
export async function ekspertizCarileriGetir() {
  return prisma.cari.findMany({
    where: { silindi: false, turu: { not: "PERSONEL" } },
    orderBy: { unvan: "asc" },
    select: {
      id: true,
      kod: true,
      unvan: true,
      telefon: true,
      gsm: true,
      vergiNo: true, // VKN veya TCKN — cari kartinda tek alan
    },
  })
}

export type EkspertizCarisi = Awaited<
  ReturnType<typeof ekspertizCarileriGetir>
>[number]

/**
 * Araç seçimi. Araç seçilince plaka/marka/model/km formda anında dolsun
 * diye görüntülenecek alanlar baştan çekiliyor — her seçimde sunucuya
 * gitmeye gerek kalmıyor (kabul ekranındaki davranışın aynısı).
 */
export async function ekspertizAraclariGetir() {
  return prisma.arac.findMany({
    where: { silindi: false, aktif: true },
    orderBy: { plaka: "asc" },
    select: {
      id: true,
      plaka: true,
      cariId: true,
      marka: true,
      model: true,
      modelYili: true,
      saseNo: true,
      aracTuru: true,
      kasaTipi: true,
      sonKm: true,
    },
  })
}

export type EkspertizAraci = Awaited<
  ReturnType<typeof ekspertizAraclariGetir>
>[number]

// ============================================================================
//  TEK KAYIT
// ============================================================================

/** Form ve detay ekranının ihtiyaç duyduğu tam kayıt. */
export async function ekspertizGetir(id: number) {
  const kayit = await prisma.ekspertiz.findUnique({
    where: { id },
    include: {
      cari: { select: { id: true, kod: true, unvan: true, telefon: true, gsm: true } },
      arac: {
        select: {
          id: true,
          plaka: true,
          marka: true,
          model: true,
          modelYili: true,
          saseNo: true,
          kasaTipi: true,
          aracTuru: true,
        },
      },
      kabul: { select: { id: true, kabulNo: true } },
      kalemler: { orderBy: { sira: "asc" } },
      paneller: true,
    },
  })

  if (!kayit || kayit.silindi) return null

  return {
    ...kayit,
    baslangicTarihiGun: gun(kayit.baslangicTarihi),
    teslimTarihiGun: gun(kayit.teslimTarihi),
    kaportaIscilik: sayi(kayit.kaportaIscilik),
    boyaIscilik: sayi(kayit.boyaIscilik),
    dosemeIscilik: sayi(kayit.dosemeIscilik),
    mekanikIscilik: sayi(kayit.mekanikIscilik),
    hariciIscilik: sayi(kayit.hariciIscilik),
    elektrikIscilik: sayi(kayit.elektrikIscilik),
    camciIscilik: sayi(kayit.camciIscilik),
    saseIscilik: sayi(kayit.saseIscilik),
    rotBalansIscilik: sayi(kayit.rotBalansIscilik),
    klimaGaziIscilik: sayi(kayit.klimaGaziIscilik),
    iscilikKdvOrani: sayi(kayit.iscilikKdvOrani),
    parcaToplam: sayi(kayit.parcaToplam),
    iscilikToplam: sayi(kayit.iscilikToplam),
    araToplam: sayi(kayit.araToplam),
    kdvToplam: sayi(kayit.kdvToplam),
    genelToplam: sayi(kayit.genelToplam),
    kalemler: kayit.kalemler.map((k) => ({
      ...k,
      miktar: sayi(k.miktar),
      birimFiyat: sayi(k.birimFiyat),
      kdvOrani: sayi(k.kdvOrani),
      tutar: sayi(k.tutar),
      kdvTutar: sayi(k.kdvTutar),
      toplam: sayi(k.toplam),
    })),
    /** Şema bileşeninin beklediği biçim: { panelKodu: durum }. */
    panelSecimi: Object.fromEntries(
      kayit.paneller.map((p) => [p.panelKodu, p.durum as PanelDurumKodu])
    ),
  }
}

export type EkspertizKaydi = NonNullable<Awaited<ReturnType<typeof ekspertizGetir>>>

// ============================================================================
//  LİSTE
// ============================================================================

export type EkspertizFiltresi = {
  arama?: string
  durum?: string
  baslangic?: string
  bitis?: string
  sayfa?: number
}

const SAYFA_BOYU = 50

export async function ekspertizleriGetir(filtre: EkspertizFiltresi) {
  const kosullar: Prisma.EkspertizWhereInput[] = [{ silindi: false }]

  if (filtre.durum && filtre.durum !== "hepsi") {
    kosullar.push({ durum: filtre.durum as Prisma.EnumEkspertizDurumFilter["equals"] })
  }

  // Tarih aralığı giriş (başlangıç) tarihine göre süzülür — kâğıttaki
  // "Başlangıç Tarihi" alanı, ekspertizin yapıldığı gün.
  if (filtre.baslangic) {
    kosullar.push({ baslangicTarihi: { gte: new Date(`${filtre.baslangic}T00:00:00`) } })
  }
  if (filtre.bitis) {
    kosullar.push({ baslangicTarihi: { lte: new Date(`${filtre.bitis}T23:59:59`) } })
  }

  // Arama: ekspertiz no, matbu no, dosya/poliçe no, plaka, müşteri ünvanı.
  // Sigorta işlerinde aranan şey çoğu zaman DOSYA NUMARASI oluyor.
  const arama = filtre.arama?.trim()
  if (arama) {
    kosullar.push({
      OR: [
        ...aramaKosullari(["ekspertizNo", "matbuNo", "dosyaNo", "policeNo", "sigortaAdi"], arama),
        { arac: { OR: aramaKosullari(["plaka", "saseNo"], arama) } },
        { cari: { OR: aramaKosullari(["unvan", "kod"], arama) } },
      ],
    })
  }

  const where: Prisma.EkspertizWhereInput = { AND: kosullar }
  const sayfa = Math.max(1, filtre.sayfa ?? 1)

  const [kayitlar, toplam] = await Promise.all([
    prisma.ekspertiz.findMany({
      where,
      orderBy: { baslangicTarihi: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        ekspertizNo: true,
        matbuNo: true,
        durum: true,
        baslangicTarihi: true,
        dosyaNo: true,
        sigortaAdi: true,
        genelToplam: true,
        kabulId: true,
        kabul: { select: { kabulNo: true } },
        cari: { select: { unvan: true } },
        arac: { select: { plaka: true, marka: true, model: true } },
        _count: { select: { paneller: true, kalemler: true } },
      },
    }),
    prisma.ekspertiz.count({ where }),
  ])

  return {
    kayitlar: kayitlar.map((k) => ({ ...k, genelToplam: sayi(k.genelToplam) })),
    toplam,
    sayfa,
    sayfaBoyu: SAYFA_BOYU,
  }
}

export type EkspertizSatiri = Awaited<
  ReturnType<typeof ekspertizleriGetir>
>["kayitlar"][number]
