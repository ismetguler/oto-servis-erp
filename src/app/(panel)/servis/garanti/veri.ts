import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * GARANTİ LİSTESİ — okuma tarafı
 *
 * Selpar'da "Servis > Garanti İşlemleri > Garanti Listesi": garanti
 * kapsamında açılmış işlerin garanti veren firma bazında dökümü.
 *
 * "Garanti kapsamı" iki koşuldan biriyle sağlanır:
 *   1. kart türü GARANTİ seçilmişse (Tanim > Kart Türü listesinden gelen
 *      serbest metin, bu yüzden "garanti" kelimesi aranıyor), veya
 *   2. karta bir garanti veren firma bağlanmışsa.
 * İkisi birden aranmasaydı, kart türünü seçmeyi unutan ama firmayı giren
 * kayıtlar listeden düşerdi — takip edilmesi gereken dosya kaybolurdu.
 */

export type GarantiFiltreleri = {
  q?: string
  firma?: string
  durum?: string
  tahsilat?: string
  bas?: string
  bit?: string
}

export function garantiListeKosulu({
  q = "",
  firma = "",
  durum = "",
  tahsilat = "",
  bas = "",
  bit = "",
}: GarantiFiltreleri): Prisma.KabulWhereInput {
  const arama = q.trim()
  const tarihKosulu: Prisma.DateTimeFilter = {}
  if (bas && !Number.isNaN(Date.parse(bas))) tarihKosulu.gte = new Date(`${bas}T00:00:00`)
  if (bit && !Number.isNaN(Date.parse(bit))) tarihKosulu.lte = new Date(`${bit}T23:59:59`)

  return {
    silindi: false,
    OR: [{ kartTuru: { contains: "garanti", mode: "insensitive" } }, { garantiVerenId: { not: null } }],
    ...(firma === "yok"
      ? { garantiVerenId: null }
      : firma
        ? { garantiVerenId: Number(firma) }
        : {}),
    ...(durum === "girilmemis" ? { garantiDurumu: null } : durum ? { garantiDurumu: durum } : {}),
    ...(tahsilat === "odenen" ? { odendi: true } : {}),
    ...(tahsilat === "odenmeyen" ? { odendi: false } : {}),
    ...(tahsilat === "faturasiz" ? { faturaKesildi: false } : {}),
    ...(Object.keys(tarihKosulu).length ? { girisTarihi: tarihKosulu } : {}),
    ...(arama
      ? {
          AND: [
            {
              OR: [
                ...aramaKosullari<Prisma.KabulWhereInput>(
                  ["kabulNo", "garantiDosyaNo", "garantiOnayNo", "cari.unvan"],
                  arama
                ),
                {
                  arac: {
                    plaka: { contains: arama.replace(/\s+/g, ""), mode: "insensitive" },
                  },
                },
              ],
            },
          ],
        }
      : {}),
  }
}

export function garantiFiltreSorgusu(f: GarantiFiltreleri): string {
  const p = new URLSearchParams()
  for (const [anahtar, deger] of Object.entries(f)) {
    if (deger) p.set(anahtar, String(deger))
  }
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export function garantiKayitlariGetir(kosul: Prisma.KabulWhereInput) {
  return prisma.kabul.findMany({
    where: kosul,
    orderBy: [{ girisTarihi: "desc" }],
    select: {
      id: true,
      kabulNo: true,
      durum: true,
      kartTuru: true,
      girisTarihi: true,
      teslimTarihi: true,
      garantiDosyaNo: true,
      garantiOnayNo: true,
      garantiTalepTarihi: true,
      garantiDurumu: true,
      garantiTutar: true,
      garantiNotu: true,
      genelToplam: true,
      faturaKesildi: true,
      odendi: true,
      garantiVeren: { select: { id: true, unvan: true } },
      arac: { select: { id: true, plaka: true, marka: true, model: true } },
      cari: { select: { id: true, unvan: true } },
    },
  })
}

export type GarantiKaydi = Awaited<ReturnType<typeof garantiKayitlariGetir>>[number]

export type GarantiGrubu = {
  firmaId: number | null
  firmaAdi: string
  kayitlar: GarantiKaydi[]
  genelToplam: number
  garantiToplam: number
  odenen: number
  bekleyen: number
}

/**
 * Kayıtları garanti veren firmaya göre gruplar.
 * Gruplama SQL yerine burada yapılıyor: liste zaten ekranda tamamı
 * gösterilecek kadar dar (tarih aralığı zorunlu değil ama filtreli) ve
 * grup içi toplamlar aynı geçişte çıkıyor.
 */
export function firmayaGoreGrupla(kayitlar: GarantiKaydi[]): GarantiGrubu[] {
  const gruplar = new Map<string, GarantiGrubu>()

  for (const k of kayitlar) {
    const anahtar = k.garantiVeren ? String(k.garantiVeren.id) : "yok"
    let grup = gruplar.get(anahtar)
    if (!grup) {
      grup = {
        firmaId: k.garantiVeren?.id ?? null,
        firmaAdi: k.garantiVeren?.unvan ?? "Firma girilmemiş",
        kayitlar: [],
        genelToplam: 0,
        garantiToplam: 0,
        odenen: 0,
        bekleyen: 0,
      }
      gruplar.set(anahtar, grup)
    }

    const tutar = Number(k.genelToplam.toString())
    const garanti = Number(k.garantiTutar.toString())

    grup.kayitlar.push(k)
    grup.genelToplam += tutar
    grup.garantiToplam += garanti
    if (k.odendi) grup.odenen += tutar
    else grup.bekleyen += tutar
  }

  // Firması girilmemiş kayıtlar en altta dursun: takip edilecek dosyalar
  // üstte, "eksik doldurulmuş" olanlar sonda.
  return [...gruplar.values()].sort((a, b) => {
    if (a.firmaId === null) return 1
    if (b.firmaId === null) return -1
    return a.firmaAdi.localeCompare(b.firmaAdi, "tr")
  })
}

/** Filtredeki firma listesi — yalnızca garanti kaydı olan cariler. */
export async function garantiVerenleriGetir() {
  const kayitlar = await prisma.kabul.findMany({
    where: { silindi: false, garantiVerenId: { not: null } },
    distinct: ["garantiVerenId"],
    select: { garantiVeren: { select: { id: true, unvan: true } } },
  })

  return kayitlar
    .map((k) => k.garantiVeren)
    .filter((c): c is { id: number; unvan: string } => c !== null)
    .sort((a, b) => a.unvan.localeCompare(b.unvan, "tr"))
}
