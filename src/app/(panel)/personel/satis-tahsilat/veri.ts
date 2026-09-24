import "server-only"

import { gunBasi, gunSonu, sayi } from "@/lib/bicim"
import { kurusaYuvarla } from "@/lib/hesap"
import { prisma } from "@/lib/prisma"

/**
 * PERSONEL SATIŞ - TAHSİLAT RAPORU (adım 7.2)
 *
 * "Bu usta dönemde ne kadarlık iş çıkardı, kaçı tahsil edildi, kaçı kaldı."
 *
 * Ölçüt kararı (komisyon raporuyla BİLİNÇLİ olarak farklı):
 * - Satış = kartın KDV DAHİL genel toplamı (parça + işçilik). Komisyonda
 *   parça yoktu çünkü orada hakediş hesaplanıyordu; burada ciro ölçülüyor,
 *   müşterinin ödediği tutarın tamamı personelin çıkardığı iştir.
 * - Kart birden çok ustaya atanmışsa tutar EŞİT bölünür; yoksa iki kişilik
 *   bir iş iki kez sayılır ve toplam ciro şişerdi.
 * - Tahsilat = o karta BAĞLI tahsilat fişlerinin neti (tahsilat − iade/ödeme),
 *   aynı oranda bölünür. Karta bağlanmamış (yalnız cariye yazılan) tahsilat
 *   burada görünmez — hangi işe ait olduğu bilinmiyor, tahmin edilmez.
 * - Dönem ölçütü TESLİM tarihi; kart teslim edilmemişse ciro doğmamıştır.
 */

export type SatisTahsilatFiltreleri = {
  bas?: string
  bit?: string
  personel?: string
}

export type PersonelSatisSatiri = {
  kabulId: number
  kabulNo: string
  tarih: Date
  plaka: string
  musteri: string
  paydas: number
  satis: number
  tahsilat: number
}

export type PersonelSatisi = {
  personelId: number
  kod: string
  unvan: string
  gorevi: string | null
  isAdedi: number
  satis: number
  tahsilat: number
  kalan: number
  satirlar: PersonelSatisSatiri[]
}

/** Varsayılan dönem: içinde bulunulan ay. Rapor açılır açılmaz dolu gelsin. */
export function varsayilanDonem(bugun = new Date()): { bas: string; bit: string } {
  const ilk = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
  const son = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0)
  const g = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`
  return { bas: g(ilk), bit: g(son) }
}

/** Rapor ekranlarının personel seçim kutusunu besler. */
export async function personelSecenekleriGetir() {
  return prisma.cari.findMany({
    where: { turu: "PERSONEL", silindi: false },
    orderBy: { unvan: "asc" },
    select: { id: true, unvan: true },
  })
}

function araligaCevir(bas: string, bit: string) {
  const b = bas ? gunBasi(new Date(bas)) : undefined
  const s = bit ? gunSonu(new Date(bit)) : undefined
  return b || s ? { ...(b ? { gte: b } : {}), ...(s ? { lte: s } : {}) } : undefined
}

export function satisFiltreSorgusu(f: SatisTahsilatFiltreleri): string {
  const p = new URLSearchParams()
  if (f.bas) p.set("bas", f.bas)
  if (f.bit) p.set("bit", f.bit)
  if (f.personel) p.set("personel", f.personel)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

export async function satisTahsilatGetir(
  f: SatisTahsilatFiltreleri
): Promise<PersonelSatisi[]> {
  const aralik = araligaCevir(f.bas ?? "", f.bit ?? "")
  const secilen = Number(f.personel ?? "") || 0

  const kabuller = await prisma.kabul.findMany({
    where: {
      silindi: false,
      durum: "TESLIM_EDILDI",
      ...(aralik ? { teslimTarihi: aralik } : {}),
      personeller: { some: {} },
    },
    orderBy: { teslimTarihi: "asc" },
    select: {
      id: true,
      kabulNo: true,
      teslimTarihi: true,
      girisTarihi: true,
      genelToplam: true,
      arac: { select: { plaka: true } },
      cari: { select: { unvan: true } },
      personeller: { select: { personelId: true } },
      tahsilatlar: {
        where: { silindi: false },
        select: { tur: true, tutar: true },
      },
    },
  })

  const kova = new Map<number, PersonelSatisSatiri[]>()

  for (const k of kabuller) {
    const hedefler = k.personeller.map((p) => p.personelId)
    if (hedefler.length === 0) continue

    // Fişin yönü: TAHSILAT para girişi, TEDIYE (iade) çıkışı — net alınıyor.
    const tahsilNet = k.tahsilatlar.reduce(
      (t, f2) => t + (f2.tur === "TAHSILAT" ? sayi(f2.tutar) : -sayi(f2.tutar)),
      0
    )

    const satis = kurusaYuvarla(sayi(k.genelToplam) / hedefler.length)
    const tahsilat = kurusaYuvarla(tahsilNet / hedefler.length)

    for (const pid of hedefler) {
      const liste = kova.get(pid) ?? []
      liste.push({
        kabulId: k.id,
        kabulNo: k.kabulNo,
        tarih: k.teslimTarihi ?? k.girisTarihi,
        plaka: k.arac.plaka,
        musteri: k.cari.unvan,
        paydas: hedefler.length,
        satis,
        tahsilat,
      })
      kova.set(pid, liste)
    }
  }

  const idler = [...kova.keys()].filter((id) => !secilen || id === secilen)
  const kartlar = idler.length
    ? await prisma.cari.findMany({
        where: { id: { in: idler } },
        select: { id: true, kod: true, unvan: true, gorevi: true },
      })
    : []

  return kartlar
    .map((c) => {
      const satirlar = (kova.get(c.id) ?? []).sort(
        (a, b) => a.tarih.getTime() - b.tarih.getTime()
      )
      const satis = kurusaYuvarla(satirlar.reduce((t, s) => t + s.satis, 0))
      const tahsilat = kurusaYuvarla(satirlar.reduce((t, s) => t + s.tahsilat, 0))
      return {
        personelId: c.id,
        kod: c.kod,
        unvan: c.unvan,
        gorevi: c.gorevi,
        isAdedi: satirlar.length,
        satis,
        tahsilat,
        kalan: kurusaYuvarla(satis - tahsilat),
        satirlar,
      }
    })
    .sort((a, b) => b.satis - a.satis || a.unvan.localeCompare(b.unvan, "tr"))
}
