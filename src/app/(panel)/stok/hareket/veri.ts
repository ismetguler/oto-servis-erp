import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { StokHareketTur } from "@/generated/prisma/enums"
import { aramaKosullari } from "@/lib/arama"
import { gunBasi, gunSonu, sayi } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * STOK HAREKET DÖKÜMÜ (tüm kartlar) — okuma tarafı.
 *
 * Tekil karttaki döküm ([id]/hareketler) ile aynı mantık: devreden, seçilen
 * aralıktan önceki hareketlerin netidir, ayrı saklanmaz. Buradaki fark
 * birden fazla stok kartını aynı ekranda toplaması — "tüm kartlar"
 * görünümünde yürüyen bakiye kart bazında karışacağı için gösterilmez
 * (kasa/defter'deki tekKasa mantığıyla aynı).
 */

export const HAREKET_TUR_ADI: Record<StokHareketTur, string> = {
  GIRIS: "Giriş",
  CIKIS: "Çıkış",
  DEVIR: "Devir",
  SAYIM: "Sayım Farkı",
  TRANSFER: "Transfer",
}

/** Çıkış hareketleri miktarı düşürür, diğerleri arttırır. */
export function hareketYonu(tur: StokHareketTur): 1 | -1 {
  return tur === "CIKIS" ? -1 : 1
}

export type StokHareketFiltreleri = {
  stok?: string
  q?: string
  tur?: string
  bas?: string
  bit?: string
}

/** Varsayılan aralık: içinde bulunulan ay. */
export function varsayilanAralik() {
  const bugun = new Date()
  const ilk = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
  return { bas: yerelGun(ilk), bit: yerelGun(bugun) }
}

function yerelGun(d: Date): string {
  const ay = String(d.getMonth() + 1).padStart(2, "0")
  const gun = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${ay}-${gun}`
}

function tarihAraligi(f: StokHareketFiltreleri) {
  const v = varsayilanAralik()
  const bas = gunBasi(new Date(f.bas && f.bas !== "" ? f.bas : v.bas))
  const bit = gunSonu(new Date(f.bit && f.bit !== "" ? f.bit : v.bit))
  return { bas, bit }
}

function hareketKosulu(f: StokHareketFiltreleri): Prisma.StokHareketWhereInput {
  const { bas, bit } = tarihAraligi(f)
  const kosul: Prisma.StokHareketWhereInput = { tarih: { gte: bas, lte: bit } }
  if (f.stok && f.stok !== "" && f.stok !== "tumu") kosul.stokId = Number(f.stok)
  if (f.tur && f.tur !== "" && f.tur !== "tumu") kosul.tur = f.tur as StokHareketTur

  const q = (f.q ?? "").trim()
  if (q) {
    kosul.OR = aramaKosullari<Prisma.StokHareketWhereInput>(
      ["aciklama", "stok.kod", "stok.ad"],
      q
    )
  }
  return kosul
}

export function hareketSorgusu(f: StokHareketFiltreleri): string {
  const p = new URLSearchParams()
  if (f.stok && f.stok !== "tumu") p.set("stok", f.stok)
  if (f.q) p.set("q", f.q)
  if (f.tur && f.tur !== "tumu") p.set("tur", f.tur)
  if (f.bas) p.set("bas", f.bas)
  if (f.bit) p.set("bit", f.bit)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export type StokHareketSatiri = {
  id: number
  tarih: Date
  stokId: number
  stokKodu: string
  stokAdi: string
  birim: string
  tur: StokHareketTur
  giris: number
  cikis: number
  birimFiyat: number
  tutar: number
  belgeEtiketi: string
  belgeYolu: string | null
  aciklama: string | null
}

export type StokHareketSonucu = {
  satirlar: StokHareketSatiri[]
  toplamGiris: number
  toplamCikis: number
  /** Dönemdeki hareket tutarlarının toplamı (tablo alt satırı için). */
  toplamTutar: number
  tekStok: boolean
}

/** Dışa aktarımda ve ekranda aynı satırların çıkması için ortak sınır. */
export const HAREKET_LIMIT = 2000

export async function hareketVerisi(f: StokHareketFiltreleri): Promise<StokHareketSonucu> {
  const tekStok = Boolean(f.stok && f.stok !== "" && f.stok !== "tumu")

  const satirlar = await prisma.stokHareket.findMany({
    where: hareketKosulu(f),
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    take: HAREKET_LIMIT,
    select: {
      id: true,
      tarih: true,
      tur: true,
      miktar: true,
      birimFiyat: true,
      tutar: true,
      kabulId: true,
      evrakId: true,
      aciklama: true,
      stok: { select: { id: true, kod: true, ad: true, birim: true } },
    },
  })

  // Belge numaraları: `StokHareket.kabulId`/`evrakId` şemada düz Int
  // (Prisma ilişkisi tanımlı değil), bu yüzden include edilemiyor —
  // `stok/sayim`daki `kullaniciAdiHaritasi` deseniyle iki ek sorgu.
  // Ham "Kabul #3" yerine kullanıcının tanıdığı "KB2026-00003" yazılsın diye.
  const kabulIdleri = [...new Set(satirlar.map((h) => h.kabulId).filter((x): x is number => !!x))]
  const evrakIdleri = [...new Set(satirlar.map((h) => h.evrakId).filter((x): x is number => !!x))]
  const [kabuller, evraklar] = await Promise.all([
    kabulIdleri.length
      ? prisma.kabul.findMany({
          where: { id: { in: kabulIdleri } },
          select: { id: true, kabulNo: true },
        })
      : Promise.resolve([]),
    evrakIdleri.length
      ? prisma.evrak.findMany({
          where: { id: { in: evrakIdleri } },
          select: { id: true, evrakNo: true },
        })
      : Promise.resolve([]),
  ])
  const kabulNolari = new Map(kabuller.map((k) => [k.id, k.kabulNo]))
  const evrakNolari = new Map(evraklar.map((e) => [e.id, e.evrakNo]))

  let toplamGiris = 0
  let toplamCikis = 0
  let toplamTutar = 0

  const sonuc: StokHareketSatiri[] = satirlar.map((h) => {
    // SAYIM hareketinde miktar negatif olabilir (sayılan < sistem). Yön yalnız
    // türe bakılarak belirlenemez; işaretin kendisi de yönü taşır.
    const m = sayi(h.miktar)
    const artiMi = h.tur === "CIKIS" ? false : m >= 0
    const mutlak = Math.abs(m)
    const giris = artiMi ? mutlak : 0
    const cikis = artiMi ? 0 : mutlak
    toplamGiris += giris
    toplamCikis += cikis
    toplamTutar += sayi(h.tutar)

    return {
      id: h.id,
      tarih: h.tarih,
      stokId: h.stok.id,
      stokKodu: h.stok.kod,
      stokAdi: h.stok.ad,
      birim: h.stok.birim,
      tur: h.tur,
      giris,
      cikis,
      birimFiyat: sayi(h.birimFiyat),
      tutar: sayi(h.tutar),
      belgeEtiketi: h.kabulId
        ? (kabulNolari.get(h.kabulId) ?? `Kabul #${h.kabulId}`)
        : h.evrakId
          ? (evrakNolari.get(h.evrakId) ?? `Evrak #${h.evrakId}`)
          : (h.aciklama ?? "—"),
      // Faturanın tekil detay rotası yok (`/evrak/satis` liste ekranı),
      // bu yüzden yalnız kabul satırı link oluyor — eskisiyle aynı.
      belgeYolu: h.kabulId ? `/servis/kabul/${h.kabulId}` : null,
      aciklama: h.aciklama,
    }
  })

  return { satirlar: sonuc, toplamGiris, toplamCikis, toplamTutar, tekStok }
}

/** Filtre kutusundaki stok seçimi için sade liste. */
export async function secilebilirStoklar() {
  const kayitlar = await prisma.stok.findMany({
    where: { silindi: false },
    orderBy: [{ ad: "asc" }],
    select: { id: true, kod: true, ad: true },
    take: 500,
  })
  return kayitlar
}
