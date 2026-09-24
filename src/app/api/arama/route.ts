import { NextResponse } from "next/server"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { oturumKullanicisi } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { plakaSadelestir } from "@/lib/plaka"
import { plaka as plakaBicim } from "@/lib/bicim"
import { yetkiVar, type Modul } from "@/lib/yetki"

/**
 * HIZLI ARAMA (ADIM 12.7)
 *
 * Üst bardaki tek kutudan tüm sık aranan kayıtlara ulaşmak için. Arama
 * SUNUCUDA koşuyor: 100 bin satırlık stoku tarayıcıya indirmek yerine
 * `contains` sorgusu atıp her türden en fazla 5 sonuç dönüyoruz.
 *
 * Neden route handler, server action değil: istemci her tuşta yeni istek
 * atıyor ve eskisini `AbortController` ile iptal ediyor; server action'lar
 * sıraya girer, iptal semantiği yoktur.
 *
 * YETKİ: her grup kendi modülüne bağlı (`GRUPLAR` içinde). Kullanıcının o
 * modülde `gor` yetkisi yoksa o grubun sorgusu HİÇ çalışmaz, yanıtta da
 * yer almaz — "stok yetkisi olmayan stok sonucu görmesin".
 */

const HER_GRUPTAN = 5

type AramaSonucu = {
  id: number
  baslik: string
  altbaslik?: string
  yol: string
}

type AramaGrubu = {
  anahtar: string
  baslik: string
  toplam: number
  sonuclar: AramaSonucu[]
  tumuYol: string
}

/** Prisma `contains` için ortak seçenek. */
const ic = { mode: "insensitive" as const }

/** Evrak türünü doğru detay rotasına eşler (evrak ekranı satış/alış diye ayrık). */
function evrakYolu(tur: string, id: number) {
  return tur === "ALIS" || tur === "IADE_ALIS"
    ? `/evrak/alis/${id}`
    : `/evrak/satis/${id}`
}

type GrupTanimi = {
  anahtar: string
  baslik: string
  modul: Modul
  tumuYol: (q: string) => string
  calistir: (q: string) => Promise<{ toplam: number; sonuclar: AramaSonucu[] }>
}

const GRUPLAR: GrupTanimi[] = [
  {
    anahtar: "arac",
    baslik: "Araçlar",
    modul: "arac",
    tumuYol: (q) => `/arac?q=${encodeURIComponent(q)}`,
    async calistir(q) {
      const where = {
        OR: [
          { plaka: { contains: plakaSadelestir(q), ...ic } },
          ...aramaKosullari<Prisma.AracWhereInput>(["marka", "model", "saseNo"], q),
        ],
      }
      const [toplam, kayitlar] = await Promise.all([
        prisma.arac.count({ where }),
        prisma.arac.findMany({
          where,
          take: HER_GRUPTAN,
          orderBy: { plaka: "asc" },
          select: { id: true, plaka: true, marka: true, model: true },
        }),
      ])
      return {
        toplam,
        sonuclar: kayitlar.map((a) => ({
          id: a.id,
          baslik: plakaBicim(a.plaka),
          altbaslik: [a.marka, a.model].filter(Boolean).join(" ") || undefined,
          yol: `/arac/${a.id}`,
        })),
      }
    },
  },
  {
    anahtar: "cari",
    baslik: "Cariler",
    modul: "cari",
    tumuYol: (q) => `/cari?q=${encodeURIComponent(q)}`,
    async calistir(q) {
      const where = {
        turu: { not: "PERSONEL" as const },
        OR: aramaKosullari<Prisma.CariWhereInput>(
          ["unvan", "kod", "vergiNo", "telefon", "gsm", "yetkili"],
          q
        ),
      }
      const [toplam, kayitlar] = await Promise.all([
        prisma.cari.count({ where }),
        prisma.cari.findMany({
          where,
          take: HER_GRUPTAN,
          orderBy: { unvan: "asc" },
          select: { id: true, kod: true, unvan: true, telefon: true, gsm: true },
        }),
      ])
      return {
        toplam,
        sonuclar: kayitlar.map((c) => ({
          id: c.id,
          baslik: c.unvan,
          altbaslik: [c.kod, c.gsm || c.telefon].filter(Boolean).join(" · ") || undefined,
          yol: `/cari/${c.id}`,
        })),
      }
    },
  },
  {
    anahtar: "personel",
    baslik: "Personel",
    modul: "cari",
    tumuYol: (q) => `/personel?q=${encodeURIComponent(q)}`,
    async calistir(q) {
      const where = {
        turu: "PERSONEL" as const,
        OR: aramaKosullari<Prisma.CariWhereInput>(["unvan", "kod", "gsm", "telefon"], q),
      }
      const [toplam, kayitlar] = await Promise.all([
        prisma.cari.count({ where }),
        prisma.cari.findMany({
          where,
          take: HER_GRUPTAN,
          orderBy: { unvan: "asc" },
          select: { id: true, kod: true, unvan: true, gorevi: true },
        }),
      ])
      return {
        toplam,
        sonuclar: kayitlar.map((p) => ({
          id: p.id,
          baslik: p.unvan,
          altbaslik: [p.kod, p.gorevi].filter(Boolean).join(" · ") || undefined,
          yol: `/personel/${p.id}`,
        })),
      }
    },
  },
  {
    anahtar: "stok",
    baslik: "Stoklar",
    modul: "stok",
    tumuYol: (q) => `/stok?q=${encodeURIComponent(q)}`,
    async calistir(q) {
      const where = {
        OR: aramaKosullari<Prisma.StokWhereInput>(
          ["ad", "kod", "barkod", "ureticiKodu", "orijinalKodu", "muadilNo"],
          q
        ),
      }
      const [toplam, kayitlar] = await Promise.all([
        prisma.stok.count({ where }),
        prisma.stok.findMany({
          where,
          take: HER_GRUPTAN,
          orderBy: { ad: "asc" },
          select: { id: true, kod: true, ad: true, barkod: true },
        }),
      ])
      return {
        toplam,
        sonuclar: kayitlar.map((s) => ({
          id: s.id,
          baslik: s.ad,
          altbaslik: [s.kod, s.barkod].filter(Boolean).join(" · ") || undefined,
          yol: `/stok/${s.id}`,
        })),
      }
    },
  },
  {
    anahtar: "kabul",
    baslik: "Kabuller",
    modul: "kabul",
    tumuYol: (q) => `/servis/kabul?q=${encodeURIComponent(q)}`,
    async calistir(q) {
      const where = {
        silindi: false,
        OR: [
          ...aramaKosullari<Prisma.KabulWhereInput>(["kabulNo", "kabulOzelNo"], q),
          { arac: { plaka: { contains: plakaSadelestir(q), ...ic } } },
        ],
      }
      const [toplam, kayitlar] = await Promise.all([
        prisma.kabul.count({ where }),
        prisma.kabul.findMany({
          where,
          take: HER_GRUPTAN,
          orderBy: { girisTarihi: "desc" },
          select: {
            id: true,
            kabulNo: true,
            arac: { select: { plaka: true } },
            cari: { select: { unvan: true } },
          },
        }),
      ])
      return {
        toplam,
        sonuclar: kayitlar.map((k) => ({
          id: k.id,
          baslik: `${k.kabulNo} · ${plakaBicim(k.arac.plaka)}`,
          altbaslik: k.cari.unvan || undefined,
          yol: `/servis/kabul/${k.id}`,
        })),
      }
    },
  },
  {
    anahtar: "evrak",
    baslik: "Evraklar",
    modul: "evrak",
    tumuYol: (q) => `/evrak/satis?q=${encodeURIComponent(q)}`,
    async calistir(q) {
      const where = {
        silindi: false,
        OR: aramaKosullari<Prisma.EvrakWhereInput>(["evrakNo", "cari.unvan"], q),
      }
      const [toplam, kayitlar] = await Promise.all([
        prisma.evrak.count({ where }),
        prisma.evrak.findMany({
          where,
          take: HER_GRUPTAN,
          orderBy: { tarih: "desc" },
          select: {
            id: true,
            evrakNo: true,
            tur: true,
            cari: { select: { unvan: true } },
          },
        }),
      ])
      return {
        toplam,
        sonuclar: kayitlar.map((e) => ({
          id: e.id,
          baslik: e.evrakNo,
          altbaslik: [e.tur, e.cari.unvan].filter(Boolean).join(" · ") || undefined,
          yol: evrakYolu(e.tur, e.id),
        })),
      }
    },
  },
]

export async function GET(istek: Request) {
  const kullanici = await oturumKullanicisi()
  if (!kullanici) {
    return NextResponse.json({ error: "Oturum yok" }, { status: 401 })
  }

  const q = (new URL(istek.url).searchParams.get("q") ?? "").trim()
  if (q.length < 2) {
    return NextResponse.json({ gruplar: [] as AramaGrubu[] })
  }

  const izinli = GRUPLAR.filter((g) => yetkiVar(kullanici, g.modul, "gor"))

  const sonuclar = await Promise.all(
    izinli.map(async (g): Promise<AramaGrubu> => {
      const { toplam, sonuclar } = await g.calistir(q)
      return {
        anahtar: g.anahtar,
        baslik: g.baslik,
        toplam,
        sonuclar,
        tumuYol: g.tumuYol(q),
      }
    })
  )

  return NextResponse.json({ gruplar: sonuclar.filter((g) => g.sonuclar.length > 0) })
}
