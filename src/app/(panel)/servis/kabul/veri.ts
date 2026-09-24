import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { TanimTur } from "@/generated/prisma/enums"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/** `<input type="date">` "YYYY-MM-DD" ister. */
const gun = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/**
 * `<input type="time">` için yerel saat. `toISOString()` UTC'ye çevirdiği
 * için kullanılamaz — Türkiye'de kaydedilen 09:00 ekranda 06:00 görünürdü.
 */
const saat = (d: Date | null) =>
  d
    ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    : null

function tanimListesi(tur: TanimTur) {
  return prisma.tanim.findMany({
    where: { tur, aktif: true },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { id: true, ad: true },
  })
}

/** Kabul ekranındaki dropdown'lar — hepsi `Tanim` tablosundan gelir. */
export function kabulDropdownlariGetir() {
  return Promise.all([
    tanimListesi("KART_TURU"),
    tanimListesi("ISTEK_TURU"),
    tanimListesi("BAKIM_SEKLI"),
    tanimListesi("PROJE"),
  ]).then(([kartTurleri, istekTurleri, bakimSekilleri, projeler]) => ({
    kartTurleri,
    istekTurleri,
    bakimSekilleri,
    projeler,
  }))
}

/** Müşteri seçimi — personel kayıtları listeye girmez. */
export async function kabulCarileriGetir() {
  const cariler = await prisma.cari.findMany({
    where: { silindi: false, turu: { not: "PERSONEL" } },
    orderBy: { unvan: "asc" },
    select: {
      id: true,
      kod: true,
      unvan: true,
      telefon: true,
      gsm: true,
      yetkili: true,
      bakiye: true,
      karaListe: true,
      karaListeNedeni: true,
      notu: true,
    },
  })

  return cariler.map((c) => ({
    ...c,
    bakiye: Number(c.bakiye.toString()),
  }))
}

export type KabulCarisi = Awaited<ReturnType<typeof kabulCarileriGetir>>[number]

/**
 * Araç seçimi. Kabul ekranı araç seçilince plaka/marka/km/sigorta bilgisini
 * anında dolduruyor (Selpar'daki davranış), bu yüzden görüntülenecek alanlar
 * baştan çekiliyor — her seçimde sunucuya gitmeye gerek kalmıyor.
 */
export async function kabulAraclariGetir() {
  const araclar = await prisma.arac.findMany({
    where: { silindi: false, aktif: true },
    orderBy: { plaka: "asc" },
    select: {
      id: true,
      plaka: true,
      cariId: true,
      marka: true,
      model: true,
      modelYili: true,
      renk: true,
      saseNo: true,
      aracTuru: true,
      yakitTuru: true,
      vitesTuru: true,
      kasaTipi: true,
      motorHacmi: true,
      sonKm: true,
      trigerDegisimKm: true,
      trigerDegisimTarih: true,
      trafikSigBitis: true,
      kaskoBitis: true,
      garantiBitis: true,
      muayeneBitis: true,
      akuBitis: true,
      lpgTankSonTarih: true,
      projesi: true,
    },
  })

  return araclar.map((a) => ({
    ...a,
    trigerDegisimTarih: gun(a.trigerDegisimTarih),
    trafikSigBitis: gun(a.trafikSigBitis),
    kaskoBitis: gun(a.kaskoBitis),
    garantiBitis: gun(a.garantiBitis),
    muayeneBitis: gun(a.muayeneBitis),
    akuBitis: gun(a.akuBitis),
    lpgTankSonTarih: gun(a.lpgTankSonTarih),
  }))
}

export type KabulAraci = Awaited<ReturnType<typeof kabulAraclariGetir>>[number]

/** Formen (usta) seçimi — sistem kullanıcıları arasından. */
export function formenleriGetir() {
  return prisma.kullanici.findMany({
    where: { silindi: false, aktif: true },
    orderBy: [{ ad: "asc" }],
    select: { id: true, ad: true, soyad: true, rol: true },
  })
}

/** Kartta çalışacak personeller — Selpar'daki gibi cari tablosunda tutulur. */
export function personelleriGetir() {
  return prisma.cari.findMany({
    where: { silindi: false, aktif: true, turu: "PERSONEL" },
    orderBy: { unvan: "asc" },
    select: { id: true, unvan: true },
  })
}

/** Kabul kartını forma uygun hâle getirir. */
export async function kabulFormVerisi(id: number) {
  const k = await prisma.kabul.findUnique({
    where: { id },
    include: { personeller: { select: { personelId: true } } },
  })
  if (!k || k.silindi) return null

  return {
    id: k.id,
    kabulNo: k.kabulNo,
    kabulOzelNo: k.kabulOzelNo,
    kartTuru: k.kartTuru,
    durum: k.durum,
    cariId: k.cariId,
    aracId: k.aracId,
    girisTarihi: gun(k.girisTarihi),
    girisSaati: saat(k.girisTarihi),
    girisKm: k.girisKm,
    formenId: k.formenId,
    personelIdler: k.personeller.map((p) => p.personelId),
    tahminiTeslimTarihi: gun(k.tahminiTeslimTarihi),
    tahminiTeslimSaati: saat(k.tahminiTeslimTarihi),
    teslimNotu: k.teslimNotu,
    sikayet: k.sikayet,
    yapilanIsler: k.yapilanIsler,
    istekTuru: k.istekTuru,
    bakimSekli: k.bakimSekli,
    projesi: k.projesi,
    filoSirketi: k.filoSirketi,
    ozelEsya: k.ozelEsya,
    aracNotlari: k.aracNotlari,
    cariNotu: k.cariNotu,
    sonrakiGelisTarihi: gun(k.sonrakiGelisTarihi),
    sonrakiGelisKm: k.sonrakiGelisKm,
    garantiVerenId: k.garantiVerenId,
    garantiDosyaNo: k.garantiDosyaNo,
    garantiOnayNo: k.garantiOnayNo,
    garantiTalepTarihi: gun(k.garantiTalepTarihi),
    garantiDurumu: k.garantiDurumu,
    garantiTutar: Number(k.garantiTutar.toString()),
    garantiNotu: k.garantiNotu,
    tahminiTutar: Number(k.tahminiTutar.toString()),
    evrakKdvOrani: Number(k.evrakKdvOrani.toString()),
    kdvDahilGirilir: k.kdvDahilGirilir,
  }
}

export type KabulBaslangic = NonNullable<Awaited<ReturnType<typeof kabulFormVerisi>>>

export type KabulFiltreleri = {
  q?: string
  durum?: string
  bas?: string
  bit?: string
  formen?: string
  fatura?: string
}

const GERCEK_DURUMLAR = ["ACIK", "BEKLEMEDE", "TAMAMLANDI", "TESLIM_EDILDI", "IPTAL"]

/**
 * Liste koşulu tek yerde: ekran, sayaç ve CSV aynı filtreyi kullanır.
 * `durum` hem gerçek kabul durumunu hem de Selpar'daki hazır görünümleri
 * ("açık onarımlar", "teslimatı geçenler", "silinenler") karşılar.
 */
export function kabulListeKosulu({
  q = "",
  durum = "hepsi",
  bas = "",
  bit = "",
  formen = "",
  fatura = "",
}: KabulFiltreleri): Prisma.KabulWhereInput {
  const arama = q.trim()
  const tarihKosulu: Prisma.DateTimeFilter = {}
  if (bas && !Number.isNaN(Date.parse(bas))) tarihKosulu.gte = new Date(`${bas}T00:00:00`)
  if (bit && !Number.isNaN(Date.parse(bit))) tarihKosulu.lte = new Date(`${bit}T23:59:59`)

  return {
    silindi: durum === "silinen",
    ...(durum === "acik" ? { durum: { in: ["ACIK", "BEKLEMEDE", "TAMAMLANDI"] } } : {}),
    ...(durum === "kapali" ? { durum: "TESLIM_EDILDI" as const } : {}),
    ...(GERCEK_DURUMLAR.includes(durum)
      ? { durum: durum as Prisma.EnumKabulDurumFilter["equals"] }
      : {}),
    // "Teslimatı geçen araçlar" — ana sayfadaki uyarı kartının liste hâli.
    ...(durum === "geciken"
      ? {
          durum: { in: ["ACIK", "BEKLEMEDE", "TAMAMLANDI"] as const },
          tahminiTeslimTarihi: { lt: new Date() },
        }
      : {}),
    ...(fatura === "kesilmeyen" ? { faturaKesildi: false } : {}),
    ...(fatura === "kesilen" ? { faturaKesildi: true } : {}),
    ...(fatura === "odenmeyen" ? { odendi: false } : {}),
    ...(formen ? { formenId: Number(formen) } : {}),
    ...(Object.keys(tarihKosulu).length ? { girisTarihi: tarihKosulu } : {}),
    ...(arama
      ? {
          OR: [
            ...aramaKosullari<Prisma.KabulWhereInput>(
              ["kabulNo", "kabulOzelNo", "sikayet", "cari.unvan"],
              arama
            ),
            {
              arac: {
                plaka: {
                  contains: arama.replace(/\s+/g, ""),
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  }
}

export function kabulFiltreSorgusu(f: KabulFiltreleri): string {
  const p = new URLSearchParams()
  for (const [anahtar, deger] of Object.entries(f)) {
    if (deger && !(anahtar === "durum" && deger === "hepsi")) p.set(anahtar, String(deger))
  }
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

/** Kalem satırlarında aranan parça/işçilik kataloğu (canlı arama besler). */
export async function katalogAra(tur: "PARCA" | "ISCILIK", q: string) {
  const arama = q.trim()

  if (tur === "ISCILIK") {
    const kayitlar = await prisma.iscilik.findMany({
      where: {
        silindi: false,
        aktif: true,
        // Arama boşsa (kutuya tıklanır tıklanmaz) tüm liste görünsün diye
        // filtre uygulanmaz — kullanıcı yazmadan da aşağı kaydırıp seçebilir.
        ...(arama.length >= 2
          ? { OR: aramaKosullari<Prisma.IscilikWhereInput>(["kod", "ad"], arama) }
          : {}),
      },
      orderBy: { ad: "asc" },
      take: 20,
      select: { id: true, kod: true, ad: true, fiyat: true, kdvOrani: true },
    })
    return kayitlar.map((i) => ({
      id: i.id,
      kod: i.kod,
      ad: i.ad,
      birim: "SAAT",
      fiyat: Number(i.fiyat.toString()),
      kdvOrani: Number(i.kdvOrani.toString()),
      stokta: null as number | null,
    }))
  }

  const kayitlar = await prisma.stok.findMany({
    where: {
      silindi: false,
      aktif: true,
      ...(arama.length >= 2
        ? {
            OR: aramaKosullari<Prisma.StokWhereInput>(
              ["kod", "ad", "barkod", "orijinalKodu"],
              arama
            ),
          }
        : {}),
    },
    orderBy: { ad: "asc" },
    take: 20,
    select: {
      id: true,
      kod: true,
      ad: true,
      birim: true,
      satisFiyat: true,
      kdvOrani: true,
      mevcutMiktar: true,
    },
  })

  return kayitlar.map((s) => ({
    id: s.id,
    kod: s.kod,
    ad: s.ad,
    birim: s.birim,
    fiyat: Number(s.satisFiyat.toString()),
    kdvOrani: Number(s.kdvOrani.toString()),
    stokta: Number(s.mevcutMiktar.toString()),
  }))
}
