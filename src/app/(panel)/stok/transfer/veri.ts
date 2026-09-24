import "server-only"

import { prisma } from "@/lib/prisma"

/** Transfer formunda depo seçimi için sade liste (aktif depolar). */
export async function transferDepolariGetir() {
  return prisma.depo.findMany({
    where: { aktif: true },
    orderBy: [{ varsayilan: "desc" }, { ad: "asc" }],
    select: { id: true, kod: true, ad: true },
  })
}

/** Seçilen kaynak depodaki, silinmemiş/aktif stok kartları — transfer adayları. */
export async function transferIcinStoklariGetir(kaynakDepoId: number | null) {
  if (!kaynakDepoId) return []
  return prisma.stok.findMany({
    where: { silindi: false, aktif: true, depoId: kaynakDepoId },
    orderBy: { ad: "asc" },
    select: { id: true, kod: true, ad: true, birim: true, mevcutMiktar: true },
  })
}

/** Kullanıcı id'lerinden ad-soyad haritası (Sayım modülündeki aynı çözüm). */
export async function kullaniciAdiHaritasi(idler: (number | null | undefined)[]) {
  const gercekIdler = [...new Set(idler.filter((v): v is number => v != null))]
  if (!gercekIdler.length) return new Map<number, string>()
  const kullanicilar = await prisma.kullanici.findMany({
    where: { id: { in: gercekIdler } },
    select: { id: true, ad: true, soyad: true },
  })
  return new Map(kullanicilar.map((k) => [k.id, `${k.ad} ${k.soyad ?? ""}`.trim()]))
}
