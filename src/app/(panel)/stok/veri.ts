import "server-only"

import type { StokBaslangic } from "@/components/stok/stok-formu"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * Stok kaydını forma uygun hâle getirir.
 *
 * Prisma'nın Decimal nesnesi istemci bileşenine olduğu gibi geçemez; bu
 * yüzden tutarlar burada metne çevriliyor (Cari/İşçilik'teki desenin aynısı).
 * Açılış miktarı, DEVIR türündeki tek hareketten okunuyor — kart üzerinde
 * "mevcut miktar" değil "açılış miktarı" düzenlenir, gerçek bakiye
 * hareketlerle (giriş/çıkış) birlikte hesaba katılır.
 */
export async function stokFormVerisi(id: number): Promise<StokBaslangic | null> {
  const s = await prisma.stok.findUnique({
    where: { id },
    include: {
      hareketler: { where: { tur: "DEVIR" }, select: { miktar: true }, take: 1 },
    },
  })
  if (!s || s.silindi) return null

  return {
    id: s.id,
    kod: s.kod,
    ad: s.ad,
    barkod: s.barkod,
    tipi: s.tipi,
    uretici: s.uretici,
    ureticiKodu: s.ureticiKodu,
    orijinalKodu: s.orijinalKodu,
    muadilNo: s.muadilNo,
    ozelNo: s.ozelNo,
    grupKodu: s.grupKodu,
    urunGrubu: s.urunGrubu,
    gtipNo: s.gtipNo,
    uygunMarka: s.uygunMarka,
    uygunModel: s.uygunModel,
    uygunYilBas: s.uygunYilBas,
    uygunYilBit: s.uygunYilBit,
    birim: s.birim,
    acilisMiktar: (s.hareketler[0]?.miktar ?? 0).toString(),
    minSeviye: s.minSeviye.toString(),
    maxSeviye: s.maxSeviye.toString(),
    depoId: s.depoId,
    rafYeri: s.rafYeri,
    alisFiyat: s.alisFiyat.toString(),
    satisFiyat: s.satisFiyat.toString(),
    ortalamaMaliyet: s.ortalamaMaliyet.toString(),
    kdvOrani: s.kdvOrani.toString(),
    paraBirimi: s.paraBirimi,
    desen: s.desen,
    mevsim: s.mevsim,
    hizYuk: s.hizYuk,
    yakitDirenci: s.yakitDirenci,
    gurultuSeviyesi: s.gurultuSeviyesi,
    gurultuSinifi: s.gurultuSinifi,
    resimUrl: s.resimUrl,
    teknikBilgi: s.teknikBilgi,
    aciklama: s.aciklama,
    aktif: s.aktif,
  }
}

/**
 * Depo seçenekleri. `dahilId`, düzenlenen kartta seçili olan deponun id'si —
 * depo sonradan pasife alınmışsa listede çıkmaz, mevcut seçim yine de
 * eklenir (kartta pasif seçim koruma deseninin aynısı).
 */
export function depolariGetir(dahilId?: number | null) {
  return prisma.depo.findMany({
    where: dahilId ? { OR: [{ aktif: true }, { id: dahilId }] } : { aktif: true },
    orderBy: [{ varsayilan: "desc" }, { ad: "asc" }],
    select: { id: true, kod: true, ad: true },
  })
}

/** Liste filtresinin açılır kutuları. */
export async function filtreSecenekleriGetir() {
  const [depolar, gruplar] = await Promise.all([
    prisma.depo.findMany({
      orderBy: [{ varsayilan: "desc" }, { ad: "asc" }],
      select: { id: true, ad: true },
    }),
    prisma.stok.findMany({
      where: { silindi: false, urunGrubu: { not: null } },
      distinct: ["urunGrubu"],
      select: { urunGrubu: true },
      orderBy: { urunGrubu: "asc" },
    }),
  ])
  return {
    depolar,
    urunGruplari: gruplar.map((g) => g.urunGrubu).filter((g): g is string => !!g),
  }
}

export type StokFiltreleri = {
  q?: string
  depo?: string
  grup?: string
  durum?: string
}

/**
 * Liste filtresi tek yerde kuruluyor: ekran, dışa aktarma ve sayaç aynı
 * koşulu kullanır — ayrı yazılsaydı ekrandaki liste ile inen CSV birbirini
 * tutmayabilirdi.
 */
export function stokListeKosulu({
  q = "",
  depo = "",
  grup = "",
  durum = "aktif",
}: StokFiltreleri): Prisma.StokWhereInput {
  const arama = q.trim()

  return {
    silindi: durum === "silinen",
    ...(durum === "aktif" ? { aktif: true } : {}),
    ...(durum === "pasif" ? { aktif: false } : {}),
    ...(depo === "__yok__" ? { depoId: null } : depo ? { depoId: Number(depo) } : {}),
    ...(grup ? { urunGrubu: grup } : {}),
    ...(arama
      ? {
          OR: aramaKosullari<Prisma.StokWhereInput>(
            ["ad", "kod", "barkod", "ureticiKodu", "orijinalKodu", "muadilNo", "uretici"],
            arama
          ),
        }
      : {}),
  }
}

/**
 * Minimum seviyenin altına düşmüş (aktif, silinmemiş) stokların id'leri —
 * en kritik (mevcut/min oranı en düşük) önce. Prisma'nın where'i iki
 * kolonu (mevcutMiktar <= minSeviye) birbiriyle kıyaslayamadığı için ham
 * SQL kullanılıyor. Ana sayfadaki "Kritik Stok" kartı ile /stok/minimum
 * ekranı AYNI SAYIYI vermeli — ikisi de bu tek fonksiyondan besleniyor,
 * ayrı ayrı hesap yazılmıyor.
 */
export async function kritikStokIdleriGetir(): Promise<number[]> {
  const satirlar = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM stoklar
    WHERE silindi = false AND aktif = true
      AND "minSeviye" > 0 AND "mevcutMiktar" <= "minSeviye"
    ORDER BY ("mevcutMiktar" / "minSeviye") ASC, ad ASC
  `
  return satirlar.map((s) => s.id)
}

export function stokFiltreSorgusu(f: StokFiltreleri): string {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.depo) p.set("depo", f.depo)
  if (f.grup) p.set("grup", f.grup)
  if (f.durum && f.durum !== "aktif") p.set("durum", f.durum)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}
