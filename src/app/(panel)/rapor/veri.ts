import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { StokHareketTur } from "@/generated/prisma/enums"

import { HAREKET_TUR_ADI, hareketYonu } from "../stok/hareket/veri"
import { gunBasi, gunSonu, sayi } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * RAPORLAR — ORTAK TARİH FİLTRESİ (ADIM 10)
 *
 * 10.1'in üç raporu da (Servis Gün Sonu, Günlük İcmal, Onarım Kârlılık)
 * aynı tarih aralığını okuyor — tekilleştirilmiş yardımcılar burada.
 */

export type RaporTarihFiltreleri = { bas?: string; bit?: string }

/**
 * Stok hareketinin tutarı — HAFIZA 84 öncesi yazılan evrak kaynaklı bazı
 * StokHareket satırlarında `tutar` alanı 0 kalmış (ekranda `kalemHesapla`
 * ile canlı hesaplandığı için fark edilmemişti). Bu yüzden ham `tutar`'a
 * güvenen raporlar (En Çok Kullanılan Parça, Giriş-Çıkış Analizi) Stok
 * Kâr-Zarar ile tutmuyordu (DEMO-HAZIRLIK 🟡-2). Kalıcı çözüm: tutar 0/null
 * ise `miktar × birimFiyat`'a düş.
 */
function hareketTutari(h: {
  tutar: Prisma.Decimal | number | null
  miktar: Prisma.Decimal | number | null
  birimFiyat: Prisma.Decimal | number | null
}): number {
  const t = sayi(h.tutar)
  return t !== 0 ? t : sayi(h.miktar) * sayi(h.birimFiyat)
}

/** Varsayılan aralık: içinde bulunulan ay (tahsilat/personel raporlarıyla aynı desen). */
export function varsayilanRaporAraligi() {
  const bugun = new Date()
  const ilk = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
  const bicim = (g: Date) =>
    `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`
  return { bas: bicim(ilk), bit: bicim(bugun) }
}

export function raporAraligi(f: RaporTarihFiltreleri) {
  const bas = f.bas ? gunBasi(new Date(`${f.bas}T00:00:00`)) : gunBasi()
  const bit = f.bit ? gunSonu(new Date(`${f.bit}T00:00:00`)) : gunSonu()
  return { bas, bit }
}

export function raporSorgusu(f: RaporTarihFiltreleri): string {
  const p = new URLSearchParams()
  if (f.bas) p.set("bas", f.bas)
  if (f.bit) p.set("bit", f.bit)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

/** [bas, bit] aralığındaki her takvim gününü, en yeni en üstte olacak şekilde döndürür. */
function gunListesi(bas: Date, bit: Date): Date[] {
  const gunler: Date[] = []
  const gezici = gunBasi(bas)
  while (gezici <= bit) {
    gunler.push(new Date(gezici))
    gezici.setDate(gezici.getDate() + 1)
  }
  return gunler.reverse()
}

function gunAnahtari(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ============================================================================
//  10.1.a SERVİS GÜN SONU
// ============================================================================

export type GunSonuSatiri = {
  gun: Date
  acilanKabul: number
  teslimEdilenKabul: number
  parcaToplam: number
  iscilikToplam: number
  genelToplam: number
  tahsilat: number
}

/**
 * Gün bazında servis faaliyeti: o gün açılan kart sayısı, o gün TESLİM
 * EDİLEN kartların iş tutarı ve o kartlara bağlı tahsilat. "Kapanan iş"
 * teslim tarihine göre sayılır — açılış günü henüz tutar kesinleşmemiş
 * olabilir (kalemler sonradan eklenir).
 */
export async function gunSonuVerisi(f: RaporTarihFiltreleri): Promise<GunSonuSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const [acilanlar, teslimEdilenler, tahsilatlar] = await Promise.all([
    prisma.kabul.findMany({
      where: { silindi: false, girisTarihi: { gte: bas, lte: bit } },
      select: { girisTarihi: true },
    }),
    prisma.kabul.findMany({
      where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
      select: { teslimTarihi: true, parcaToplam: true, iscilikToplam: true, genelToplam: true },
    }),
    prisma.tahsilat.findMany({
      where: {
        silindi: false,
        tur: "TAHSILAT",
        kabulId: { not: null },
        tarih: { gte: bas, lte: bit },
      },
      select: { tarih: true, tutar: true },
    }),
  ])

  const satirlar = new Map<string, GunSonuSatiri>()
  for (const gun of gunListesi(bas, bit)) {
    satirlar.set(gunAnahtari(gun), {
      gun,
      acilanKabul: 0,
      teslimEdilenKabul: 0,
      parcaToplam: 0,
      iscilikToplam: 0,
      genelToplam: 0,
      tahsilat: 0,
    })
  }

  for (const k of acilanlar) {
    const satir = satirlar.get(gunAnahtari(k.girisTarihi))
    if (satir) satir.acilanKabul += 1
  }
  for (const k of teslimEdilenler) {
    if (!k.teslimTarihi) continue
    const satir = satirlar.get(gunAnahtari(k.teslimTarihi))
    if (!satir) continue
    satir.teslimEdilenKabul += 1
    satir.parcaToplam += sayi(k.parcaToplam)
    satir.iscilikToplam += sayi(k.iscilikToplam)
    satir.genelToplam += sayi(k.genelToplam)
  }
  for (const t of tahsilatlar) {
    const satir = satirlar.get(gunAnahtari(t.tarih))
    if (satir) satir.tahsilat += sayi(t.tutar)
  }

  return [...satirlar.values()]
}

// ============================================================================
//  10.1.b GÜNLÜK İCMAL
// ============================================================================

export type IcmalSatiri = {
  gun: Date
  acilanKabul: number
  teslimEdilenKabul: number
  kesilenFatura: number
  faturaToplam: number
  tahsilat: number
  tediye: number
}

/**
 * Servis Gün Sonu'ndan farkı: tek bir kartın kapanışına değil, o GÜN
 * işletmede olan biten HER ŞEYE bakar — açılan/teslim edilen kart, kesilen
 * fatura (servis + satış + perakende) ve kasaya giren/çıkan para. Selpar'da
 * "Günlük İcmal" dashboard'daki günlük faaliyet raporunun dökümü.
 */
export async function icmalVerisi(f: RaporTarihFiltreleri): Promise<IcmalSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const [acilanlar, teslimEdilenler, faturalar, tahsilatlar, tediyeler] = await Promise.all([
    prisma.kabul.findMany({
      where: { silindi: false, girisTarihi: { gte: bas, lte: bit } },
      select: { girisTarihi: true },
    }),
    prisma.kabul.findMany({
      where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
      select: { teslimTarihi: true },
    }),
    prisma.evrak.findMany({
      where: {
        silindi: false,
        durum: "KESILDI",
        tur: { in: ["SERVIS", "SATIS", "PERAKENDE"] },
        tarih: { gte: bas, lte: bit },
      },
      select: { tarih: true, genelToplam: true },
    }),
    prisma.tahsilat.findMany({
      where: { silindi: false, tur: "TAHSILAT", tarih: { gte: bas, lte: bit } },
      select: { tarih: true, tutar: true },
    }),
    prisma.tahsilat.findMany({
      where: { silindi: false, tur: "TEDIYE", tarih: { gte: bas, lte: bit } },
      select: { tarih: true, tutar: true },
    }),
  ])

  const satirlar = new Map<string, IcmalSatiri>()
  for (const gun of gunListesi(bas, bit)) {
    satirlar.set(gunAnahtari(gun), {
      gun,
      acilanKabul: 0,
      teslimEdilenKabul: 0,
      kesilenFatura: 0,
      faturaToplam: 0,
      tahsilat: 0,
      tediye: 0,
    })
  }

  for (const k of acilanlar) {
    const satir = satirlar.get(gunAnahtari(k.girisTarihi))
    if (satir) satir.acilanKabul += 1
  }
  for (const k of teslimEdilenler) {
    if (!k.teslimTarihi) continue
    const satir = satirlar.get(gunAnahtari(k.teslimTarihi))
    if (satir) satir.teslimEdilenKabul += 1
  }
  for (const e of faturalar) {
    const satir = satirlar.get(gunAnahtari(e.tarih))
    if (!satir) continue
    satir.kesilenFatura += 1
    satir.faturaToplam += sayi(e.genelToplam)
  }
  for (const t of tahsilatlar) {
    const satir = satirlar.get(gunAnahtari(t.tarih))
    if (satir) satir.tahsilat += sayi(t.tutar)
  }
  for (const t of tediyeler) {
    const satir = satirlar.get(gunAnahtari(t.tarih))
    if (satir) satir.tediye += sayi(t.tutar)
  }

  return [...satirlar.values()]
}

// ============================================================================
//  10.1.c ONARIM KÂRLILIK
// ============================================================================

export type KarlilikSatiri = {
  id: number
  kabulNo: string
  teslimTarihi: Date | null
  plaka: string
  musteri: string
  parcaSatis: number
  parcaMaliyet: number
  parcaKar: number
  iscilikGeliri: number
  disHizmetToplam: number
  toplamKar: number
  karOrani: number
  genelToplam: number
}

/**
 * Kabul kartı başına kâr: parça satışından o parçanın GÜNCEL ortalama
 * maliyeti düşülür (kalem yazıldığı andaki maliyet ayrıca tutulmuyor —
 * bkz. HAFIZA 10.1). İşçilik satırının maliyeti yok, tamamı kâr sayılır.
 * Dış hizmet ayrı sütunda gösterilir ama kâra KATILMAZ: yaptıran firmaya
 * ne kadara mal olduğu sistemde tutulmuyor, kâra dahil etmek yanıltırdı.
 */
export async function karlilikVerisi(f: RaporTarihFiltreleri): Promise<KarlilikSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kabuller = await prisma.kabul.findMany({
    where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    orderBy: [{ teslimTarihi: "desc" }],
    select: {
      id: true,
      kabulNo: true,
      teslimTarihi: true,
      iscilikToplam: true,
      genelToplam: true,
      arac: { select: { plaka: true } },
      cari: { select: { unvan: true } },
      kalemler: {
        select: {
          tur: true,
          miktar: true,
          tutar: true,
          stok: { select: { ortalamaMaliyet: true } },
        },
      },
    },
  })

  return kabuller.map((k) => {
    let parcaSatis = 0
    let parcaMaliyet = 0
    let disHizmetToplam = 0

    for (const kalem of k.kalemler) {
      if (kalem.tur === "PARCA") {
        parcaSatis += sayi(kalem.tutar)
        parcaMaliyet += sayi(kalem.miktar) * sayi(kalem.stok?.ortalamaMaliyet)
      } else if (kalem.tur === "DIS_HIZMET") {
        disHizmetToplam += sayi(kalem.tutar)
      }
    }

    const iscilikGeliri = sayi(k.iscilikToplam)
    const parcaKar = parcaSatis - parcaMaliyet
    const toplamKar = parcaKar + iscilikGeliri
    const genelToplam = sayi(k.genelToplam)

    return {
      id: k.id,
      kabulNo: k.kabulNo,
      teslimTarihi: k.teslimTarihi,
      plaka: k.arac.plaka,
      musteri: k.cari.unvan,
      parcaSatis,
      parcaMaliyet,
      parcaKar,
      iscilikGeliri,
      disHizmetToplam,
      toplamKar,
      // Kâr oranının paydası, kârın DOĞDUĞU ciro: KDV hariç parça + işçilik.
      // Önce `genelToplam`a (KDV DAHİL, üstelik kâra hiç katılmayan dış
      // hizmeti de içeren tutar) bölünüyordu; bu marjı olduğundan düşük
      // gösteriyor ve `/rapor/stok-kar-zarar`ın (kâr / KDV hariç satış)
      // aynı iş için verdiği oranla çelişiyordu. KDV işletmenin geliri
      // değil, marj hesabına girmez.
      karOrani: parcaSatis + iscilikGeliri > 0
        ? (toplamKar / (parcaSatis + iscilikGeliri)) * 100
        : 0,
      genelToplam,
    }
  })
}

// ============================================================================
//  10.2.a YAPILAN İŞÇİLİKLER
// ============================================================================

export type IscilikGrupSatiri = {
  anahtar: string
  ad: string
  islemSayisi: number
  miktar: number
  tutar: number
}

/**
 * İşçilik kalemi bazında gruplu döküm — "hangi işçilikten kaç kez yapıldı,
 * ne kadar ciro getirdi" sorusu. Kârlılık raporuyla aynı ölçüt: TESLİM
 * EDİLEN kartlar (teslimTarihi aralıkta) — henüz teslim edilmemiş kartın
 * kalemi kesinleşmemiş sayılır. Kataloğa bağlı olmayan serbest satırlar
 * (iscilikId boş, ör. elle yazılan iş) `aciklama` metniyle gruplanır.
 */
export async function yapilanIscilikliklerVerisi(
  f: RaporTarihFiltreleri
): Promise<IscilikGrupSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kalemler = await prisma.kabulKalem.findMany({
    where: {
      tur: "ISCILIK",
      kabul: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    },
    select: {
      miktar: true,
      tutar: true,
      aciklama: true,
      iscilikId: true,
      iscilik: { select: { kod: true, ad: true } },
    },
  })

  const gruplar = new Map<string, IscilikGrupSatiri>()
  for (const k of kalemler) {
    const anahtar = k.iscilikId ? `i${k.iscilikId}` : `s:${k.aciklama}`
    const ad = k.iscilik ? `${k.iscilik.kod} — ${k.iscilik.ad}` : k.aciklama || "(Tanımsız)"
    const satir = gruplar.get(anahtar) ?? { anahtar, ad, islemSayisi: 0, miktar: 0, tutar: 0 }
    satir.islemSayisi += 1
    satir.miktar += sayi(k.miktar)
    satir.tutar += sayi(k.tutar)
    gruplar.set(anahtar, satir)
  }

  return [...gruplar.values()].sort((a, b) => b.tutar - a.tutar)
}

// ============================================================================
//  10.2.b YAPILAN PARÇALAR
// ============================================================================

/**
 * Parça kalemi bazında gruplu döküm — Yapılan İşçilikler'in aynası, sadece
 * `tur=PARCA` ve grup anahtarı stok kartı. Miktar burada gerçek anlamda
 * ciro kadar önemli (kaç adet/lt/kg satıldığı stok planlamasını besliyor).
 */
export async function yapilanParcalarVerisi(
  f: RaporTarihFiltreleri
): Promise<IscilikGrupSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kalemler = await prisma.kabulKalem.findMany({
    where: {
      tur: "PARCA",
      kabul: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    },
    select: {
      miktar: true,
      tutar: true,
      aciklama: true,
      stokId: true,
      stok: { select: { kod: true, ad: true } },
    },
  })

  const gruplar = new Map<string, IscilikGrupSatiri>()
  for (const k of kalemler) {
    const anahtar = k.stokId ? `p${k.stokId}` : `s:${k.aciklama}`
    const ad = k.stok ? `${k.stok.kod} — ${k.stok.ad}` : k.aciklama || "(Tanımsız)"
    const satir = gruplar.get(anahtar) ?? { anahtar, ad, islemSayisi: 0, miktar: 0, tutar: 0 }
    satir.islemSayisi += 1
    satir.miktar += sayi(k.miktar)
    satir.tutar += sayi(k.tutar)
    gruplar.set(anahtar, satir)
  }

  return [...gruplar.values()].sort((a, b) => b.tutar - a.tutar)
}

// ============================================================================
//  10.3.a SERVİS SATIŞ DETAYLI
// ============================================================================

export type SatisDetaySatiri = {
  kalemId: number
  kabulId: number
  kabulNo: string
  teslimTarihi: Date | null
  plaka: string
  musteri: string
  tur: string
  ad: string
  miktar: number
  tutar: number
}

/**
 * Onarım Kârlılık'ın kart özetinden farkı: kart+kalem ilişkisiyle KALEM
 * bazında, TEK TEK, gruplanmadan listelenir — "hangi kartta ne satıldı"
 * sorusu (muhasebecinin fatura kontrolü için istediği döküm). Yapılan
 * İşçilikler/Parçalar'dan farkı: orada işçilik/parça bazında GRUPLANIYORDU,
 * burada her kalem kendi satırında, hangi karta ait olduğu görünür şekilde.
 * Aynı ölçüt: teslim edilen kartlar (bkz. 65.1).
 */
export async function satisDetayVerisi(f: RaporTarihFiltreleri): Promise<SatisDetaySatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kabuller = await prisma.kabul.findMany({
    where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    orderBy: [{ teslimTarihi: "desc" }],
    select: {
      id: true,
      kabulNo: true,
      teslimTarihi: true,
      arac: { select: { plaka: true } },
      cari: { select: { unvan: true } },
      kalemler: {
        orderBy: { sira: "asc" },
        select: {
          id: true,
          tur: true,
          miktar: true,
          tutar: true,
          aciklama: true,
          stok: { select: { kod: true, ad: true } },
          iscilik: { select: { kod: true, ad: true } },
        },
      },
    },
  })

  const satirlar: SatisDetaySatiri[] = []
  for (const k of kabuller) {
    for (const kalem of k.kalemler) {
      const ad =
        kalem.stok != null
          ? `${kalem.stok.kod} — ${kalem.stok.ad}`
          : kalem.iscilik != null
            ? `${kalem.iscilik.kod} — ${kalem.iscilik.ad}`
            : kalem.aciklama || "(Tanımsız)"
      satirlar.push({
        kalemId: kalem.id,
        kabulId: k.id,
        kabulNo: k.kabulNo,
        teslimTarihi: k.teslimTarihi,
        plaka: k.arac.plaka,
        musteri: k.cari.unvan,
        tur: kalem.tur,
        ad,
        miktar: sayi(kalem.miktar),
        tutar: sayi(kalem.tutar),
      })
    }
  }

  return satirlar
}

// ============================================================================
//  10.3.b ARAÇ GENEL
// ============================================================================

export type AracGenelSatiri = {
  id: number
  plaka: string
  markaModel: string
  musteri: string
  kabulSayisi: number
  genelToplam: number
  ilkKayitTarihi: Date
  sonGirisTarihi: Date | null
  sonTeslimTarihi: Date | null
}

/**
 * Araç bazında genel özet — Cari mizanının araç karşılığı: kaç kez kabule
 * girmiş, toplam harcaması, son giriş/teslim tarihi. Diğer 10.x raporlarıyla
 * tutarlı olsun diye kabul sayımı/toplamı TESLİM EDİLEN kartlara (teslim
 * tarihi aralıkta) bakar — yalnız bu dönemde kapanan işler sayılır, açık
 * kartın tahmini tutarı karışmaz. `ilkKayitTarihi` bilinçli olarak aralığa
 * bağlı DEĞİL — aracın sisteme ne zaman girdiğini gösterir, dönemden
 * bağımsız sabit bilgi. Araç modülündeki garanti/sigorta raporundan farkı:
 * bu TÜM araçların genel istatistiği, o rapor tekil garanti/sigorta takibi.
 * Bu dönemde hiç teslimatı olmayan araç listeye girmez (Onarım Kârlılık'la
 * aynı mantık: aktivitesiz satır anlamsız kalabalık yaratırdı).
 */
export async function aracGenelVerisi(f: RaporTarihFiltreleri): Promise<AracGenelSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const araclar = await prisma.arac.findMany({
    where: {
      silindi: false,
      kabuller: { some: { silindi: false, teslimTarihi: { gte: bas, lte: bit } } },
    },
    orderBy: [{ plaka: "asc" }],
    select: {
      id: true,
      plaka: true,
      marka: true,
      model: true,
      olusturmaTarihi: true,
      cari: { select: { unvan: true } },
      kabuller: {
        where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
        select: { genelToplam: true, girisTarihi: true, teslimTarihi: true },
      },
    },
  })

  return araclar
    .map((a) => {
      let genelToplam = 0
      let sonGirisTarihi: Date | null = null
      let sonTeslimTarihi: Date | null = null

      for (const k of a.kabuller) {
        genelToplam += sayi(k.genelToplam)
        if (!sonGirisTarihi || k.girisTarihi > sonGirisTarihi) sonGirisTarihi = k.girisTarihi
        if (k.teslimTarihi && (!sonTeslimTarihi || k.teslimTarihi > sonTeslimTarihi))
          sonTeslimTarihi = k.teslimTarihi
      }

      return {
        id: a.id,
        plaka: a.plaka,
        markaModel: [a.marka, a.model].filter(Boolean).join(" ") || "—",
        musteri: a.cari?.unvan ?? "—",
        kabulSayisi: a.kabuller.length,
        genelToplam,
        ilkKayitTarihi: a.olusturmaTarihi,
        sonGirisTarihi,
        sonTeslimTarihi,
      }
    })
    .sort((a, b) => b.genelToplam - a.genelToplam)
}

// ============================================================================
//  10.2.c İŞÇİLİK TOPLAMLARI
// ============================================================================

export type BolumToplamSatiri = {
  anahtar: string
  bolumAdi: string
  islemSayisi: number
  sure: number
  tutar: number
}

/**
 * İşçilik bölümü (Tanim tur=ISCILIK_BOLUMU) bazında toplam — "hangi bölüm
 * ne kadar iş yaptı, kaç saat sürdü" sorusu. Bölüm bilgisi işçilik
 * kataloğunda (`Iscilik.bolumId`) tutuluyor, kalemde değil; kataloğa
 * bağlı olmayan serbest satırların ve bölümü boş bırakılmış işçiliklerin
 * bölümü bilinmediğinden hepsi "Bölümsüz" satırında toplanır. Süre,
 * kataloğun BİRİM süresi (`Iscilik.sure`, saat) × kalem miktarıyla
 * hesaplanır — kalemde ayrı bir süre alanı yok.
 */
export async function iscilikToplamlariVerisi(
  f: RaporTarihFiltreleri
): Promise<BolumToplamSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kalemler = await prisma.kabulKalem.findMany({
    where: {
      tur: "ISCILIK",
      kabul: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    },
    select: {
      miktar: true,
      tutar: true,
      iscilik: { select: { sure: true, bolum: { select: { id: true, ad: true } } } },
    },
  })

  const gruplar = new Map<string, BolumToplamSatiri>()
  for (const k of kalemler) {
    const bolum = k.iscilik?.bolum
    const anahtar = bolum ? `b${bolum.id}` : "bolumsuz"
    const bolumAdi = bolum?.ad ?? "Bölümsüz"
    const satir = gruplar.get(anahtar) ?? { anahtar, bolumAdi, islemSayisi: 0, sure: 0, tutar: 0 }
    satir.islemSayisi += 1
    satir.sure += sayi(k.iscilik?.sure) * sayi(k.miktar)
    satir.tutar += sayi(k.tutar)
    gruplar.set(anahtar, satir)
  }

  return [...gruplar.values()].sort((a, b) => b.tutar - a.tutar)
}

// ============================================================================
//  10.4.a SERVİS YILLIK ANALİZ
// ============================================================================

export type AylikAnalizSatiri = {
  ay: string // "2026-08"
  ayEtiketi: string // "Ağustos 2026"
  kartSayisi: number
  parcaToplam: number
  iscilikToplam: number
  genelToplam: number
  ortalamaKartTutari: number
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]

/**
 * Servis Gün Sonu'nun (10.1) günlük dökümünün ay bazında büyütülmüş hali —
 * aynı ölçüt (teslim tarihi), gün yerine ay grubu. "Bu yıl aya göre nasıl
 * gidiyoruz" sorusu — seçilen aralık genelde bir yıl olur ama aralık ne
 * olursa olsun içindeki her ay ayrı satırda görünür (aralık 3 ay ise 3 satır).
 */
export async function yillikAnalizVerisi(f: RaporTarihFiltreleri): Promise<AylikAnalizSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kabuller = await prisma.kabul.findMany({
    where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    select: { teslimTarihi: true, parcaToplam: true, iscilikToplam: true, genelToplam: true },
  })

  const aylar = new Map<string, AylikAnalizSatiri>()
  // Aralıktaki her ay, hiç teslimat olmasa bile 0'lı satır olarak görünsün —
  // "bu ay hiç kart kapanmamış" bilgisi de anlamlı.
  const gezici = new Date(bas.getFullYear(), bas.getMonth(), 1)
  while (gezici <= bit) {
    const anahtar = `${gezici.getFullYear()}-${String(gezici.getMonth() + 1).padStart(2, "0")}`
    aylar.set(anahtar, {
      ay: anahtar,
      ayEtiketi: `${AY_ADLARI[gezici.getMonth()]} ${gezici.getFullYear()}`,
      kartSayisi: 0,
      parcaToplam: 0,
      iscilikToplam: 0,
      genelToplam: 0,
      ortalamaKartTutari: 0,
    })
    gezici.setMonth(gezici.getMonth() + 1)
  }

  for (const k of kabuller) {
    if (!k.teslimTarihi) continue
    const anahtar = `${k.teslimTarihi.getFullYear()}-${String(k.teslimTarihi.getMonth() + 1).padStart(2, "0")}`
    const satir = aylar.get(anahtar)
    if (!satir) continue
    satir.kartSayisi += 1
    satir.parcaToplam += sayi(k.parcaToplam)
    satir.iscilikToplam += sayi(k.iscilikToplam)
    satir.genelToplam += sayi(k.genelToplam)
  }

  for (const satir of aylar.values()) {
    satir.ortalamaKartTutari = satir.kartSayisi > 0 ? satir.genelToplam / satir.kartSayisi : 0
  }

  return [...aylar.values()].sort((a, b) => (a.ay < b.ay ? 1 : -1))
}

// ============================================================================
//  10.4.b SERVİS ARAÇ ANALİZ
// ============================================================================

export type MarkaAnalizSatiri = {
  marka: string
  kartSayisi: number
  genelToplam: number
  ortalamaKartTutari: number
}

/**
 * Araç Genel'in (10.3, TEKİL araç bazında) tersine burada araçlar MARKA
 * bazında kategorize edilir — "hangi marka en çok geliyor, en çok ciro
 * getiriyor" sorusu. `Arac.aracTuru` (otomobil/kamyon/…) yerine `marka`
 * seçildi: veride daha tutarlı doluyor ve iş sorusuna ("Toyota mı Fiat mı
 * daha çok geliyor") daha doğrudan cevap veriyor. Aynı ölçüt: teslim
 * edilen kartlar (bkz. 65.1).
 */
export async function aracAnalizVerisi(f: RaporTarihFiltreleri): Promise<MarkaAnalizSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kabuller = await prisma.kabul.findMany({
    where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    select: { genelToplam: true, arac: { select: { marka: true } } },
  })

  const gruplar = new Map<string, MarkaAnalizSatiri>()
  for (const k of kabuller) {
    const marka = k.arac.marka?.trim() || "(Belirtilmemiş)"
    const satir = gruplar.get(marka) ?? { marka, kartSayisi: 0, genelToplam: 0, ortalamaKartTutari: 0 }
    satir.kartSayisi += 1
    satir.genelToplam += sayi(k.genelToplam)
    gruplar.set(marka, satir)
  }

  for (const satir of gruplar.values()) {
    satir.ortalamaKartTutari = satir.kartSayisi > 0 ? satir.genelToplam / satir.kartSayisi : 0
  }

  return [...gruplar.values()].sort((a, b) => b.genelToplam - a.genelToplam)
}

// ============================================================================
//  10.4.c GERİ DÖNÜŞ
// ============================================================================

/**
 * Aynı araç TESLİM EDİLDİKTEN sonra kaç gün içinde tekrar kabule girmişse
 * "geri dönüş" sayılır. Eşik 30 gün — ekranda değiştirilemez sabit kod:
 * Selpar dökümünde bu ayarın kullanıcıya açık olduğuna dair bir iz yok,
 * 30 gün genel serviste "yapılan iş tutmadı" ile "yeni/ilgisiz arıza"
 * arasında yaygın kabul gören ayraç (ör. çoğu garanti politikasının kısa
 * vadeli iade penceresi de bu mertebede) — İsmet'in onayıyla sabitlendi.
 */
const GERI_DONUS_ESIK_GUN = 30

export type GeriDonusSatiri = {
  aracId: number
  plaka: string
  musteri: string
  ilkKabulId: number
  ilkKabulNo: string
  ilkTeslimTarihi: Date
  ilkSikayet: string | null
  ilkYapilanIsler: string | null
  ikinciKabulId: number
  ikinciKabulNo: string
  ikinciGirisTarihi: Date
  gunFarki: number
}

/**
 * Kalite/müşteri memnuniyeti takibi: "yaptığımız iş tutmadı mı". Aynı
 * aracın TÜM kabulleri giriş tarihine göre sıraya dizilip ardışık ikili
 * karşılaştırılır (yalnızca teslim edilenler değil — ikinci kabul henüz
 * teslim edilmemiş olabilir, önemli olan müşterinin kısa sürede GERİ
 * GELMİŞ olması). Tarih aralığı filtresi ilk kabulün teslim tarihine
 * uygulanır (10.1-10.3 ile aynı ölçüt) — "bu dönemde teslim ettiğimiz
 * işlerden hangileri geri döndü" sorusu.
 */
export async function geriDonusVerisi(f: RaporTarihFiltreleri): Promise<GeriDonusSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kabuller = await prisma.kabul.findMany({
    where: { silindi: false },
    orderBy: [{ aracId: "asc" }, { girisTarihi: "asc" }],
    select: {
      id: true,
      aracId: true,
      kabulNo: true,
      girisTarihi: true,
      teslimTarihi: true,
      sikayet: true,
      yapilanIsler: true,
      arac: { select: { plaka: true } },
      cari: { select: { unvan: true } },
    },
  })

  const aracGruplari = new Map<number, typeof kabuller>()
  for (const k of kabuller) {
    const grup = aracGruplari.get(k.aracId)
    if (grup) grup.push(k)
    else aracGruplari.set(k.aracId, [k])
  }

  const MS_GUN = 1000 * 60 * 60 * 24
  const satirlar: GeriDonusSatiri[] = []

  for (const grup of aracGruplari.values()) {
    for (let i = 0; i < grup.length - 1; i++) {
      const ilk = grup[i]
      const ikinci = grup[i + 1]
      if (!ilk.teslimTarihi) continue
      if (ilk.teslimTarihi < bas || ilk.teslimTarihi > bit) continue

      const gunFarki = Math.round(
        (ikinci.girisTarihi.getTime() - ilk.teslimTarihi.getTime()) / MS_GUN
      )
      if (gunFarki < 0 || gunFarki > GERI_DONUS_ESIK_GUN) continue

      satirlar.push({
        aracId: ilk.aracId,
        plaka: ilk.arac.plaka,
        musteri: ilk.cari.unvan,
        ilkKabulId: ilk.id,
        ilkKabulNo: ilk.kabulNo,
        ilkTeslimTarihi: ilk.teslimTarihi,
        ilkSikayet: ilk.sikayet,
        ilkYapilanIsler: ilk.yapilanIsler,
        ikinciKabulId: ikinci.id,
        ikinciKabulNo: ikinci.kabulNo,
        ikinciGirisTarihi: ikinci.girisTarihi,
        gunFarki,
      })
    }
  }

  return satirlar.sort((a, b) => b.ilkTeslimTarihi.getTime() - a.ilkTeslimTarihi.getTime())
}

// ============================================================================
//  10.5.a SİGORTA ÖDEME
// ============================================================================

export type SigortaOdemeSatiri = {
  id: number
  kabulNo: string
  plaka: string
  musteri: string
  garantiVerenFirma: string
  garantiTalepTarihi: Date | null
  garantiDosyaNo: string | null
  garantiOnayNo: string | null
  garantiDurumu: string | null
  garantiTutar: number
  odendi: boolean
  genelToplam: number
}

export type SigortaOdemeOzet = { durum: string; adet: number; tutar: number }

/**
 * Garanti Listesi'nden (4c, /servis/garanti) FARKI: o bir CRUD/takip ekranı
 * (firma bazında gruplu, tarih aralığı zorunlu değil), bu bir DÖNEM raporu —
 * "bu ay sigorta şirketlerinden ne kadar tahsil edildi, ne bekliyor" sorusu.
 * Aynı alanları (garantiVerenId/garantiDurumu/garantiTutar/garantiDosyaNo/
 * garantiOnayNo) okur ama farklı amaçla: kod tekrarından çekinilmedi.
 *
 * Tarih ölçütü bilinçli olarak `garantiTalepTarihi` — teslim tarihi değil.
 * Bu rapor "bu dönemde sigortaya HANGİ TALEPLER açıldı, durumu ne" sorusuna
 * cevap veriyor; teslim tarihi arabanın ne zaman çıktığını gösterir, sigorta
 * sürecinin zamanlamasıyla ilgisizdir (talep teslimden önce de sonra da
 * açılabilir). Garanti kapsamı koşulu Garanti Listesi'yle birebir aynı
 * (kartTuru "garanti"/"sigorta" İÇERİR OR garantiVerenId dolu) — ikisi
 * aranmasaydı kart türünü seçmeyi unutan ama firmayı giren kayıtlar kaçardı.
 */
export async function sigortaOdemeVerisi(
  f: RaporTarihFiltreleri
): Promise<{ satirlar: SigortaOdemeSatiri[]; ozet: SigortaOdemeOzet[] }> {
  const { bas, bit } = raporAraligi(f)

  const kabuller = await prisma.kabul.findMany({
    where: {
      silindi: false,
      OR: [{ kartTuru: { contains: "garanti", mode: "insensitive" } }, { garantiVerenId: { not: null } }],
      garantiTalepTarihi: { gte: bas, lte: bit },
    },
    orderBy: [{ garantiTalepTarihi: "desc" }],
    select: {
      id: true,
      kabulNo: true,
      garantiTalepTarihi: true,
      garantiDosyaNo: true,
      garantiOnayNo: true,
      garantiDurumu: true,
      garantiTutar: true,
      odendi: true,
      genelToplam: true,
      arac: { select: { plaka: true } },
      cari: { select: { unvan: true } },
      garantiVeren: { select: { unvan: true } },
    },
  })

  const satirlar: SigortaOdemeSatiri[] = kabuller.map((k) => ({
    id: k.id,
    kabulNo: k.kabulNo,
    plaka: k.arac.plaka,
    musteri: k.cari.unvan,
    garantiVerenFirma: k.garantiVeren?.unvan ?? "(Firma girilmemiş)",
    garantiTalepTarihi: k.garantiTalepTarihi,
    garantiDosyaNo: k.garantiDosyaNo,
    garantiOnayNo: k.garantiOnayNo,
    garantiDurumu: k.garantiDurumu,
    garantiTutar: sayi(k.garantiTutar),
    odendi: k.odendi,
    genelToplam: sayi(k.genelToplam),
  }))

  // Durum bazlı özet — "ne kadar bekliyor, ne kadar ödendi" sorusu tek
  // satırda görünsün diye ayrı döngüde toplanıyor (satır listesi zaten var).
  const ozetMap = new Map<string, SigortaOdemeOzet>()
  for (const s of satirlar) {
    const durum = s.garantiDurumu ?? "(Belirtilmemiş)"
    const grup = ozetMap.get(durum) ?? { durum, adet: 0, tutar: 0 }
    grup.adet += 1
    grup.tutar += s.garantiTutar
    ozetMap.set(durum, grup)
  }

  return { satirlar, ozet: [...ozetMap.values()].sort((a, b) => b.tutar - a.tutar) }
}

// ============================================================================
//  10.5.b DIŞ HİZMET
// ============================================================================

export type DisHizmetSatiri = {
  kalemId: number
  kabulId: number
  kabulNo: string
  teslimTarihi: Date | null
  plaka: string
  musteri: string
  aciklama: string
  miktar: number
  tutar: number
}

/**
 * `KabulKalem` tur=DIS_HIZMET satırlarının dökümü — Yapılan İşçilikler/
 * Parçalar (10.2) ile aynı desen ama dış hizmet için. Onarım Kârlılık'ta
 * (10.1) dış hizmet kâra katılmıyordu (yaptıran firmaya maliyeti sistemde
 * yok), burada o kalemlerin kendi raporu: "hangi iş için dış hizmete
 * gidildi, ne kadar, hangi kartta" sorusu.
 *
 * GRUPLANMADAN, kart bazında tek tek listelendi (10.2'nin aksine) — dış
 * hizmet kataloğa bağlı değil, `aciklama` serbest metin (lastik balansı,
 * kaporta, çekici vb.) kart kart farklılaşıyor; gruplasaydık neredeyse her
 * satır tekil grup olur, "hangi kartta" sorusunun cevabı da kaybolurdu.
 * Servis Satış Detaylı'nın (10.3) aynası: aynı ölçüt (teslim edilen kartlar).
 */
export async function disHizmetVerisi(f: RaporTarihFiltreleri): Promise<DisHizmetSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const kabuller = await prisma.kabul.findMany({
    where: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
    orderBy: [{ teslimTarihi: "desc" }],
    select: {
      id: true,
      kabulNo: true,
      teslimTarihi: true,
      arac: { select: { plaka: true } },
      cari: { select: { unvan: true } },
      kalemler: {
        where: { tur: "DIS_HIZMET" },
        orderBy: { sira: "asc" },
        select: { id: true, aciklama: true, miktar: true, tutar: true },
      },
    },
  })

  const satirlar: DisHizmetSatiri[] = []
  for (const k of kabuller) {
    for (const kalem of k.kalemler) {
      satirlar.push({
        kalemId: kalem.id,
        kabulId: k.id,
        kabulNo: k.kabulNo,
        teslimTarihi: k.teslimTarihi,
        plaka: k.arac.plaka,
        musteri: k.cari.unvan,
        aciklama: kalem.aciklama || "(Açıklama girilmemiş)",
        miktar: sayi(kalem.miktar),
        tutar: sayi(kalem.tutar),
      })
    }
  }

  return satirlar
}

// ============================================================================
//  10.6.a CARİ HAREKET
// ============================================================================

export type CariHareketRaporSatiri = {
  id: number
  tarih: Date
  cariId: number
  cariKod: string
  cariUnvan: string
  tur: string
  aciklama: string | null
  vadeTarihi: Date | null
  borc: number
  alacak: number
}

/**
 * `/cari/[id]/ekstre` TEK cariye bakar, yürüyen bakiye üretir. Bu rapor
 * onun TÜM cariler için genelleştirilmiş hali: tarih aralığındaki her
 * `CariHareket` satırı, hangi cariye ait olduğu görünecek şekilde tek
 * tabloda. Yürüyen bakiye BİLİNÇLİ OLARAK YOK — birden çok carinin
 * hareketi iç içe listelenince "yürüyen bakiye" tek bir cariye ait
 * olmadığından anlamsız olurdu (o ekstrede zaten var). `cariAra`
 * (kod/ünvan) opsiyonel filtre — tek cariye daraltılırsa fiilen
 * ekstrenin dökümüne yaklaşır ama yine de bakiye sütunu yok, o amaç
 * için zaten `/cari/[id]/ekstre` var.
 */
export async function cariHareketRaporuVerisi(
  f: RaporTarihFiltreleri,
  cariAra = ""
): Promise<CariHareketRaporSatiri[]> {
  const { bas, bit } = raporAraligi(f)
  const arama = cariAra.trim()

  const hareketler = await prisma.cariHareket.findMany({
    where: {
      silindi: false,
      tarih: { gte: bas, lte: bit },
      ...(arama
        ? {
            cari: {
              OR: [
                { unvan: { contains: arama, mode: "insensitive" } },
                { kod: { contains: arama, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    select: {
      id: true,
      tarih: true,
      tur: true,
      aciklama: true,
      vadeTarihi: true,
      borc: true,
      alacak: true,
      cari: { select: { id: true, kod: true, unvan: true } },
    },
  })

  return hareketler.map((h) => ({
    id: h.id,
    tarih: h.tarih,
    cariId: h.cari.id,
    cariKod: h.cari.kod,
    cariUnvan: h.cari.unvan,
    tur: h.tur,
    aciklama: h.aciklama,
    vadeTarihi: h.vadeTarihi,
    borc: sayi(h.borc),
    alacak: sayi(h.alacak),
  }))
}

// ============================================================================
//  10.6.b CARİ HESAP TOPLAMLARI
// ============================================================================

export type HesapToplamSatiri = {
  id: number
  kod: string
  unvan: string
  turu: string
  evrakNet: number
  kabulNet: number
  tahsilatNet: number
  tediyeNet: number
  digerNet: number
  borcToplam: number
  alacakToplam: number
  /** Yalnızca sıralama için: borç+alacak toplamı. Ekranda "ciro" diye gösterilmez — kafa karıştırıyor. */
  islemHacmi: number
}

/**
 * `/cari/mizan`'dan FARKI: mizan "devir + dönem = bakiye" sorusuna (dönem
 * kapanışı, muhasebe bakışı) cevap verir; bu rapor "bu dönemde bu cariyle
 * ne kadar İŞ HACMİ oldu, hangi TÜRDEN" sorusuna (iş/faaliyet bakışı) cevap
 * verir — devir YOK, bakiye YOK, sadece dönem içindeki hareketler tür
 * bazında (Fatura/Servis/Tahsilat/Ödeme) net tutarla kırılıp işlem hacmine
 * (borç+alacak toplamı) göre sıralanır. "Bu ay en çok kiminle iş yaptık" sorusunun
 * cevabı mizanda yok, burada var. Kod tekrarından kaçınılmadı — İsmet'in
 * notuyla bilinçli tercih (bkz. HAFIZA 69).
 */
export async function hesapToplamVerisi(f: RaporTarihFiltreleri): Promise<HesapToplamSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const hareketler = await prisma.cariHareket.findMany({
    where: { silindi: false, tarih: { gte: bas, lte: bit } },
    select: {
      tur: true,
      borc: true,
      alacak: true,
      cari: { select: { id: true, kod: true, unvan: true, turu: true } },
    },
  })

  const gruplar = new Map<number, HesapToplamSatiri>()
  for (const h of hareketler) {
    const c = h.cari
    const satir =
      gruplar.get(c.id) ??
      ({
        id: c.id,
        kod: c.kod,
        unvan: c.unvan,
        turu: c.turu,
        evrakNet: 0,
        kabulNet: 0,
        tahsilatNet: 0,
        tediyeNet: 0,
        digerNet: 0,
        borcToplam: 0,
        alacakToplam: 0,
        islemHacmi: 0,
      } satisfies HesapToplamSatiri)

    const borc = sayi(h.borc)
    const alacak = sayi(h.alacak)
    const net = borc - alacak
    if (h.tur === "EVRAK") satir.evrakNet += net
    else if (h.tur === "KABUL") satir.kabulNet += net
    else if (h.tur === "TAHSILAT") satir.tahsilatNet += net
    else if (h.tur === "TEDIYE") satir.tediyeNet += net
    else satir.digerNet += net // ACILIS/MAHSUP/CEK_SENET — dönem raporunda ayrı sütun açacak kadar sık değil

    satir.borcToplam += borc
    satir.alacakToplam += alacak
    satir.islemHacmi += borc + alacak
    gruplar.set(c.id, satir)
  }

  return [...gruplar.values()].sort((a, b) => b.islemHacmi - a.islemHacmi)
}

// ============================================================================
//  10.6.c CARİ YAŞLANDIRMA
// ============================================================================

const YASLANDIRMA_KOVALARI = [
  // Vadesi HENÜZ GELMEMİŞ borç (gün < 0). Kovalar 0'dan başlayınca ileri
  // vadeli satırlar (çek/senet vadesi, vadeli fatura) hiçbir kovaya
  // girmiyor ama "Toplam Bakiye"ye ekleniyordu → satır toplamı kovaların
  // toplamını tutmuyordu. Ayrı sütun, 0-30'a katmaktan doğru: Kasım
  // vadeli bir borcu "0-30 gün gecikmiş" göstermek yanıltır. Bu sütun
  // hariç kalan kovaların toplamı `/rapor/gecen-odemeler` toplamına eşittir.
  // Sınır `gecenOdemelerVerisi` ile aynı: `gunGecikme <= 0` gecikme SAYILMAZ
  // (vadesi bugün dolan borç bugün gecikmiş değildir). Böylece bu sütun
  // hariç kovaların toplamı /rapor/gecen-odemeler toplamına HER ZAMAN eşit.
  { anahtar: "vadesiGelmemis", etiket: "Vadesi Gelmemiş", asgari: -Infinity, azami: 0 },
  { anahtar: "g0_30", etiket: "1-30 Gün", asgari: 1, azami: 30 },
  { anahtar: "g31_60", etiket: "31-60 Gün", asgari: 31, azami: 60 },
  { anahtar: "g61_90", etiket: "61-90 Gün", asgari: 61, azami: 90 },
  { anahtar: "g90ustu", etiket: "90+ Gün", asgari: 91, azami: Infinity },
] as const

export type YaslandirmaSatiri = {
  id: number
  kod: string
  unvan: string
  turu: string
  vadesiGelmemis: number
  g0_30: number
  g31_60: number
  g61_90: number
  g90ustu: number
  toplamBakiye: number
  enEskiTarih: Date
}

/**
 * Klasik "borç yaşlandırma": açık (ödenmemiş) borcu olan cariler, borcun
 * ne kadar süredir açık olduğuna göre kovalara ayrılır. Bu ekranın
 * `/rapor/gecen-odemeler` ("Ödemesi Geçenler", 10.7) ile KARIŞTIRILMAMASI
 * gerekiyor — o vadesi geçmiş TEKİL kayıtları listeler, bu KOVA bazlı
 * toplu özet (muhasebecinin "riskimiz ne kadarı ne kadar eski" sorusu).
 *
 * Vade tarihi yoksa hareketin kendi tarihi kullanılır (görev tanımı böyle
 * istiyor). Kova sınırları (0-30/31-60/61-90/90+) klasik AR yaşlandırma
 * pratiğinde en yaygın 30 günlük dilim — ekranda değiştirilemez sabit,
 * Geri Dönüş raporundaki (10.4) 30 günlük eşikle de tutarlı.
 *
 * Cari düzeyinde tek "borç ne zamandır açık" bilgisi tutulmadığından
 * (fatura bazlı ödeme eşleştirmesi yok) FIFO mantığı kullanıldı: cariye
 * ait hareketler tarih sırasıyla gezilir, açık borç kuyruğuna eklenir,
 * her alacak/ödeme geldiğinde kuyruğun EN ESKİ ucundan düşülür. Kuyrukta
 * kalan (henüz kapatılmamış) tutarlar kendi tarihlerinin yaşına göre
 * kovalara dağıtılır. Ödeme hangi faturaya karşılık geldiği elle
 * eşleştirilmediği için bu, gerçek muhasebe defterine en yakın makul
 * yaklaşım — İsmet'in onayıyla.
 */
export async function cariYaslandirmaVerisi(asOfMetin: string): Promise<YaslandirmaSatiri[]> {
  const asOf = asOfMetin ? gunSonu(new Date(`${asOfMetin}T00:00:00`)) : gunSonu()

  const hareketler = await prisma.cariHareket.findMany({
    where: { silindi: false, tarih: { lte: asOf } },
    orderBy: [{ cariId: "asc" }, { tarih: "asc" }, { id: "asc" }],
    select: {
      cariId: true,
      tarih: true,
      vadeTarihi: true,
      borc: true,
      alacak: true,
      cari: { select: { kod: true, unvan: true, turu: true } },
    },
  })

  const MS_GUN = 1000 * 60 * 60 * 24
  const sonuc: YaslandirmaSatiri[] = []

  let i = 0
  while (i < hareketler.length) {
    const cariId = hareketler[i].cariId
    const cari = hareketler[i].cari
    // Açık borç kuyruğu: her satırda [kalan tutar, yaşlandırma tarihi]
    const kuyruk: { tutar: number; tarih: Date }[] = []

    while (i < hareketler.length && hareketler[i].cariId === cariId) {
      const h = hareketler[i]
      const borc = sayi(h.borc)
      let alacak = sayi(h.alacak)

      // Alacak/ödeme önce en eski açık borcu kapatır (FIFO).
      while (alacak > 0 && kuyruk.length > 0) {
        const en = kuyruk[0]
        const dusum = Math.min(en.tutar, alacak)
        en.tutar -= dusum
        alacak -= dusum
        if (en.tutar <= 0.005) kuyruk.shift()
      }
      // Bu satırda hâlâ borç varsa (ya da alacak borcu aşıp fazlası kaldıysa,
      // o durum negatif bakiye/avans demektir ve yaşlandırmaya girmez).
      if (borc > 0) {
        kuyruk.push({ tutar: borc, tarih: h.vadeTarihi ?? h.tarih })
      }
      i++
    }

    const kovalar = { vadesiGelmemis: 0, g0_30: 0, g31_60: 0, g61_90: 0, g90ustu: 0 }
    let toplamBakiye = 0
    let enEskiTarih: Date | null = null
    for (const acik of kuyruk) {
      if (acik.tutar <= 0.005) continue
      const gun = Math.floor((asOf.getTime() - acik.tarih.getTime()) / MS_GUN)
      const kova = YASLANDIRMA_KOVALARI.find((k) => gun >= k.asgari && gun <= k.azami)
      if (kova) kovalar[kova.anahtar as keyof typeof kovalar] += acik.tutar
      toplamBakiye += acik.tutar
      if (!enEskiTarih || acik.tarih < enEskiTarih) enEskiTarih = acik.tarih
    }

    if (toplamBakiye > 0.005 && enEskiTarih) {
      sonuc.push({
        id: cariId,
        kod: cari.kod,
        unvan: cari.unvan,
        turu: cari.turu,
        ...kovalar,
        toplamBakiye,
        enEskiTarih,
      })
    }
  }

  return sonuc.sort((a, b) => b.toplamBakiye - a.toplamBakiye)
}

export const YASLANDIRMA_KOVA_LISTESI = YASLANDIRMA_KOVALARI

// ============================================================================
//  10.7.a ÖDEMESİ GEÇENLER
// ============================================================================

export type GecenOdemeSatiri = {
  cariId: number
  cariKod: string
  cariUnvan: string
  turu: string
  tur: string
  aciklama: string | null
  vadeTarihi: Date
  tutar: number
  gunGecikme: number
}

/**
 * Cari Yaşlandırma'nın (10.6) KOMŞUSU, TERSİ DEĞİL — isim bilinçli farklı
 * seçildi (bkz. HAFIZA 69.3). Yaşlandırma kova bazlı TOPLU özet; bu rapor
 * vadesi geçmiş TEKİL kayıtların listesi — "hangi cari, hangi vade, kaç gün
 * gecikmiş, ne kadar" sorusu. Aynı FIFO açık borç kuyruğu mantığı (fatura
 * bazlı ödeme eşleştirmesi sistemde yok) burada da kullanıldı, ama kovaya
 * toplamak yerine kuyrukta kalan HER açık satır kendi vade/tutarıyla ayrı
 * satır olarak dökülür. Sıralama: en çok geciken üstte.
 *
 * Diğer raporların aksine tarih ARALIĞI değil TEK "Analiz Tarihi" (asOf)
 * alır — Yaşlandırma'yla aynı gerekçe (HAFIZA 69.3).
 */
export async function gecenOdemelerVerisi(asOfMetin: string): Promise<GecenOdemeSatiri[]> {
  const asOf = asOfMetin ? gunSonu(new Date(`${asOfMetin}T00:00:00`)) : gunSonu()

  const hareketler = await prisma.cariHareket.findMany({
    where: { silindi: false, tarih: { lte: asOf } },
    orderBy: [{ cariId: "asc" }, { tarih: "asc" }, { id: "asc" }],
    select: {
      cariId: true,
      tarih: true,
      tur: true,
      aciklama: true,
      vadeTarihi: true,
      borc: true,
      alacak: true,
      cari: { select: { kod: true, unvan: true, turu: true } },
    },
  })

  const MS_GUN = 1000 * 60 * 60 * 24
  const sonuc: GecenOdemeSatiri[] = []

  let i = 0
  while (i < hareketler.length) {
    const cariId = hareketler[i].cariId
    const cari = hareketler[i].cari
    // Açık borç kuyruğu — Yaşlandırma'daki aynı FIFO, ama her satır kendi
    // tür/açıklamasını da taşır (kova özetinde gerekmiyordu, burada gerekiyor).
    const kuyruk: {
      tutar: number
      vade: Date
      tur: string
      aciklama: string | null
    }[] = []

    while (i < hareketler.length && hareketler[i].cariId === cariId) {
      const h = hareketler[i]
      const borc = sayi(h.borc)
      let alacak = sayi(h.alacak)

      while (alacak > 0 && kuyruk.length > 0) {
        const en = kuyruk[0]
        const dusum = Math.min(en.tutar, alacak)
        en.tutar -= dusum
        alacak -= dusum
        if (en.tutar <= 0.005) kuyruk.shift()
      }
      if (borc > 0) {
        kuyruk.push({ tutar: borc, vade: h.vadeTarihi ?? h.tarih, tur: h.tur, aciklama: h.aciklama })
      }
      i++
    }

    for (const acik of kuyruk) {
      if (acik.tutar <= 0.005) continue
      const gunGecikme = Math.floor((asOf.getTime() - acik.vade.getTime()) / MS_GUN)
      if (gunGecikme <= 0) continue // vadesi henüz gelmemiş — bu rapor sadece GEÇENLERİ listeler
      sonuc.push({
        cariId,
        cariKod: cari.kod,
        cariUnvan: cari.unvan,
        turu: cari.turu,
        tur: acik.tur,
        aciklama: acik.aciklama,
        vadeTarihi: acik.vade,
        tutar: acik.tutar,
        gunGecikme,
      })
    }
  }

  return sonuc.sort((a, b) => b.gunGecikme - a.gunGecikme)
}

// ============================================================================
//  10.7.b AYLIK BORÇ TAHSİLAT
// ============================================================================

export type AylikBorcTahsilatSatiri = {
  ay: string
  ayEtiketi: string
  borcDogan: number
  tahsilat: number
  tahsilatOrani: number
}

/**
 * Cari Hesap Toplamları'nın (10.6) CARİ bazlı kırılımının AY bazında
 * büyütülmüş hali — Servis Yıllık Analiz'in (10.4) Servis Gün Sonu'nu (10.1)
 * ay bazında büyütmesiyle aynı desen. Cari bazında değil İŞLETME GENELİNDE
 * "hangi ay ne kadar borç doğdu, ne kadarı tahsil edildi" sorusu.
 *
 * `borcDogan` = o ay içindeki EVRAK + KABUL türü hareketlerin net (borç−
 * alacak, ör. iade/iptal düşülsün diye) toplamı — cariye yeni borç yazan iki
 * tür. `tahsilat` = TAHSILAT türü hareketlerin net tutarı. TEDIYE (ödeme,
 * bize borç kapatan değil bizim ödediğimiz) buraya karışmaz — bu rapor
 * "müşteriden alacağımız ne kadar tahsil oldu" sorusuna bakıyor, kasadan
 * çıkan parayı değil. `tahsilatOrani` = tahsilat/borçDoğan × 100 (borç
 * doğmadıysa 0) — "bu ay doğan borcun ne kadarı aynı ay kapandı" fikri
 * verir, kesin bir KPI değil (bir ayın tahsilatı önceki ayın borcunu da
 * kapatabilir) ama muhasebecinin hızlı göz atması için yeterli.
 */
export async function aylikBorcTahsilatVerisi(
  f: RaporTarihFiltreleri
): Promise<AylikBorcTahsilatSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const hareketler = await prisma.cariHareket.findMany({
    where: {
      silindi: false,
      tarih: { gte: bas, lte: bit },
      tur: { in: ["EVRAK", "KABUL", "TAHSILAT"] },
    },
    select: { tarih: true, tur: true, borc: true, alacak: true },
  })

  const aylar = new Map<string, AylikBorcTahsilatSatiri>()
  const gezici = new Date(bas.getFullYear(), bas.getMonth(), 1)
  while (gezici <= bit) {
    const anahtar = `${gezici.getFullYear()}-${String(gezici.getMonth() + 1).padStart(2, "0")}`
    aylar.set(anahtar, {
      ay: anahtar,
      ayEtiketi: `${AY_ADLARI[gezici.getMonth()]} ${gezici.getFullYear()}`,
      borcDogan: 0,
      tahsilat: 0,
      tahsilatOrani: 0,
    })
    gezici.setMonth(gezici.getMonth() + 1)
  }

  for (const h of hareketler) {
    const anahtar = `${h.tarih.getFullYear()}-${String(h.tarih.getMonth() + 1).padStart(2, "0")}`
    const satir = aylar.get(anahtar)
    if (!satir) continue
    const net = sayi(h.borc) - sayi(h.alacak)
    if (h.tur === "EVRAK" || h.tur === "KABUL") satir.borcDogan += net
    // Tahsilat carinin alacağına yazılır (net negatif) — rapor sütunu "tahsil
    // edilen para" olduğu için pozitife çeviriyoruz; oran da anlamlı kalsın.
    else if (h.tur === "TAHSILAT") satir.tahsilat += -net
  }

  for (const satir of aylar.values()) {
    satir.tahsilatOrani = satir.borcDogan > 0 ? (satir.tahsilat / satir.borcDogan) * 100 : 0
  }

  return [...aylar.values()].sort((a, b) => (a.ay < b.ay ? 1 : -1))
}

// ============================================================================
//  10.7.c CARİ GÜN SONU
// ============================================================================

export type CariGunSonuSatiri = {
  gun: Date
  faturaToplam: number
  servisToplam: number
  tahsilat: number
  odeme: number
  digerNet: number
  gunNet: number
  kumulatifBakiye: number
}

/**
 * Servis Gün Sonu'yla (10.1) İSİM ÇAKIŞMASIN diye o "Servis Gün Sonü" olarak
 * ayrıştırıldı (HAFIZA 64) — bu CARİ tarafının gün sonu dökümü. Günlük
 * İcmal'den (10.1) farkı: İcmal servis odaklı TÜM faaliyeti (açılan/teslim
 * kart, kesilen fatura, kasa) kapsıyordu; bu rapor sadece CARİ hareketlerine
 * (`CariHareket`) odaklanır — "o gün cari tarafında ne oldu, gün sonunda net
 * ne kadar borçlandık/alacaklandık" sorusu.
 *
 * Tür kırılımı Hesap Toplamları'yla (10.6) aynı desende: EVRAK=fatura,
 * KABUL=servis, TAHSILAT, TEDIYE=ödeme, geri kalan (AÇILIŞ/MAHSUP/ÇEK-SENET)
 * "Diğer" — orada da ayrı sütun açılmamıştı, aynı gerekçe geçerli.
 * `gunNet` = o günkü toplam borç − toplam alacak (işletme genelinde net
 * alacaklanma/borçlanma). `kumulatifBakiye` bilinçli olarak carinin GERÇEK
 * açılıştan beri bakiyesi DEĞİL, seçilen ARALIK İÇİNDE `gunNet`in yürüyen
 * toplamı — Cari Hareket raporundaki (10.6) "yürüyen bakiye burada yok"
 * kararıyla aynı gerekçeyle tam bakiye yanıltıcı olurdu (yüzlerce carinin
 * karışık toplamı gerçek bir bakiye değildir), ama "bu aralıkta net yön
 * nereye gidiyor" sorusuna yine de cevap verir.
 */
export async function cariGunSonuVerisi(f: RaporTarihFiltreleri): Promise<CariGunSonuSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const hareketler = await prisma.cariHareket.findMany({
    where: { silindi: false, tarih: { gte: bas, lte: bit } },
    select: { tarih: true, tur: true, borc: true, alacak: true },
  })

  const gunlerAsc = gunListesi(bas, bit).slice().reverse()
  const satirlar = new Map<string, CariGunSonuSatiri>()
  for (const gun of gunlerAsc) {
    satirlar.set(gunAnahtari(gun), {
      gun,
      faturaToplam: 0,
      servisToplam: 0,
      tahsilat: 0,
      odeme: 0,
      digerNet: 0,
      gunNet: 0,
      kumulatifBakiye: 0,
    })
  }

  for (const h of hareketler) {
    const satir = satirlar.get(gunAnahtari(h.tarih))
    if (!satir) continue
    const borc = sayi(h.borc)
    const alacak = sayi(h.alacak)
    const net = borc - alacak
    if (h.tur === "EVRAK") satir.faturaToplam += net
    else if (h.tur === "KABUL") satir.servisToplam += net
    else if (h.tur === "TAHSILAT") satir.tahsilat += net
    else if (h.tur === "TEDIYE") satir.odeme += net
    else satir.digerNet += net
    satir.gunNet += net
  }

  let kumulatif = 0
  for (const gun of gunlerAsc) {
    const satir = satirlar.get(gunAnahtari(gun))!
    kumulatif += satir.gunNet
    satir.kumulatifBakiye = kumulatif
  }

  // Ekranda en yeni gün üstte görünsün diye (diğer 10.x gün raporlarıyla
  // aynı sırada), kumülatif hesaplandıktan SONRA ters çevrilir.
  return [...satirlar.values()].reverse()
}

// ============================================================================
//  10.8.a KDV ÖZETİ
// ============================================================================

export type KdvAySatiri = {
  ay: string
  ayEtiketi: string
  alisFaturaSayisi: number
  alisMatrah: number
  alisKdv: number
  satisFaturaSayisi: number
  satisMatrah: number
  satisKdv: number
  /** satisKdv − alisKdv. Artı: ödenecek KDV, eksi: devreden (sonraki aya). */
  fark: number
}

/**
 * KDV ÖZETİ — "bu ay devlete ne kadar KDV ödeyeceğiz" sorusu.
 *
 * Hesaplanan KDV (satış) − İndirilecek KDV (alış) = Ödenecek KDV. Fark eksiyse
 * ödeme çıkmaz, sonraki aya DEVREDEN KDV olur (iade alınmaz) — ekranda da
 * bu ayrım yapılıyor.
 *
 * KAYNAK VERİ `Evrak` (fatura), `CariHareket` DEĞİL: KDV faturaya bağlıdır.
 * Faturalanmamış servis kabul kartı, tahsilat, kasa hareketi KDV doğurmaz —
 * bu yüzden 10.6/10.7'nin CariHareket tabanlı raporlarının aksine buraya
 * hiç girmezler. Aynı gerekçeyle yalnız `durum=KESILDI` faturalar sayılır:
 * taslak henüz kesilmemiştir, iptal edilmiş fatura beyana girmez.
 *
 * KDV tutarı faturanın KENDİ `kdvToplam` alanından okunur, "matrah × %20"
 * diye yeniden hesaplanmaz. Standart oran %20 olduğu için ikisi normalde
 * birebir aynı çıkar; ama bir faturada farklı oran (ör. %10 / %1) ya da
 * KDV'siz satır varsa doğru olan faturanın kendi tutarıdır — beyana giden
 * rakam odur. Matrah sütunu yine de gösteriliyor ki oran gözle görülebilsin.
 *
 * İade satırları KARŞI YÖNE yazılmaz, KENDİ yönünden NETLENİR (Ba/Bs'teki
 * ilkeyle aynı): IADE_ALIS önceki alışın düzeltmesidir, indirilecek KDV'yi
 * azaltır; IADE_SATIS hesaplanan KDV'yi azaltır.
 */
export async function kdvOzetiVerisi(f: RaporTarihFiltreleri): Promise<KdvAySatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const evraklar = await prisma.evrak.findMany({
    where: {
      silindi: false,
      durum: "KESILDI",
      tarih: { gte: bas, lte: bit },
      tur: { in: ["ALIS", "IADE_ALIS", "SATIS", "SERVIS", "PERAKENDE", "IADE_SATIS"] },
    },
    select: { tarih: true, tur: true, araToplam: true, kdvToplam: true },
  })

  // Hareketi olmayan ay da tabloda satır olarak dursun (aylık seri kopmasın).
  const aylar = new Map<string, KdvAySatiri>()
  const gezici = new Date(bas.getFullYear(), bas.getMonth(), 1)
  while (gezici <= bit) {
    const anahtar = `${gezici.getFullYear()}-${String(gezici.getMonth() + 1).padStart(2, "0")}`
    aylar.set(anahtar, {
      ay: anahtar,
      ayEtiketi: `${AY_ADLARI[gezici.getMonth()]} ${gezici.getFullYear()}`,
      alisFaturaSayisi: 0,
      alisMatrah: 0,
      alisKdv: 0,
      satisFaturaSayisi: 0,
      satisMatrah: 0,
      satisKdv: 0,
      fark: 0,
    })
    gezici.setMonth(gezici.getMonth() + 1)
  }

  for (const e of evraklar) {
    const anahtar = `${e.tarih.getFullYear()}-${String(e.tarih.getMonth() + 1).padStart(2, "0")}`
    const satir = aylar.get(anahtar)
    if (!satir) continue

    const iade = e.tur === "IADE_ALIS" || e.tur === "IADE_SATIS"
    const yon = iade ? -1 : 1
    const matrah = sayi(e.araToplam) * yon
    const kdv = sayi(e.kdvToplam) * yon

    if (e.tur === "ALIS" || e.tur === "IADE_ALIS") {
      satir.alisFaturaSayisi += 1
      satir.alisMatrah += matrah
      satir.alisKdv += kdv
    } else {
      satir.satisFaturaSayisi += 1
      satir.satisMatrah += matrah
      satir.satisKdv += kdv
    }
  }

  for (const satir of aylar.values()) {
    satir.fark = satir.satisKdv - satir.alisKdv
  }

  // En yeni ay üstte — diğer aylık raporlarla aynı sıra.
  return [...aylar.values()].reverse()
}

// ============================================================================
//  10.8.b CARİ ALIŞ-SATIŞ
// ============================================================================

export type CariAlisSatisSatiri = {
  id: number
  kod: string
  unvan: string
  turu: string
  vkn: string | null
  alisFaturaSayisi: number
  alisToplam: number
  satisFaturaSayisi: number
  satisToplam: number
  fark: number
}

/**
 * Hesap Toplamları'nın (10.6, `CariHareket` tabanlı, TÜM hareket türleri:
 * tahsilat/ödeme/servis kartı dahil) aksine SADECE `Evrak` (fatura) tabanlı,
 * cari bazında ALIŞ vs SATIŞ toplamı — "bu dönemde bu cariden ne kadar
 * aldık, ne kadar sattık" sorusu, tahsilat/ödeme karışmadan sade fatura
 * görünümü. BA-BS Formu'ndan farkı: VKN eşiği/ay kısıtı yok, TÜM cariler
 * (VKN'siz dahil), dönem serbest tarih aralığı, VKN değil CARİ bazında
 * kırılım (mükerrer VKN'li iki kart burada ayrı satır kalır — BA-BS'nin
 * "mükerrer birleştir" kararının aksine, çünkü burada soru "bu KART ile
 * ne kadar iş yaptık", vergi kimliği değil).
 *
 * BA-BS'teki gibi yalnız `durum=KESILDI` faturalar sayılıyor (taslak/iptal
 * gerçek bir alım-satım değil) ve iade kendi yönünden netleniyor (aynı
 * gerekçe: IADE_ALIS alıştan düşer, IADE_SATIS satıştan düşer).
 */
export async function cariAlisSatisVerisi(f: RaporTarihFiltreleri): Promise<CariAlisSatisSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const evraklar = await prisma.evrak.findMany({
    where: {
      silindi: false,
      durum: "KESILDI",
      tarih: { gte: bas, lte: bit },
      tur: { in: ["ALIS", "IADE_ALIS", "SATIS", "SERVIS", "PERAKENDE", "IADE_SATIS"] },
    },
    select: {
      tur: true,
      genelToplam: true,
      cari: { select: { id: true, kod: true, unvan: true, turu: true, vergiNo: true } },
    },
  })

  const gruplar = new Map<number, CariAlisSatisSatiri>()
  for (const e of evraklar) {
    const c = e.cari
    const satir =
      gruplar.get(c.id) ??
      ({
        id: c.id,
        kod: c.kod,
        unvan: c.unvan,
        turu: c.turu,
        vkn: c.vergiNo,
        alisFaturaSayisi: 0,
        alisToplam: 0,
        satisFaturaSayisi: 0,
        satisToplam: 0,
        fark: 0,
      } satisfies CariAlisSatisSatiri)

    const tutar = sayi(e.genelToplam)
    if (e.tur === "ALIS") {
      satir.alisFaturaSayisi += 1
      satir.alisToplam += tutar
    } else if (e.tur === "IADE_ALIS") {
      satir.alisFaturaSayisi += 1
      satir.alisToplam -= tutar
    } else if (e.tur === "IADE_SATIS") {
      satir.satisFaturaSayisi += 1
      satir.satisToplam -= tutar
    } else {
      // SATIS, SERVIS, PERAKENDE
      satir.satisFaturaSayisi += 1
      satir.satisToplam += tutar
    }
    gruplar.set(c.id, satir)
  }

  for (const satir of gruplar.values()) {
    satir.fark = satir.satisToplam - satir.alisToplam
  }

  return [...gruplar.values()].sort(
    (a, b) => b.satisToplam + b.alisToplam - (a.satisToplam + a.alisToplam)
  )
}

// ============================================================================
//  10.9.a BUGÜN AÇILAN CARİLER
// ============================================================================

export type BugunAcilanSatiri = {
  id: number
  kod: string
  unvan: string
  turu: string
  telefon: string | null
  vergiNo: string | null
  olusturanAdi: string
  olusturmaTarihi: Date
}

/**
 * `/cari/[id]/…`nin komşusu değil — CariHareket'e de Evrak'a da değil,
 * doğrudan `Cari.olusturmaTarihi`'ne bakan tek rapor bu (10.1-10.8'in
 * tamamı hareket/fatura tabanlıydı). "Hangi cari ne zaman açıldı" sorusu.
 *
 * İsim "Bugün" ama SERBEST tarih aralığı filtresi var, tek güne
 * kilitlenmedi — diğer 12 rapordaki `TarihAraligiFiltre`/`varsayilanRaporAraligi`
 * ile aynı bileşen kullanılsın diye bilinçli tercih (ORTAK KURALLAR'daki
 * "her raporda tarih aralığı filtresi olsun" maddesiyle tutarlı). Varsayılan
 * aralık da diğerleriyle aynı (ay başı-bugün) BIRAKILDI — "Bugün" adı yalnızca
 * rapor NİYETİNİ anlatıyor (Selpar'daki günlük kontrol alışkanlığı), ekranı
 * açan kullanıcı zaten o günü görür, ihtiyaç halinde aralığı genişletir.
 * (Menüdeki `/cari?durum=bugun` hızlı filtresiyle KARIŞTIRILMASIN — o liste
 * sayfasının tek-günlük filtresi, bu ise tarih aralıklı, CSV/yazdır araçlı
 * tam rapor; ikisi de kalıyor, biri diğerinin yerine geçmiyor.)
 *
 * Personel de `Cari` tablosunda (`turu=PERSONEL`) tutulduğundan bu rapora
 * karışabilir — DIŞLANMADI (görev tanımının isteği), tür sütunuyla ayırt
 * edilsin diye `turu` opsiyonel filtresi eklendi.
 */
export async function bugunAcilanCarilerVerisi(
  f: RaporTarihFiltreleri,
  turu = ""
): Promise<BugunAcilanSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const cariler = await prisma.cari.findMany({
    where: {
      silindi: false,
      olusturmaTarihi: { gte: bas, lte: bit },
      ...(turu ? { turu: turu as never } : {}),
    },
    orderBy: [{ olusturmaTarihi: "desc" }],
    select: {
      id: true,
      kod: true,
      unvan: true,
      turu: true,
      telefon: true,
      gsm: true,
      vergiNo: true,
      olusturanId: true,
      olusturmaTarihi: true,
    },
  })

  const idler = [...new Set(cariler.map((c) => c.olusturanId).filter((v): v is number => v != null))]
  const kullanicilar = idler.length
    ? await prisma.kullanici.findMany({ where: { id: { in: idler } }, select: { id: true, ad: true, soyad: true } })
    : []
  const adHaritasi = new Map(kullanicilar.map((k) => [k.id, `${k.ad} ${k.soyad ?? ""}`.trim()]))

  return cariler.map((c) => ({
    id: c.id,
    kod: c.kod,
    unvan: c.unvan,
    turu: c.turu,
    telefon: c.gsm || c.telefon,
    vergiNo: c.vergiNo,
    olusturanAdi: c.olusturanId ? (adHaritasi.get(c.olusturanId) ?? "—") : "—",
    olusturmaTarihi: c.olusturmaTarihi,
  }))
}

// ============================================================================
//  10.9.b VKN AYNI OLANLAR
// ============================================================================

export type VknMukerrerGrup = {
  vergiNo: string
  kayitlar: {
    id: number
    kod: string
    unvan: string
    turu: string
    telefon: string | null
    olusturmaTarihi: Date
    /** Seçili tarih aralığında mı açılmış — sorguyu daraltmaz, sadece işaretler (bkz. fonksiyon yorumu). */
    aralikIcinde: boolean
  }[]
}

/**
 * Mükerrer cari tespiti — `/cari/mukerrer` ("Mükerrer Cari Kontrolü") zaten
 * VKN + ünvan + telefon üçlüsüne bakıyor ve Cari Birleştir'e kısayol veriyor
 * (bkz. HAFIZA 43); bu rapor onun YERİNE geçmiyor, VKN dilimini Raporlar
 * grubunda SELPAR-ANALIZ.md'deki isimle (satır 48-50) ve rapor araçlarıyla
 * (CSV/yazdır, `rapor-araclari.tsx`) tekrar sunuyor — muhasebeci Raporlar
 * menüsünden dışarı çıkmadan indirebilsin diye. Sorgu mantığı KOPYALANMADI,
 * `/cari/mukerrer`deki ham SQL yerine burada Prisma groupBy kullanıldı
 * (basit `having count>1`, ek ünvan/telefon karşılaştırması gerekmiyor).
 *
 * VKN'si boş/null cariler bu raporda ANLAMSIZ (mükerrerlik VKN'ye bağlı),
 * `WHERE vergiNo IS NOT NULL AND vergiNo <> ''` ile baştan hariç tutuldu.
 *
 * **Tarih aralığı filtresi burada SORGUYU DARALTMIYOR** — sadece cari
 * AÇILIŞ tarihine göre süzülmüş bir mükerrerlik listesi vermek, aralık
 * dışında kalan üçüncü/dördüncü mükerrer kartı gizleyip yanlış "temiz"
 * izlenimi verirdi (rapor "şu an aktif mükerrer kartlar ne" sorusuna bakar,
 * ne zaman açıldıkları değil). Bunun yerine aralık, grup İÇİNDEKİ kayıtları
 * "bu aralıkta açılan" / "aralık dışında açılan" olarak İŞARETLEMEK için
 * kullanılıyor — kullanıcı en son ne zamandır bu mükerrerliğin farkında
 * olabileceğini görür ama hiçbir gerçek mükerrer kart listeden düşmez.
 */
export async function vknMukerrerVerisi(f: RaporTarihFiltreleri): Promise<VknMukerrerGrup[]> {
  const { bas, bit } = raporAraligi(f)
  const gruplar = await prisma.cari.groupBy({
    by: ["vergiNo"],
    where: { silindi: false, vergiNo: { not: null, notIn: [""] } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  })

  const vknler = gruplar.map((g) => g.vergiNo).filter((v): v is string => v != null)
  if (!vknler.length) return []

  const cariler = await prisma.cari.findMany({
    where: { silindi: false, vergiNo: { in: vknler } },
    orderBy: [{ vergiNo: "asc" }, { olusturmaTarihi: "asc" }],
    select: {
      id: true,
      kod: true,
      unvan: true,
      turu: true,
      telefon: true,
      gsm: true,
      vergiNo: true,
      olusturmaTarihi: true,
    },
  })

  const map = new Map<string, VknMukerrerGrup>()
  for (const c of cariler) {
    const vkn = c.vergiNo!
    const grup = map.get(vkn) ?? { vergiNo: vkn, kayitlar: [] }
    grup.kayitlar.push({
      id: c.id,
      kod: c.kod,
      unvan: c.unvan,
      turu: c.turu,
      telefon: c.gsm || c.telefon,
      olusturmaTarihi: c.olusturmaTarihi,
      aralikIcinde: c.olusturmaTarihi >= bas && c.olusturmaTarihi <= bit,
    })
    map.set(vkn, grup)
  }

  return [...map.values()].sort((a, b) => b.kayitlar.length - a.kayitlar.length)
}

// ============================================================================
//  10.10.a STOK SON DURUM
// ============================================================================

export type StokSonDurumKirilim = {
  anahtar: string
  urunSayisi: number
  toplamDeger: number
}

export type StokSonDurumOzeti = {
  toplamUrunSayisi: number
  toplamDeger: number
  kritikSayisi: number
  sifirSayisi: number
  negatifSayisi: number
  /** Seçili aralıkta GÜNCELLENEN kart sayısı — bkz. fonksiyon yorumu, sorguyu daraltmaz. */
  araliktaGuncellenenSayisi: number
  depoKirilimi: StokSonDurumKirilim[]
  grupKirilimi: StokSonDurumKirilim[]
}

/**
 * STOK SON DURUM — "şu an depo/ürün bazında mevcut miktar + değer ne"
 *
 * SELPAR-ANALIZ.md'de yalnız isim vardı (satır 60, "Stok Raporları (13)"
 * listesinde), alan detayı yoktu — makul varsayımla tasarlandı.
 *
 * `/stok` listesinden farkı: burası TEK EKRANDA toplam değer + depo/grup
 * kırılımı + kritik/sıfır/negatif özet sayaçları veriyor, `/stok` tek tek
 * kart listesi (bkz. 10.10.b Envanter, o farkı üstleniyor).
 *
 * **Değer = mevcutMiktar × ortalamaMaliyet, alışFiyat DEĞİL** — 10.11
 * (Kâr-Zarar, henüz yazılmadı) kâr hesabında ortalamaMaliyet kullanacağı
 * için buradaki "stok değeri" onunla TUTARLI olsun diye aynı alan seçildi;
 * alışFiyat tek bir alım fişindeki anlık fiyat, ortalamaMaliyet stoğun o
 * anki gerçek defter değerini yansıtıyor.
 *
 * **Tarih aralığı bu raporda SORGUYU DARALTMAZ** — "son durum" adı zaten
 * "şu an"ı işaret ediyor (StokHareket geçmişine değil, Stok'un GÜNCEL
 * mevcutMiktar'ına bakılıyor); aralık daraltsaydı rapor "şu an ne var"
 * sorusuna değil "o aralıkta ne vardı" sorusuna cevap verirdi, bu da
 * StokHareket tabanlı 10.12'nin (Stok Hareket Analizi) işi. Bunun yerine
 * VKN Aynı Olanlar'daki (72.2) desenle aynı mantıkla, aralık yalnız
 * `guncellemeTarihi` bu aralıkta mı diye tek bir bilgi sayacı üretmek için
 * kullanılıyor — "kaç kart bu aralıkta güncellendi" muhasebeciye ek bilgi.
 */
export async function stokSonDurumVerisi(f: RaporTarihFiltreleri): Promise<StokSonDurumOzeti> {
  const { bas, bit } = raporAraligi(f)

  const stoklar = await prisma.stok.findMany({
    where: { silindi: false, aktif: true },
    select: {
      mevcutMiktar: true,
      minSeviye: true,
      ortalamaMaliyet: true,
      depoId: true,
      urunGrubu: true,
      guncellemeTarihi: true,
      depo: { select: { ad: true } },
    },
  })

  let toplamDeger = 0
  let kritikSayisi = 0
  let sifirSayisi = 0
  let negatifSayisi = 0
  let araliktaGuncellenenSayisi = 0
  const depoMap = new Map<string, { urunSayisi: number; toplamDeger: number }>()
  const grupMap = new Map<string, { urunSayisi: number; toplamDeger: number }>()

  for (const s of stoklar) {
    const mevcut = sayi(s.mevcutMiktar)
    const min = sayi(s.minSeviye)
    const deger = mevcut * sayi(s.ortalamaMaliyet)
    toplamDeger += deger

    if (mevcut < 0) negatifSayisi++
    else if (mevcut === 0) sifirSayisi++
    if (min > 0 && mevcut <= min) kritikSayisi++
    if (s.guncellemeTarihi >= bas && s.guncellemeTarihi <= bit) araliktaGuncellenenSayisi++

    const depoAnahtari = s.depo?.ad ?? "Depo Tanımsız"
    const depoOnceki = depoMap.get(depoAnahtari) ?? { urunSayisi: 0, toplamDeger: 0 }
    depoMap.set(depoAnahtari, {
      urunSayisi: depoOnceki.urunSayisi + 1,
      toplamDeger: depoOnceki.toplamDeger + deger,
    })

    const grupAnahtari = s.urunGrubu || "Grupsuz"
    const grupOnceki = grupMap.get(grupAnahtari) ?? { urunSayisi: 0, toplamDeger: 0 }
    grupMap.set(grupAnahtari, {
      urunSayisi: grupOnceki.urunSayisi + 1,
      toplamDeger: grupOnceki.toplamDeger + deger,
    })
  }

  const kirilimSirala = (map: Map<string, { urunSayisi: number; toplamDeger: number }>): StokSonDurumKirilim[] =>
    [...map.entries()]
      .map(([anahtar, v]) => ({ anahtar, ...v }))
      .sort((a, b) => b.toplamDeger - a.toplamDeger)

  return {
    toplamUrunSayisi: stoklar.length,
    toplamDeger,
    kritikSayisi,
    sifirSayisi,
    negatifSayisi,
    araliktaGuncellenenSayisi,
    depoKirilimi: kirilimSirala(depoMap),
    grupKirilimi: kirilimSirala(grupMap),
  }
}

// ============================================================================
//  10.10.b ENVANTER
// ============================================================================

export type EnvanterSatiri = {
  id: number
  kod: string
  ad: string
  depoAdi: string
  rafYeri: string | null
  birim: string
  mevcutMiktar: number
  ortalamaMaliyet: number
  toplamDeger: number
  araliktaGuncellendi: boolean
}

/**
 * ENVANTER — Stok Son Durum'un ÖZET/kırılımından farklı, her stok
 * kartının TEK TEK satırı (muhasebecinin sayım/denetim için istediği tam
 * döküm). 10.2/10.3'teki "grup özeti vs tek tek kalem listesi" ayrımıyla
 * (Yapılan İşçilikler vs Servis Satış Detaylı) aynı mantık: Stok Son Durum
 * = grup özeti, Envanter = kalem listesi.
 *
 * Aynı gerekçeyle mevcutMiktar × ortalamaMaliyet kullanılıyor (bkz.
 * stokSonDurumVerisi yorumu). Tarih aralığı yine sorguyu daraltmıyor, her
 * satırı "bu aralıkta güncellendi mi" diye işaretliyor (VKN Aynı
 * Olanlar'daki `aralikIcinde` deseniyle birebir aynı).
 */
export async function envanterVerisi(f: RaporTarihFiltreleri, depoId?: string): Promise<EnvanterSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const stoklar = await prisma.stok.findMany({
    where: {
      silindi: false,
      aktif: true,
      ...(depoId ? { depoId: Number(depoId) } : {}),
    },
    orderBy: { kod: "asc" },
    select: {
      id: true,
      kod: true,
      ad: true,
      rafYeri: true,
      birim: true,
      mevcutMiktar: true,
      ortalamaMaliyet: true,
      guncellemeTarihi: true,
      depo: { select: { ad: true } },
    },
  })

  return stoklar.map((s) => {
    const mevcutMiktar = sayi(s.mevcutMiktar)
    const ortalamaMaliyet = sayi(s.ortalamaMaliyet)
    return {
      id: s.id,
      kod: s.kod,
      ad: s.ad,
      depoAdi: s.depo?.ad ?? "—",
      rafYeri: s.rafYeri,
      birim: s.birim,
      mevcutMiktar,
      ortalamaMaliyet,
      toplamDeger: mevcutMiktar * ortalamaMaliyet,
      araliktaGuncellendi: s.guncellemeTarihi >= bas && s.guncellemeTarihi <= bit,
    }
  })
}

// ============================================================================
//  10.11.a STOK KÂR-ZARAR
// ============================================================================

export type StokKarZararSatiri = {
  stokId: number
  kod: string
  ad: string
  urunGrubu: string
  satisMiktari: number
  satisTutari: number
  maliyet: number
  kar: number
  karMarji: number
}

export type StokKarZararGrup = { urunGrubu: string; satisTutari: number; maliyet: number; kar: number }

export type StokKarZararOzeti = {
  satirlar: StokKarZararSatiri[]
  grupKirilimi: StokKarZararGrup[]
  toplamSatisTutari: number
  toplamMaliyet: number
  toplamKar: number
  toplamKarMarji: number
}

/**
 * STOK KÂR-ZARAR — "seçili aralıkta satılan stoktan ne kadar kâr edildi"
 *
 * Stok Son Durum'un (10.10.a) DEVAMI ama eksen farklı: o ANLIK duruma
 * (`mevcutMiktar`) bakıyordu, bu HAREKETE/SATIŞA bakıyor — o yüzden burada
 * tarih aralığı 10.10'un aksine SORGUYU GERÇEKTEN DARALTIYOR: satış zaten
 * bir tarihte oluyor, "son durum" değil "dönem" sorusu bu.
 *
 * Kâr = satış tutarı − (miktar × GÜNCEL ortalamaMaliyet) — Onarım Kârlılık'ta
 * (10.1, `karlilikVerisi`) da aynı yöntem: kalem yazıldığı andaki maliyet
 * ayrıca tutulmuyor, o yüzden stoğun bugünkü ortalama maliyeti kullanılıyor.
 * "Stok değeri" de (73.1, Stok Son Durum) aynı alanla hesaplanmıştı — üçü
 * tutarlı.
 *
 * İKİ KAYNAK birleştirildi, biri ATLANMADI:
 *  1. `EvrakKalem` — tur=SATIS/PERAKENDE (kesilen faturalardan gerçek satış)
 *     ve tur=IADE_SATIS (kârdan DÜŞÜLÜR — BA-BS/Cari Alış-Satış'taki (10.8)
 *     "iade kendi yönünden netlenir" kararıyla aynı mantık).
 *  2. `KabulKalem` tur=PARCA — Araç Kabul'den (servis işi sırasında) satılan
 *     parçalar. Kabul teslim edildiğinde OTOMATİK bir Evrak(SERVIS) ÜRETİLMİYOR
 *     (kodda böyle bir oluşturma yok — kontrol edildi), yani bu satışlar
 *     EvrakKalem'de HİÇ görünmüyor. Bu kaynağı dışarıda bırakmak, dükkânın
 *     asıl parça satış hacminin büyük kısmını (servisten satılan parça) rapor
 *     dışı bırakırdı — o yüzden KabulKalem de dahil edildi, Onarım Kârlılık'ta
 *     (10.1) zaten aynı veriden kâr hesaplanıyordu, kod tekrarından çekinilmedi.
 *
 * StokHareket tabanlı DEĞİL (10.12'nin — Stok Hareket Analizi/Giriş-Çıkış
 * Analizi — konusu, görev tanımının uyarısı) — EvrakKalem/KabulKalem üzerinden
 * gidildi.
 *
 * Stok/ürün grubu bazında kırılım + toplam kâr + kâr marjı (%) üretiliyor.
 * Kataloğa bağlı olmayan serbest satırlar (`stokId` boş) kâr hesabına
 * KATILAMAZ — maliyeti bilinmiyor, o yüzden dışlandı (Yapılan Parçalar'daki
 * 10.2.b aksine, o miktar/ciro sayıyordu, burada maliyet şart).
 */
export async function stokKarZararVerisi(f: RaporTarihFiltreleri): Promise<StokKarZararOzeti> {
  const { bas, bit } = raporAraligi(f)

  const [evrakKalemleri, kabulKalemleri] = await Promise.all([
    prisma.evrakKalem.findMany({
      where: {
        stokId: { not: null },
        evrak: {
          silindi: false,
          durum: "KESILDI",
          tur: { in: ["SATIS", "PERAKENDE", "IADE_SATIS"] },
          tarih: { gte: bas, lte: bit },
        },
      },
      select: {
        miktar: true,
        tutar: true,
        stokId: true,
        evrak: { select: { tur: true } },
        stok: { select: { kod: true, ad: true, urunGrubu: true, ortalamaMaliyet: true } },
      },
    }),
    prisma.kabulKalem.findMany({
      where: {
        tur: "PARCA",
        stokId: { not: null },
        kabul: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
      },
      select: {
        miktar: true,
        tutar: true,
        stokId: true,
        stok: { select: { kod: true, ad: true, urunGrubu: true, ortalamaMaliyet: true } },
      },
    }),
  ])

  const satirMap = new Map<number, StokKarZararSatiri>()

  const isle = (
    stokId: number | null,
    stok: { kod: string; ad: string; urunGrubu: string | null; ortalamaMaliyet: Prisma.Decimal } | null,
    miktarHam: Prisma.Decimal,
    tutarHam: Prisma.Decimal,
    yonEksi: boolean
  ) => {
    if (!stokId || !stok) return // maliyeti bilinmeyen serbest satır — kâr hesabına giremez
    const isaret = yonEksi ? -1 : 1
    const miktar = isaret * sayi(miktarHam)
    const tutar = isaret * sayi(tutarHam)
    const maliyet = miktar * sayi(stok.ortalamaMaliyet)

    const satir =
      satirMap.get(stokId) ??
      ({
        stokId,
        kod: stok.kod,
        ad: stok.ad,
        urunGrubu: stok.urunGrubu || "Grupsuz",
        satisMiktari: 0,
        satisTutari: 0,
        maliyet: 0,
        kar: 0,
        karMarji: 0,
      } satisfies StokKarZararSatiri)

    satir.satisMiktari += miktar
    satir.satisTutari += tutar
    satir.maliyet += maliyet
    satirMap.set(stokId, satir)
  }

  for (const k of evrakKalemleri) {
    isle(k.stokId, k.stok, k.miktar, k.tutar, k.evrak.tur === "IADE_SATIS")
  }
  for (const k of kabulKalemleri) {
    isle(k.stokId, k.stok, k.miktar, k.tutar, false)
  }

  const grupMap = new Map<string, StokKarZararGrup>()
  let toplamSatisTutari = 0
  let toplamMaliyet = 0

  for (const satir of satirMap.values()) {
    satir.kar = satir.satisTutari - satir.maliyet
    satir.karMarji = satir.satisTutari !== 0 ? (satir.kar / satir.satisTutari) * 100 : 0

    const grup = grupMap.get(satir.urunGrubu) ?? { urunGrubu: satir.urunGrubu, satisTutari: 0, maliyet: 0, kar: 0 }
    grup.satisTutari += satir.satisTutari
    grup.maliyet += satir.maliyet
    grup.kar += satir.kar
    grupMap.set(satir.urunGrubu, grup)

    toplamSatisTutari += satir.satisTutari
    toplamMaliyet += satir.maliyet
  }

  const toplamKar = toplamSatisTutari - toplamMaliyet

  return {
    satirlar: [...satirMap.values()].sort((a, b) => b.kar - a.kar),
    grupKirilimi: [...grupMap.values()].sort((a, b) => b.kar - a.kar),
    toplamSatisTutari,
    toplamMaliyet,
    toplamKar,
    toplamKarMarji: toplamSatisTutari !== 0 ? (toplamKar / toplamSatisTutari) * 100 : 0,
  }
}

// ============================================================================
//  10.11.b STOK DETAYLI ALIŞ-SATIŞ
// ============================================================================

export type StokAlisSatisSatiri = {
  id: string
  tarih: Date
  stokId: number | null
  kod: string
  ad: string
  yon: "ALIS" | "SATIS" | "IADE_ALIS" | "IADE_SATIS"
  kaynak: "Fatura" | "Kabul"
  belgeNo: string
  miktar: number
  birimFiyat: number
  tutar: number
}

/**
 * STOK DETAYLI ALIŞ-SATIŞ — "hangi stok ne zaman, kaça alındı, kaça satıldı"
 *
 * Cari Alış-Satış'la (10.8, `cariAlisSatisVerisi`) KARIŞTIRILMASIN — İKİSİNİN
 * DE ADI "alış-satış" ama EKSENİ FARKLI: o CARİ bazında kırılım yapıyordu
 * ("bu cariyle ne kadar alışverişimiz oldu"), bu STOK/ürün bazında satır
 * satır döküm yapıyor ("bu ürün ne zaman kaça alındı/satıldı") — 10.10.b
 * Envanter'deki "kalem listesi" fikriyle aynı ama ANLIK durum değil, ZAMAN
 * İÇİNDEKİ HAREKET/işlem satırları.
 *
 * Kaynak `EvrakKalem` (ALIS/IADE_ALIS/SATIS/PERAKENDE/IADE_SATIS, tek
 * listede `yon` sütunuyla ayrılıyor — Cari Alış-Satış'taki gibi ayrı ayrı
 * toplam sütunu değil, burada satır bazlı olduğu için "yön" yeterli) VE
 * `KabulKalem` tur=PARCA (Kâr-Zarar'daki 10.11.a gerekçeyle AYNI: Araç
 * Kabul'den satılan parçalar Evrak'a hiç düşmüyor, atlanırsa döküm eksik
 * kalırdı — `kaynak` sütunuyla hangi kayıttan geldiği ayırt ediliyor).
 *
 * `stokAra` (kod/ad) opsiyonel serbest metin filtresi — Cari Hareket
 * raporundaki `cariAra` deseniyle aynı fikir, tek ürüne daraltmak için.
 */
export async function stokAlisSatisVerisi(
  f: RaporTarihFiltreleri,
  stokAra = ""
): Promise<StokAlisSatisSatiri[]> {
  const { bas, bit } = raporAraligi(f)
  const arama = stokAra.trim()
  const stokFiltresi = arama
    ? {
        OR: [
          { kod: { contains: arama, mode: "insensitive" as const } },
          { ad: { contains: arama, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [evrakKalemleri, kabulKalemleri] = await Promise.all([
    prisma.evrakKalem.findMany({
      where: {
        stokId: { not: null },
        stok: arama ? stokFiltresi : undefined,
        evrak: {
          silindi: false,
          durum: "KESILDI",
          tur: { in: ["ALIS", "IADE_ALIS", "SATIS", "PERAKENDE", "IADE_SATIS"] },
          tarih: { gte: bas, lte: bit },
        },
      },
      orderBy: { evrak: { tarih: "desc" } },
      select: {
        id: true,
        miktar: true,
        birimFiyat: true,
        tutar: true,
        stokId: true,
        stok: { select: { kod: true, ad: true } },
        evrak: { select: { tur: true, tarih: true, evrakNo: true } },
      },
    }),
    prisma.kabulKalem.findMany({
      where: {
        tur: "PARCA",
        stokId: { not: null },
        stok: arama ? stokFiltresi : undefined,
        kabul: { silindi: false, teslimTarihi: { gte: bas, lte: bit } },
      },
      orderBy: { kabul: { teslimTarihi: "desc" } },
      select: {
        id: true,
        miktar: true,
        birimFiyat: true,
        tutar: true,
        stokId: true,
        stok: { select: { kod: true, ad: true } },
        kabul: { select: { teslimTarihi: true, kabulNo: true } },
      },
    }),
  ])

  // Sorgu zaten ALIS/IADE_ALIS/SATIS/PERAKENDE/IADE_SATIS ile sınırlı — SERVIS
  // buraya hiç düşmez, yine de switch tüm EvrakTur değerlerini kapsar (tip
  // güvenliği için), tanınmayan değer "SATIS"a düşer.
  const yonEsle = (tur: (typeof evrakKalemleri)[number]["evrak"]["tur"]): StokAlisSatisSatiri["yon"] => {
    switch (tur) {
      case "ALIS":
        return "ALIS"
      case "IADE_ALIS":
        return "IADE_ALIS"
      case "IADE_SATIS":
        return "IADE_SATIS"
      default:
        return "SATIS" // SATIS, PERAKENDE
    }
  }

  const satirlar: StokAlisSatisSatiri[] = []

  for (const k of evrakKalemleri) {
    if (!k.stok) continue
    satirlar.push({
      id: `e${k.id}`,
      tarih: k.evrak.tarih,
      stokId: k.stokId,
      kod: k.stok.kod,
      ad: k.stok.ad,
      yon: yonEsle(k.evrak.tur),
      kaynak: "Fatura",
      belgeNo: k.evrak.evrakNo,
      miktar: sayi(k.miktar),
      birimFiyat: sayi(k.birimFiyat),
      tutar: sayi(k.tutar),
    })
  }
  for (const k of kabulKalemleri) {
    if (!k.stok || !k.kabul.teslimTarihi) continue
    satirlar.push({
      id: `k${k.id}`,
      tarih: k.kabul.teslimTarihi,
      stokId: k.stokId,
      kod: k.stok.kod,
      ad: k.stok.ad,
      yon: "SATIS",
      kaynak: "Kabul",
      belgeNo: k.kabul.kabulNo,
      miktar: sayi(k.miktar),
      birimFiyat: sayi(k.birimFiyat),
      tutar: sayi(k.tutar),
    })
  }

  return satirlar.sort((a, b) => b.tarih.getTime() - a.tarih.getTime())
}

// ============================================================================
//  10.11.c STOK MALİYET & SATIŞ
// ============================================================================

export type MaliyetSatisSatiri = {
  id: number
  kod: string
  ad: string
  urunGrubu: string
  ortalamaMaliyet: number
  satisFiyat: number
  fark: number
  marj: number
  araliktaGuncellendi: boolean
}

/**
 * STOK MALİYET & SATIŞ — "ürün bazında ortalama maliyet vs satış fiyatı,
 * aradaki fark/oran ne" sorusu.
 *
 * Kâr-Zarar'dan (10.11.a) FARKI: o GERÇEKLEŞEN satışlara bakıyor (dönem
 * içinde fiilen ne satıldı, ne kazanıldı — geçmişe dönük), bu rapor ANLIK
 * bir fiyatlama tablosu — StokHareket'e/satışa bakmıyor, "şu an fiyatlama
 * ne durumda, hangi ürünün marjı düşük" sorusu (ileriye dönük/POTANSİYEL
 * marj — henüz hiç satılmamış bir ürünün de marjı burada görünür, Kâr-Zarar'da
 * görünmezdi). Stok Son Durum'a (10.10.a) daha yakın: `Stok` tablosunun
 * GÜNCEL alanlarını okuyor, tarih aralığı SORGUYU DARALTMIYOR (aynı
 * gerekçe — "son durum"/"şu an" sorusu), aralık yalnız `guncellemeTarihi`yi
 * işaretlemek için kullanılıyor (73.1/73.2'deki desenle birebir aynı).
 */
export async function maliyetSatisVerisi(f: RaporTarihFiltreleri): Promise<MaliyetSatisSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const stoklar = await prisma.stok.findMany({
    where: { silindi: false, aktif: true },
    orderBy: { kod: "asc" },
    select: {
      id: true,
      kod: true,
      ad: true,
      urunGrubu: true,
      ortalamaMaliyet: true,
      satisFiyat: true,
      guncellemeTarihi: true,
    },
  })

  return stoklar.map((s) => {
    const ortalamaMaliyet = sayi(s.ortalamaMaliyet)
    const satisFiyat = sayi(s.satisFiyat)
    const fark = satisFiyat - ortalamaMaliyet
    return {
      id: s.id,
      kod: s.kod,
      ad: s.ad,
      urunGrubu: s.urunGrubu || "Grupsuz",
      ortalamaMaliyet,
      satisFiyat,
      fark,
      marj: satisFiyat > 0 ? (fark / satisFiyat) * 100 : 0,
      araliktaGuncellendi: s.guncellemeTarihi >= bas && s.guncellemeTarihi <= bit,
    }
  })
}

// ============================================================================
//  10.12.a GİRİŞ-ÇIKIŞ ANALİZİ
// ============================================================================

export type GirisCikisTurSatiri = {
  tur: StokHareketTur
  turAdi: string
  hareketSayisi: number
  girisMiktar: number
  cikisMiktar: number
  netMiktar: number
  girisTutar: number
  cikisTutar: number
  netTutar: number
}

export type GirisCikisStokSatiri = {
  stokId: number
  kod: string
  ad: string
  urunGrubu: string
  girisMiktar: number
  cikisMiktar: number
  netMiktar: number
  girisTutar: number
  cikisTutar: number
  netTutar: number
}

export type GirisCikisGrupSatiri = {
  urunGrubu: string
  girisMiktar: number
  cikisMiktar: number
  netMiktar: number
  netTutar: number
}

export type GirisCikisOzeti = {
  turKirilimi: GirisCikisTurSatiri[]
  stokKirilimi: GirisCikisStokSatiri[]
  grupKirilimi: GirisCikisGrupSatiri[]
  toplamGiris: number
  toplamCikis: number
  toplamNet: number
  /** Dönem net tutarı (giren mal bedeli − çıkan mal bedeli). */
  toplamNetTutar: number
}

/**
 * GİRİŞ-ÇIKIŞ ANALİZİ — "dönemde depoya ne kadar girdi, ne kadar çıktı, net
 * değişim ne" sorusu. 10.10-10.11'in (Stok Son Durum/Kâr-Zarar/Alış-Satış)
 * AKSİNE bu rapor `StokHareket` tablosuna DAYANIR — "depoya ne girdi ne
 * çıktı" sorusunun tek gerçek kaynağı stok hareketidir (Kâr-Zarar'daki
 * "satıştan kâr" sorusunun tek gerçek kaynağının EvrakKalem/KabulKalem
 * olmasıyla aynı ayrım, bkz. HAFIZA 75).
 *
 * `/stok/hareket`teki `hareketVerisi()`nin SATIR SATIR dökümünün AGREGE/ÖZET
 * hali — o fonksiyon KOPYALANMADI, yön/tür mantığı (`hareketYonu`,
 * `HAREKET_TUR_ADI`) oradan import edilip tekilleştirildi, burada sadece
 * StokHareket'i doğrudan sorgulayan YENİ bir toplama fonksiyonu yazıldı.
 * Satır satır döküm isteyen kullanıcı için Stok Hareket Analizi (10.12.b) ya
 * da doğrudan `/stok/hareket` var.
 *
 * Stok Son Durum/Kâr-Zarar'daki gibi tarih aralığı burada GERÇEKTEN
 * DARALTIYOR — hareket zaten bir tarihte oluyor, "son durum" değil "dönem"
 * sorusu. Tür bazında (GIRIS/CIKIS/DEVIR/SAYIM/TRANSFER) toplam miktar+tutar
 * kırılımı VE stok/ürün grubu bazında net değişim (giriş−çıkış) kırılımı
 * birlikte üretilir.
 */
export async function girisCikisAnaliziVerisi(f: RaporTarihFiltreleri): Promise<GirisCikisOzeti> {
  const { bas, bit } = raporAraligi(f)

  const hareketler = await prisma.stokHareket.findMany({
    where: { tarih: { gte: bas, lte: bit } },
    select: {
      tur: true,
      miktar: true,
      tutar: true,
      birimFiyat: true,
      stok: { select: { id: true, kod: true, ad: true, urunGrubu: true } },
    },
  })

  const turMap = new Map<StokHareketTur, GirisCikisTurSatiri>()
  const stokMap = new Map<number, GirisCikisStokSatiri>()
  const grupMap = new Map<string, GirisCikisGrupSatiri>()
  let toplamGiris = 0
  let toplamCikis = 0

  for (const h of hareketler) {
    const m = sayi(h.miktar)
    const t = hareketTutari(h)
    const artiMi = hareketYonu(h.tur) === 1
    const girisM = artiMi ? m : 0
    const cikisM = artiMi ? 0 : m
    const girisT = artiMi ? t : 0
    const cikisT = artiMi ? 0 : t
    toplamGiris += girisM
    toplamCikis += cikisM

    const turSatir =
      turMap.get(h.tur) ??
      ({
        tur: h.tur,
        turAdi: HAREKET_TUR_ADI[h.tur],
        hareketSayisi: 0,
        girisMiktar: 0,
        cikisMiktar: 0,
        netMiktar: 0,
        girisTutar: 0,
        cikisTutar: 0,
        netTutar: 0,
      } satisfies GirisCikisTurSatiri)
    turSatir.hareketSayisi += 1
    turSatir.girisMiktar += girisM
    turSatir.cikisMiktar += cikisM
    turSatir.netMiktar += girisM - cikisM
    turSatir.girisTutar += girisT
    turSatir.cikisTutar += cikisT
    turSatir.netTutar += girisT - cikisT
    turMap.set(h.tur, turSatir)

    const urunGrubu = h.stok.urunGrubu || "Grupsuz"

    const stokSatir =
      stokMap.get(h.stok.id) ??
      ({
        stokId: h.stok.id,
        kod: h.stok.kod,
        ad: h.stok.ad,
        urunGrubu,
        girisMiktar: 0,
        cikisMiktar: 0,
        netMiktar: 0,
        girisTutar: 0,
        cikisTutar: 0,
        netTutar: 0,
      } satisfies GirisCikisStokSatiri)
    stokSatir.girisMiktar += girisM
    stokSatir.cikisMiktar += cikisM
    stokSatir.netMiktar += girisM - cikisM
    stokSatir.girisTutar += girisT
    stokSatir.cikisTutar += cikisT
    stokSatir.netTutar += girisT - cikisT
    stokMap.set(h.stok.id, stokSatir)

    const grupSatir =
      grupMap.get(urunGrubu) ?? ({ urunGrubu, girisMiktar: 0, cikisMiktar: 0, netMiktar: 0, netTutar: 0 } satisfies GirisCikisGrupSatiri)
    grupSatir.girisMiktar += girisM
    grupSatir.cikisMiktar += cikisM
    grupSatir.netMiktar += girisM - cikisM
    grupSatir.netTutar += girisT - cikisT
    grupMap.set(urunGrubu, grupSatir)
  }

  return {
    turKirilimi: [...turMap.values()].sort((a, b) => b.hareketSayisi - a.hareketSayisi),
    stokKirilimi: [...stokMap.values()].sort((a, b) => Math.abs(b.netTutar) - Math.abs(a.netTutar)),
    grupKirilimi: [...grupMap.values()].sort((a, b) => Math.abs(b.netTutar) - Math.abs(a.netTutar)),
    toplamGiris,
    toplamCikis,
    toplamNet: toplamGiris - toplamCikis,
    toplamNetTutar: [...stokMap.values()].reduce((t, s) => t + s.netTutar, 0),
  }
}

// ============================================================================
//  10.13.a ÖLÜ STOK
// ============================================================================

/** Eşik ekranda değiştirilemez sabit — Geri Dönüş raporundaki (10.4, 30 gün)
 * kararla aynı mantık, HAFIZA'da gerekçesi var. */
export const OLU_STOK_ESIK_GUN = 90

export type OluStokSatiri = {
  id: number
  kod: string
  ad: string
  urunGrubu: string
  depoAdi: string
  mevcutMiktar: number
  baglananDeger: number
  sonHareketTarihi: Date | null
  gunFarki: number | null
}

/**
 * ÖLÜ STOK — "hangi stok kartı UZUN SÜREDİR hiç hareket görmedi" sorusu.
 * 10.10-10.11'in AKSİNE (onlar Stok'un GÜNCEL alanlarına/EvrakKalem-KabulKalem'e
 * bakıyordu) bu rapor 10.12'nin (Giriş-Çıkış Analizi) `StokHareket` kaynağına
 * DAYANIR — bir stoğun "ölü" olup olmadığı ancak en son ne zaman hareket
 * gördüğüne bakılarak anlaşılır, `Stok.guncellemeTarihi` bu soruyu cevaplamaz
 * (fiyat güncellemesinde de değişir, hareketle ilgisi yok — 10.10/10.11'de
 * netleşen ayrım).
 *
 * Aktif VE `mevcutMiktar>0` olan (elde parası duran, satılmamış) kartlar
 * arasından, StokHareket'teki EN SON hareket tarihi eşikten (90 gün, sabit)
 * daha eski olanlar YA DA hiç hareketi olmayanlar (kayıt açıldığından beri
 * hiç girmemiş/çıkmamış) listelenir. "Bağlı kalan para" = mevcutMiktar ×
 * ortalamaMaliyet — 10.10.a Stok Son Durum'daki stok değeri hesabıyla aynı.
 *
 * Tarih aralığı 10.9 VKN Aynı Olanlar'daki gibi SORGUYU DARALTMAZ — ölü stok
 * "şu an" durumudur, dönemsel değil. Aralığın `bit`i yalnızca "bugünün
 * tarihi" referansı olarak kullanılır ("bu tarih itibariyle kaç gündür
 * hareketsiz") — varsayılan bugün olduğu için normal kullanımda fark etmez,
 * geçmişe dönük bir tarih seçilirse o tarihe göre gün farkı hesaplanır.
 */
export async function oluStokVerisi(
  f: RaporTarihFiltreleri
): Promise<{ satirlar: OluStokSatiri[]; esikGun: number; referansTarihi: Date }> {
  const { bit } = raporAraligi(f)

  const stoklar = await prisma.stok.findMany({
    where: { silindi: false, aktif: true, mevcutMiktar: { gt: 0 } },
    select: {
      id: true,
      kod: true,
      ad: true,
      urunGrubu: true,
      mevcutMiktar: true,
      ortalamaMaliyet: true,
      depo: { select: { ad: true } },
    },
  })
  if (!stoklar.length) return { satirlar: [], esikGun: OLU_STOK_ESIK_GUN, referansTarihi: bit }

  const sonHareketler = await prisma.stokHareket.groupBy({
    by: ["stokId"],
    where: { stokId: { in: stoklar.map((s) => s.id) } },
    _max: { tarih: true },
  })
  const sonHareketMap = new Map(sonHareketler.map((h) => [h.stokId, h._max.tarih]))

  const MS_GUN = 1000 * 60 * 60 * 24
  const satirlar: OluStokSatiri[] = []

  for (const s of stoklar) {
    const sonHareketTarihi = sonHareketMap.get(s.id) ?? null
    const gunFarki = sonHareketTarihi ? Math.floor((bit.getTime() - sonHareketTarihi.getTime()) / MS_GUN) : null
    // Hiç hareketi olmayanlar HER ZAMAN ölü sayılır; hareketi olanlar eşikten eski olmalı.
    if (sonHareketTarihi && gunFarki !== null && gunFarki < OLU_STOK_ESIK_GUN) continue

    const mevcutMiktar = sayi(s.mevcutMiktar)
    satirlar.push({
      id: s.id,
      kod: s.kod,
      ad: s.ad,
      urunGrubu: s.urunGrubu || "Grupsuz",
      depoAdi: s.depo?.ad ?? "—",
      mevcutMiktar,
      baglananDeger: mevcutMiktar * sayi(s.ortalamaMaliyet),
      sonHareketTarihi,
      gunFarki,
    })
  }

  return {
    satirlar: satirlar.sort((a, b) => (b.gunFarki ?? Infinity) - (a.gunFarki ?? Infinity)),
    esikGun: OLU_STOK_ESIK_GUN,
    referansTarihi: bit,
  }
}

// ============================================================================
//  10.13.b EN ÇOK KULLANILAN PARÇA
// ============================================================================

export type EnCokKullanilanSatiri = {
  stokId: number
  kod: string
  ad: string
  urunGrubu: string
  depoAdi: string
  cikisMiktar: number
  cikisTutar: number
  islemSayisi: number
}

export type EnCokKullanilanGrupSatiri = { urunGrubu: string; cikisMiktar: number; cikisTutar: number }

export type EnCokKullanilanOzeti = {
  miktaraGoreSirali: EnCokKullanilanSatiri[]
  tutaraGoreSirali: EnCokKullanilanSatiri[]
  grupKirilimi: EnCokKullanilanGrupSatiri[]
  toplamMiktar: number
  toplamTutar: number
}

/**
 * EN ÇOK KULLANILAN PARÇA — Ölü Stok'un TAM TERSİ: "hangi parça en çok
 * satılıyor/tüketiliyor" sorusu. 10.2.b Yapılan Parçalar'a (yalnız servis
 * içi tüketim, `KabulKalem` tur=PARCA) YAKIN ama EKSENİ GENİŞ: kaynak olarak
 * `StokHareket` tur=CIKIS seçildi (Giriş-Çıkış Analizi'yle aynı kaynak,
 * HAFIZA 75.0 ayrımıyla tutarlı) — çünkü "kullanım" satıştan bağımsız da
 * olabilir ve StokHareket her gerçek çıkışın tek toplandığı yer.
 *
 * ANCAK ham `tur=CIKIS` tek başına yeterli DEĞİL: Depo Transferi'nin kaynak
 * depodaki çıkışı da `tur=CIKIS` yazıyor (bkz. `stok/transfer/actions.ts`)
 * — bu bir tüketim değil, aynı malın yer değiştirmesi, sayıma dahil edilirse
 * "en çok kullanılan" listesi yanıltıcı olurdu. Sayım farkı zaten ayrı tür
 * (`SAYIM`) olduğu için karışmıyor. Ayrım: transfer çıkışının `kabulId` VE
 * `evrakId`si YOK (yalnız `aciklama` metni var); gerçek tüketim ya bir
 * kabuldan (servis parça çıkışı) ya bir evraktan (satış faturası) doğar —
 * o yüzden `tur=CIKIS AND (kabulId dolu OR evrakId dolu)` şartı kullanıldı.
 *
 * Miktar VE tutar bazında AYRI sıralama sağlanır (en çok adet giden ile en
 * çok ciro getiren farklı ürünler olabilir), stok/ürün grubu kırılımı da
 * eklendi. Tarih aralığı burada Giriş-Çıkış Analizi'yle (10.12) aynı mantıkla
 * GERÇEKTEN DARALTIR — "kullanım" bir dönemde oluyor, "şu an" sorusu değil.
 */
export async function enCokKullanilanVerisi(f: RaporTarihFiltreleri): Promise<EnCokKullanilanOzeti> {
  const { bas, bit } = raporAraligi(f)

  const hareketler = await prisma.stokHareket.findMany({
    where: {
      tur: "CIKIS",
      tarih: { gte: bas, lte: bit },
      OR: [{ kabulId: { not: null } }, { evrakId: { not: null } }],
    },
    select: {
      miktar: true,
      tutar: true,
      birimFiyat: true,
      stok: { select: { id: true, kod: true, ad: true, urunGrubu: true, depo: { select: { ad: true } } } },
    },
  })

  const stokMap = new Map<number, EnCokKullanilanSatiri>()
  const grupMap = new Map<string, EnCokKullanilanGrupSatiri>()
  let toplamMiktar = 0
  let toplamTutar = 0

  for (const h of hareketler) {
    const m = sayi(h.miktar)
    const t = hareketTutari(h)
    toplamMiktar += m
    toplamTutar += t
    const urunGrubu = h.stok.urunGrubu || "Grupsuz"

    const satir =
      stokMap.get(h.stok.id) ??
      ({
        stokId: h.stok.id,
        kod: h.stok.kod,
        ad: h.stok.ad,
        urunGrubu,
        depoAdi: h.stok.depo?.ad ?? "—",
        cikisMiktar: 0,
        cikisTutar: 0,
        islemSayisi: 0,
      } satisfies EnCokKullanilanSatiri)
    satir.cikisMiktar += m
    satir.cikisTutar += t
    satir.islemSayisi += 1
    stokMap.set(h.stok.id, satir)

    const grup = grupMap.get(urunGrubu) ?? { urunGrubu, cikisMiktar: 0, cikisTutar: 0 }
    grup.cikisMiktar += m
    grup.cikisTutar += t
    grupMap.set(urunGrubu, grup)
  }

  const satirlar = [...stokMap.values()]
  return {
    miktaraGoreSirali: [...satirlar].sort((a, b) => b.cikisMiktar - a.cikisMiktar),
    tutaraGoreSirali: [...satirlar].sort((a, b) => b.cikisTutar - a.cikisTutar),
    grupKirilimi: [...grupMap.values()].sort((a, b) => b.cikisTutar - a.cikisTutar),
    toplamMiktar,
    toplamTutar,
  }
}

// ============================================================================
//  10.13.c BUGÜN EKLENENLER
// ============================================================================

export type BugunEklenenStokSatiri = {
  id: number
  kod: string
  ad: string
  urunGrubu: string
  depoAdi: string
  mevcutMiktar: number
  satisFiyat: number
  olusturanAdi: string
  olusturmaTarihi: Date
}

/**
 * BUGÜN EKLENENLER — 10.9'daki "Bugün Açılan Cariler"in stok karşılığı,
 * AYNI DESEN: `Cari.olusturmaTarihi` yerine `Stok.olusturmaTarihi` dökümü.
 * İsim "Bugün" ama 10.9'daki gibi SERBEST tarih aralığı (tek güne
 * kilitlenmedi) — ORTAK KURALLAR'daki "her raporda tarih aralığı filtresi"
 * maddesiyle tutarlı, varsayılan aralık yine ay başı-bugün.
 *
 * Depo/ürün grubu filtresi eklendi (Envanter'deki depo filtresiyle aynı
 * desen). Kim eklemiş bilgisi `Stok.olusturanId` alanından geliyor (Cari'deki
 * `olusturanId` ile birebir aynı alan/şema deseni, kullanıcı adı haritası
 * 10.9'daki gibi ayrı sorguyla çözülüyor).
 *
 * Tarih aralığı SORGUYU DARALTIR — 10.9 Bugün Açılan Cariler'le birebir
 * aynı mantık, `olusturmaTarihi` zaten tek bir anda oluşuyor.
 */
export async function bugunEklenenStokVerisi(
  f: RaporTarihFiltreleri,
  depoId = "",
  urunGrubu = ""
): Promise<BugunEklenenStokSatiri[]> {
  const { bas, bit } = raporAraligi(f)

  const stoklar = await prisma.stok.findMany({
    where: {
      silindi: false,
      olusturmaTarihi: { gte: bas, lte: bit },
      ...(depoId ? { depoId: Number(depoId) } : {}),
      ...(urunGrubu ? { urunGrubu } : {}),
    },
    orderBy: [{ olusturmaTarihi: "desc" }],
    select: {
      id: true,
      kod: true,
      ad: true,
      urunGrubu: true,
      mevcutMiktar: true,
      satisFiyat: true,
      olusturanId: true,
      olusturmaTarihi: true,
      depo: { select: { ad: true } },
    },
  })

  const idler = [...new Set(stoklar.map((s) => s.olusturanId).filter((v): v is number => v != null))]
  const kullanicilar = idler.length
    ? await prisma.kullanici.findMany({ where: { id: { in: idler } }, select: { id: true, ad: true, soyad: true } })
    : []
  const adHaritasi = new Map(kullanicilar.map((k) => [k.id, `${k.ad} ${k.soyad ?? ""}`.trim()]))

  return stoklar.map((s) => ({
    id: s.id,
    kod: s.kod,
    ad: s.ad,
    urunGrubu: s.urunGrubu || "Grupsuz",
    depoAdi: s.depo?.ad ?? "—",
    mevcutMiktar: sayi(s.mevcutMiktar),
    satisFiyat: sayi(s.satisFiyat),
    olusturanAdi: s.olusturanId ? (adHaritasi.get(s.olusturanId) ?? "—") : "—",
    olusturmaTarihi: s.olusturmaTarihi,
  }))
}
