import "server-only"

import { kabulTahsilatOzetleri } from "@/app/(panel)/tahsilat/veri"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { gunBasi, gunSonu } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * TAHSİLATI YAPILAN / YAPILMAYAN ONARIMLAR (adım 12.4b)
 *
 * Ana sayfadaki "Tahsilatı Yapılmayan" kartının gittiği ekran — Selpar
 * `KabulTahsilatListesi` karşılığı. Tutarı olan (iptal edilmemiş) onarım
 * kartlarını, karta bağlı tahsilat fişlerinin NET toplamıyla ("ne kadarı
 * ödendi") kıyaslar; `kalan > 0` olanlar "yapılmayan".
 *
 * Tahsilat/kalan hesabı tahsilat modülünün `kabulTahsilatOzetleri`
 * fonksiyonundan geliyor (kabul kartı ve hesap dökümü de aynı kaynağı
 * kullanıyor) — burada yeniden yazılmadı.
 */

export type ServisTahsilatFiltre = {
  durum?: string
  bas?: string
  bit?: string
  kartTuru?: string
  q?: string
}

export type ServisTahsilatSatiri = {
  id: number
  kabulNo: string
  plaka: string
  girisTarihi: Date
  kartTuru: string | null
  unvan: string
  cariId: number
  karaListe: boolean
  karaListeNedeni: string | null
  tutar: number
  tahsilat: number
  kalan: number
  /** Kaç gündür ödenmedi (fatura tarihi baz; yalnız kalanı olan kartta). */
  gun: number | null
  faturaNo: string | null
}

const ACIK = 0.005

export async function kartTuruSecenekleri(): Promise<string[]> {
  const kayitlar = await prisma.tanim.findMany({
    where: { tur: "KART_TURU", aktif: true },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { ad: true },
  })
  return kayitlar.map((k) => k.ad)
}

export async function servisTahsilatVerisi(f: ServisTahsilatFiltre) {
  const where: Prisma.KabulWhereInput = {
    silindi: false,
    durum: { not: "IPTAL" },
    genelToplam: { gt: 0 },
  }

  if (f.bas || f.bit) {
    where.girisTarihi = {
      ...(f.bas ? { gte: gunBasi(new Date(f.bas)) } : {}),
      ...(f.bit ? { lte: gunSonu(new Date(f.bit)) } : {}),
    }
  }
  if (f.kartTuru && f.kartTuru !== "tumu") where.kartTuru = f.kartTuru

  const q = (f.q ?? "").trim()
  if (q) {
    where.OR = aramaKosullari<Prisma.KabulWhereInput>(
      ["kabulNo", "cari.unvan", "arac.plaka"],
      q
    )
  }

  const kabuller = await prisma.kabul.findMany({
    where,
    orderBy: { girisTarihi: "desc" },
    take: 1000,
    select: {
      id: true,
      kabulNo: true,
      kartTuru: true,
      girisTarihi: true,
      genelToplam: true,
      cari: {
        select: { id: true, unvan: true, karaListe: true, karaListeNedeni: true },
      },
      arac: { select: { plaka: true } },
      evraklar: {
        where: { silindi: false, durum: { not: "IPTAL" } },
        orderBy: { tarih: "desc" },
        take: 1,
        select: { evrakNo: true, tarih: true },
      },
    },
  })

  const ozetler = await kabulTahsilatOzetleri(
    kabuller.map((k) => ({ id: k.id, genelToplam: k.genelToplam }))
  )

  const simdi = Date.now()
  let satirlar: ServisTahsilatSatiri[] = kabuller.map((k) => {
    const o = ozetler.get(k.id)
    const genelToplam = o?.genelToplam ?? 0
    const tahsilat = o?.tahsilEdilen ?? 0
    const kalan = o?.kalan ?? genelToplam
    const baz = k.evraklar[0]?.tarih ?? k.girisTarihi
    return {
      id: k.id,
      kabulNo: k.kabulNo,
      plaka: k.arac.plaka,
      girisTarihi: k.girisTarihi,
      kartTuru: k.kartTuru,
      unvan: k.cari.unvan,
      cariId: k.cari.id,
      karaListe: k.cari.karaListe,
      karaListeNedeni: k.cari.karaListeNedeni,
      tutar: genelToplam,
      tahsilat,
      kalan,
      gun:
        kalan > ACIK
          ? Math.max(0, Math.floor((simdi - baz.getTime()) / 86_400_000))
          : null,
      faturaNo: k.evraklar[0]?.evrakNo ?? null,
    }
  })

  if (f.durum === "yapilmayan") satirlar = satirlar.filter((s) => s.kalan > ACIK)
  else if (f.durum === "yapilan") satirlar = satirlar.filter((s) => s.kalan <= ACIK)

  const toplam = satirlar.reduce(
    (t, s) => ({
      tutar: t.tutar + s.tutar,
      tahsilat: t.tahsilat + s.tahsilat,
      kalan: t.kalan + s.kalan,
    }),
    { tutar: 0, tahsilat: 0, kalan: 0 }
  )

  return { satirlar, toplam }
}
