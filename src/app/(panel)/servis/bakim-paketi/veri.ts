import "server-only"

import type { PaketBaslangic } from "@/components/bakim-paketi/paket-formu"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * BAKIM PAKETİ — okuma tarafı (server-only).
 *
 * Fiyatlar pakette tutulmadığı için "paketin tutarı" her okumada katalogdan
 * hesaplanır. Bu yüzden liste ve önizleme aynı fonksiyondan beslenir;
 * ayrı yazılsaydı ekranda görünen tutar ile uygulanan tutar ayrışabilirdi.
 */

export type PaketFiltreleri = {
  q?: string
  durum?: string
}

/** Ekran, sayaç ve CSV aynı koşulu kullansın diye filtre tek yerde. */
export function paketListeKosulu({
  q = "",
  durum = "aktif",
}: PaketFiltreleri): Prisma.BakimPaketiWhereInput {
  const arama = q.trim()

  return {
    silindi: durum === "silinen",
    ...(durum === "aktif" ? { aktif: true } : {}),
    ...(durum === "pasif" ? { aktif: false } : {}),
    ...(arama
      ? {
          OR: aramaKosullari<Prisma.BakimPaketiWhereInput>(
            ["kod", "ad", "aciklama", "marka"],
            arama
          ),
        }
      : {}),
  }
}

export function paketFiltreSorgusu(f: PaketFiltreleri): string {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.durum && f.durum !== "aktif") p.set("durum", f.durum)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export async function paketFormVerisi(id: number): Promise<PaketBaslangic | null> {
  const p = await prisma.bakimPaketi.findUnique({ where: { id } })
  if (!p || p.silindi) return null

  return {
    id: p.id,
    kod: p.kod,
    ad: p.ad,
    aciklama: p.aciklama,
    aracTuru: p.aracTuru,
    marka: p.marka,
    km: p.km,
    aktif: p.aktif,
  }
}

export type PaketSatiri = {
  id: number
  sira: number
  tur: "PARCA" | "ISCILIK" | "DIS_HIZMET"
  stokId: number | null
  iscilikId: number | null
  aciklama: string
  miktar: number
  birim: string
  /** Kullanıcının pakette sabitlediği fiyat; boşsa katalog fiyatı geçerli. */
  fiyatSabit: number | null
  /** Katalogdaki güncel fiyat (yoksa null — kart silinmiş/pasif olabilir). */
  katalogFiyat: number | null
  kdvOrani: number
  /** Uygulanacak fiyat: sabit varsa o, yoksa katalog. */
  gecerliFiyat: number
  /** Sadece parça satırında: stoktaki mevcut miktar. */
  stokta: number | null
  /** Katalog kaydı silinmiş/pasifse uyarı metni. */
  uyari: string | null
}

/**
 * Paket satırlarını güncel katalog fiyatlarıyla birlikte getirir.
 * Kabule uygulama, önizleme, liste tutarı ve CSV — hepsi burayı kullanır.
 */
export async function paketKalemleriGetir(paketId: number): Promise<PaketSatiri[]> {
  const kalemler = await prisma.bakimPaketiKalem.findMany({
    where: { paketId },
    orderBy: [{ sira: "asc" }, { id: "asc" }],
    include: {
      stok: {
        select: {
          id: true,
          kod: true,
          ad: true,
          satisFiyat: true,
          kdvOrani: true,
          birim: true,
          mevcutMiktar: true,
          aktif: true,
          silindi: true,
        },
      },
      iscilik: {
        select: {
          id: true,
          kod: true,
          ad: true,
          fiyat: true,
          kdvOrani: true,
          aktif: true,
          silindi: true,
        },
      },
    },
  })

  return kalemler.map((k) => {
    const sabit = k.fiyatSabit === null ? null : Number(k.fiyatSabit.toString())

    let katalogFiyat: number | null = null
    let kdvOrani = 20
    let stokta: number | null = null
    let uyari: string | null = null

    if (k.stok) {
      katalogFiyat = Number(k.stok.satisFiyat.toString())
      kdvOrani = Number(k.stok.kdvOrani.toString())
      stokta = Number(k.stok.mevcutMiktar.toString())
      if (k.stok.silindi) uyari = "Stok kartı silinmiş"
      else if (!k.stok.aktif) uyari = "Stok kartı pasif"
    } else if (k.iscilik) {
      katalogFiyat = Number(k.iscilik.fiyat.toString())
      kdvOrani = Number(k.iscilik.kdvOrani.toString())
      if (k.iscilik.silindi) uyari = "İşçilik kartı silinmiş"
      else if (!k.iscilik.aktif) uyari = "İşçilik kartı pasif"
    } else if (sabit === null) {
      // Serbest satırda katalog yok; fiyat girilmemişse kabule 0 ile düşer.
      uyari = "Fiyat girilmemiş"
    }

    return {
      id: k.id,
      sira: k.sira,
      tur: k.tur,
      stokId: k.stokId,
      iscilikId: k.iscilikId,
      aciklama: k.aciklama,
      miktar: Number(k.miktar.toString()),
      birim: k.birim,
      fiyatSabit: sabit,
      katalogFiyat,
      kdvOrani,
      gecerliFiyat: sabit ?? katalogFiyat ?? 0,
      stokta,
      uyari,
    }
  })
}

/** Kabul ekranındaki paket seçim kutusunu besler (sadece kullanılabilir paketler). */
export function uygulanabilirPaketler() {
  return prisma.bakimPaketi.findMany({
    where: { silindi: false, aktif: true },
    orderBy: [{ ad: "asc" }],
    select: {
      id: true,
      kod: true,
      ad: true,
      km: true,
      marka: true,
      aracTuru: true,
      _count: { select: { kalemler: true } },
    },
  })
}
