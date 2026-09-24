import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { KasaHareketTur, KasaTur } from "@/generated/prisma/enums"
import { aramaKosullari } from "@/lib/arama"
import { gunBasi, gunSonu, sayi } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * KASA — okuma tarafı
 *
 * Gün sonu devri AYRI TABLODA TUTULMUYOR. Devreden bakiye, seçilen aralıktan
 * önceki hareketlerin netidir; aynı sayıyı ikinci kez saklamak geriye dönük
 * bir düzeltmede iki kaynağın çelişmesi demek olurdu. Tek doğru kaynak
 * `kasa_hareketleri`.
 */

/** Kasa hareketinin bakiyeye etkisi. Tutar hep pozitif, işaret türden gelir. */
export function hareketYonu(tur: KasaHareketTur): 1 | -1 {
  return tur === "CIKIS" || tur === "VIRMAN_CIKIS" ? -1 : 1
}

export const KASA_TUR_ADI: Record<KasaTur, string> = {
  NAKIT: "Nakit",
  BANKA: "Banka",
  POS: "POS",
}

export const HAREKET_TUR_ADI: Record<KasaHareketTur, string> = {
  ACILIS: "Açılış",
  GIRIS: "Giriş",
  CIKIS: "Çıkış",
  VIRMAN_GIRIS: "Virman (gelen)",
  VIRMAN_CIKIS: "Virman (giden)",
}

export type KasaSatiri = {
  id: number
  kod: string
  ad: string
  tur: KasaTur
  paraBirimi: string
  banka: string | null
  ibanNo: string | null
  posKomisyonOrani: number
  bakiye: number
  hareketSayisi: number
  aktif: boolean
  silindi: boolean
}

export function kasaListeKosulu(durum: string): Prisma.KasaWhereInput {
  if (durum === "silinen") return { silindi: true }
  if (durum === "pasif") return { silindi: false, aktif: false }
  if (durum === "tumu") return { silindi: false }
  return { silindi: false, aktif: true }
}

export async function kasalariGetir(durum = "aktif"): Promise<KasaSatiri[]> {
  const kayitlar = await prisma.kasa.findMany({
    where: kasaListeKosulu(durum),
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: {
      id: true,
      kod: true,
      ad: true,
      tur: true,
      paraBirimi: true,
      banka: true,
      ibanNo: true,
      posKomisyonOrani: true,
      bakiye: true,
      aktif: true,
      silindi: true,
      _count: { select: { hareketler: { where: { silindi: false } } } },
    },
  })

  return kayitlar.map((k) => ({
    id: k.id,
    kod: k.kod,
    ad: k.ad,
    tur: k.tur,
    paraBirimi: k.paraBirimi,
    banka: k.banka,
    ibanNo: k.ibanNo,
    posKomisyonOrani: sayi(k.posKomisyonOrani),
    bakiye: sayi(k.bakiye),
    hareketSayisi: k._count.hareketler,
    aktif: k.aktif,
    silindi: k.silindi,
  }))
}

/** Form ve hızlı seçim kutuları için sade liste. */
export async function secilebilirKasalar() {
  const kayitlar = await prisma.kasa.findMany({
    where: { silindi: false, aktif: true },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { id: true, kod: true, ad: true, tur: true, bakiye: true, paraBirimi: true },
  })
  return kayitlar.map((k) => ({ ...k, bakiye: sayi(k.bakiye) }))
}

export type DefterFiltreleri = {
  kasa?: string
  q?: string
  tur?: string
  bas?: string
  bit?: string
}

/** Varsayılan aralık: içinde bulunulan ay. Defter açılır açılmaz dolu gelsin. */
export function varsayilanAralik() {
  const bugun = new Date()
  const ilk = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
  return {
    bas: yerelGun(ilk),
    bit: yerelGun(bugun),
  }
}

/** toISOString UTC'ye kaydırdığı için ayın 1'i bazen önceki aya düşüyordu. */
function yerelGun(d: Date): string {
  const ay = String(d.getMonth() + 1).padStart(2, "0")
  const gun = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${ay}-${gun}`
}

function tarihAraligi(f: DefterFiltreleri) {
  const v = varsayilanAralik()
  const bas = gunBasi(new Date(f.bas && f.bas !== "" ? f.bas : v.bas))
  const bit = gunSonu(new Date(f.bit && f.bit !== "" ? f.bit : v.bit))
  return { bas, bit }
}

export function defterKosulu(f: DefterFiltreleri): Prisma.KasaHareketWhereInput {
  const { bas, bit } = tarihAraligi(f)
  const kosul: Prisma.KasaHareketWhereInput = {
    silindi: false,
    // Silinmiş kasaların hareketleri toplamlara karışmasın (kasa listesi
    // silinen kasayı göstermiyor; defter de göstermemeli).
    kasa: { silindi: false },
    tarih: { gte: bas, lte: bit },
  }
  if (f.kasa && f.kasa !== "" && f.kasa !== "tumu") kosul.kasaId = Number(f.kasa)
  // Açılış bakiyesi bir "hareket" değil, defterin başlangıç noktası — muhasebe
  // (ve Selpar) mantığında her zaman "Devreden bakiye" satırında toplanır,
  // hareket listesinde ayrı satır olarak GÖRÜNMEZ. Tarihi dönem içine düşse bile
  // (kasa bugün açılıp aynı gün hareket girilirse) hareket satırlarından çıkarılır;
  // yoksa yürüyen bakiye sütunu anlamsız sıralanıyordu.
  if (f.tur === "giris") kosul.tur = { in: ["GIRIS", "VIRMAN_GIRIS"] }
  else if (f.tur === "cikis") kosul.tur = { in: ["CIKIS", "VIRMAN_CIKIS"] }
  else kosul.tur = { not: "ACILIS" }

  const q = (f.q ?? "").trim()
  if (q) {
    kosul.OR = aramaKosullari<Prisma.KasaHareketWhereInput>(
      ["aciklama", "belgeNo", "masrafTuru", "cari.unvan"],
      q
    )
  }
  return kosul
}

export function defterSorgusu(f: DefterFiltreleri): string {
  const p = new URLSearchParams()
  if (f.kasa && f.kasa !== "tumu") p.set("kasa", f.kasa)
  if (f.q) p.set("q", f.q)
  if (f.tur && f.tur !== "tumu") p.set("tur", f.tur)
  if (f.bas) p.set("bas", f.bas)
  if (f.bit) p.set("bit", f.bit)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export type DefterSatiri = {
  id: number
  tarih: Date
  kasaId: number
  kasaAdi: string
  tur: KasaHareketTur
  giris: number
  cikis: number
  yuruyenBakiye: number
  aciklama: string | null
  belgeNo: string | null
  masrafTuru: string | null
  cariId: number | null
  cariUnvan: string | null
  karsiKasaAdi: string | null
  virman: boolean
}

export type DefterSonucu = {
  devreden: number
  satirlar: DefterSatiri[]
  girisToplam: number
  cikisToplam: number
  kapanis: number
  /** Gün gün özet — Selpar'daki "gün sonu" dökümünün karşılığı. */
  gunler: { gun: string; giris: number; cikis: number; kapanis: number }[]
  tekKasa: boolean
}

/**
 * Kasa defteri. Yürüyen bakiye SADECE tek kasa seçildiğinde anlamlıdır;
 * "tüm kasalar" görünümünde farklı kasaların satırları iç içe geleceği için
 * yürüyen bakiye sütunu gizlenir (yanıltıcı olurdu).
 */
export async function defterVerisi(f: DefterFiltreleri): Promise<DefterSonucu> {
  const { bas } = tarihAraligi(f)
  const tekKasa = Boolean(f.kasa && f.kasa !== "" && f.kasa !== "tumu")

  const devirKosulu: Prisma.KasaHareketWhereInput = {
    silindi: false,
    kasa: { silindi: false },
    // Dönem öncesi tüm hareketler + tarihi ne olursa olsun açılış bakiyesi:
    // açılış her zaman devredene dahildir (hareket satırlarından da çıkarıldı).
    OR: [{ tarih: { lt: bas } }, { tur: "ACILIS" }],
  }
  if (tekKasa) devirKosulu.kasaId = Number(f.kasa)

  const [devirSatirlari, satirlar] = await Promise.all([
    prisma.kasaHareket.groupBy({
      by: ["tur"],
      where: devirKosulu,
      _sum: { tutar: true },
    }),
    prisma.kasaHareket.findMany({
      where: defterKosulu(f),
      orderBy: [{ tarih: "asc" }, { id: "asc" }],
      take: 2000,
      select: {
        id: true,
        tarih: true,
        tur: true,
        tutar: true,
        aciklama: true,
        belgeNo: true,
        masrafTuru: true,
        kasaId: true,
        kasa: { select: { ad: true } },
        cariId: true,
        cari: { select: { unvan: true } },
        karsiKasa: { select: { ad: true } },
        virmanGrubu: true,
      },
    }),
  ])

  const devreden = devirSatirlari.reduce(
    (t, g) => t + hareketYonu(g.tur) * sayi(g._sum.tutar),
    0
  )

  let yuruyen = devreden
  let girisToplam = 0
  let cikisToplam = 0
  const gunHaritasi = new Map<string, { giris: number; cikis: number }>()

  const sonuc: DefterSatiri[] = satirlar.map((s) => {
    const tutar = sayi(s.tutar)
    const artiMi = hareketYonu(s.tur) === 1
    const giris = artiMi ? tutar : 0
    const cikis = artiMi ? 0 : tutar
    girisToplam += giris
    cikisToplam += cikis
    yuruyen += giris - cikis

    const gun = yerelGun(s.tarih)
    const mevcut = gunHaritasi.get(gun) ?? { giris: 0, cikis: 0 }
    gunHaritasi.set(gun, { giris: mevcut.giris + giris, cikis: mevcut.cikis + cikis })

    return {
      id: s.id,
      tarih: s.tarih,
      kasaId: s.kasaId,
      kasaAdi: s.kasa.ad,
      tur: s.tur,
      giris,
      cikis,
      yuruyenBakiye: yuruyen,
      aciklama: s.aciklama,
      belgeNo: s.belgeNo,
      masrafTuru: s.masrafTuru,
      cariId: s.cariId,
      cariUnvan: s.cari?.unvan ?? null,
      karsiKasaAdi: s.karsiKasa?.ad ?? null,
      virman: Boolean(s.virmanGrubu),
    }
  })

  let devirTakip = devreden
  const gunler = [...gunHaritasi.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([gun, g]) => {
      devirTakip += g.giris - g.cikis
      return { gun, giris: g.giris, cikis: g.cikis, kapanis: devirTakip }
    })

  return {
    devreden,
    satirlar: sonuc,
    girisToplam,
    cikisToplam,
    kapanis: devreden + girisToplam - cikisToplam,
    gunler,
    tekKasa,
  }
}

/** Masraf türü kutusunun datalist kaynağı. */
export async function masrafTurleri(): Promise<string[]> {
  const kayitlar = await prisma.tanim.findMany({
    where: { tur: "MASRAF", aktif: true },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { ad: true },
  })
  return kayitlar.map((t) => t.ad)
}
