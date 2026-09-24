import "server-only"

import { prisma } from "@/lib/prisma"

/** Çıkış hareketleri miktarı düşürür, diğerleri arttırır (mevcutMiktar mantığıyla aynı). */
function isaretli(tur: string, miktar: number) {
  return tur === "CIKIS" ? -miktar : miktar
}

/**
 * `StokHareket.kabulId` / `evrakId` şemada düz Int (Prisma ilişkisi yok),
 * bu yüzden include edilemiyor. Ham "Kabul #3" yerine kullanıcının tanıdığı
 * "KB2026-00003" / fatura no yazılsın diye iki ek sorguyla belge no eşleniyor
 * — genel `/stok/hareket` ekranındaki (`../../hareket/veri.ts`) desenin aynısı;
 * tekil kart dökümü ile ekran+CSV birbirini tutsun diye buraya da taşındı.
 */
export async function belgeNoHaritalari(
  hareketler: { kabulId: number | null; evrakId: number | null }[]
): Promise<{ kabulNolari: Map<number, string>; evrakNolari: Map<number, string> }> {
  const kabulIdleri = [...new Set(hareketler.map((h) => h.kabulId).filter((x): x is number => !!x))]
  const evrakIdleri = [...new Set(hareketler.map((h) => h.evrakId).filter((x): x is number => !!x))]
  const [kabuller, evraklar] = await Promise.all([
    kabulIdleri.length
      ? prisma.kabul.findMany({ where: { id: { in: kabulIdleri } }, select: { id: true, kabulNo: true } })
      : Promise.resolve([]),
    evrakIdleri.length
      ? prisma.evrak.findMany({ where: { id: { in: evrakIdleri } }, select: { id: true, evrakNo: true } })
      : Promise.resolve([]),
  ])
  return {
    kabulNolari: new Map(kabuller.map((k) => [k.id, k.kabulNo])),
    evrakNolari: new Map(evraklar.map((e) => [e.id, e.evrakNo])),
  }
}

/** Tek hareket satırı için görünen belge etiketi (numara → yoksa ham → yoksa açıklama). */
export function belgeEtiketiCoz(
  h: { kabulId: number | null; evrakId: number | null; aciklama: string | null },
  kabulNolari: Map<number, string>,
  evrakNolari: Map<number, string>
): string {
  if (h.kabulId) return kabulNolari.get(h.kabulId) ?? `Kabul #${h.kabulId}`
  if (h.evrakId) return evrakNolari.get(h.evrakId) ?? `Evrak #${h.evrakId}`
  return h.aciklama ?? "—"
}

/**
 * Tekil stok kartı hareket dökümündeki "Devir" (dönem başı) bakiyesi.
 *
 * Normal kural: seçilen tarihten önceki tüm hareketlerin işaretli neti.
 * AMA 8.1 öncesi elle oluşturulan eski kartlarda hiç DEVIR hareketi yok —
 * bu kartlarda "önceki hareketlerin neti" gerçek dönem-başı miktarını
 * temsil etmez, yürüyen "Kalan" sütunu negatife düşüyordu (DEMO-HAZIRLIK
 * Z5-B / 🟡-6). Bu durumda bakiyeyi karttaki GÜNCEL `mevcutMiktar`'dan,
 * bu tarihten sonraki net hareketi çıkararak geriye türetiyoruz — böylece
 * dökümün son satırı kartın gerçek miktarına oturur (aralıkta bugünden
 * sonra hareket yoksa).
 *
 * DEVIR satırı VARSA eski davranış birebir korunuyor.
 */
export async function donemBasiBakiye(
  stokId: number,
  baslangic: Date,
  mevcutMiktar: number
): Promise<number> {
  const [oncesi, devirSatiri, sonrasi] = await Promise.all([
    prisma.stokHareket.findMany({
      where: { stokId, tarih: { lt: baslangic } },
      select: { tur: true, miktar: true },
    }),
    prisma.stokHareket.findFirst({
      where: { stokId, tur: "DEVIR" },
      select: { id: true },
    }),
    prisma.stokHareket.findMany({
      where: { stokId, tarih: { gte: baslangic } },
      select: { tur: true, miktar: true },
    }),
  ])

  const oncekiNet = oncesi.reduce(
    (t, h) => t + isaretli(h.tur, Number(h.miktar.toString())),
    0
  )
  if (devirSatiri) return oncekiNet

  const sonrakiNet = sonrasi.reduce(
    (t, h) => t + isaretli(h.tur, Number(h.miktar.toString())),
    0
  )
  return mevcutMiktar - sonrakiNet
}
