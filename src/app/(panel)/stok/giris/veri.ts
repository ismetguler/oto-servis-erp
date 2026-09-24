import "server-only"

import { prisma } from "@/lib/prisma"

/** Yeni fiş formundaki depo seçeneği. */
export function girisDepolariGetir() {
  return prisma.depo.findMany({
    where: { aktif: true },
    orderBy: [{ varsayilan: "desc" }, { ad: "asc" }],
    select: { id: true, ad: true, varsayilan: true },
  })
}

/** Stok Girişi fiş listesi (en yeni önce). */
export async function stokGirisleriGetir() {
  const fisler = await prisma.stokGirisFisi.findMany({
    orderBy: { id: "desc" },
    take: 200,
    select: {
      id: true,
      fisNo: true,
      durum: true,
      tarih: true,
      aciklama: true,
      saticiAdi: true,
      depo: { select: { ad: true } },
      _count: { select: { kalemler: true } },
      kalemler: { select: { tutar: true } },
    },
  })
  return fisler.map((f) => ({
    id: f.id,
    fisNo: f.fisNo,
    durum: f.durum,
    tarih: f.tarih,
    aciklama: f.aciklama,
    depoAdi: f.depo?.ad ?? null,
    saticiAdi: f.saticiAdi,
    kalemSayisi: f._count.kalemler,
    toplamTutar: f.kalemler.reduce((t, k) => t + Number(k.tutar), 0),
  }))
}

/** Tek fiş — detay ekranı ve onay/geri-al aksiyonları için. */
export async function stokGirisFisiGetir(id: number) {
  const fis = await prisma.stokGirisFisi.findUnique({
    where: { id },
    include: {
      depo: { select: { ad: true } },
      kalemler: {
        orderBy: { id: "asc" },
        include: {
          stok: { select: { id: true, kod: true, ad: true, birim: true } },
        },
      },
    },
  })
  if (!fis) return null

  return {
    id: fis.id,
    fisNo: fis.fisNo,
    durum: fis.durum,
    tarih: fis.tarih,
    aciklama: fis.aciklama,
    depoAdi: fis.depo?.ad ?? null,
    saticiAdi: fis.saticiAdi,
    onayTarihi: fis.onayTarihi,
    geriAlmaTarihi: fis.geriAlmaTarihi,
    kalemler: fis.kalemler.map((k) => ({
      id: k.id,
      stokId: k.stokId,
      kod: k.stok.kod,
      ad: k.stok.ad,
      birim: k.stok.birim,
      miktar: Number(k.miktar),
      birimFiyat: Number(k.birimFiyat),
      tutar: Number(k.tutar),
    })),
    toplamTutar: fis.kalemler.reduce((t, k) => t + Number(k.tutar), 0),
  }
}
