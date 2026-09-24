import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { kabulToplamlari, kalemHesapla, kurusaYuvarla } from "@/lib/hesap"

/**
 * KABUL — STOK ÇIKIŞI VE TOPLAM HESABI (ortak fonksiyonlar)
 *
 * Bu üç işlem iki ekrandan birden çağrılıyor:
 *  - kabul kartındaki kalem ızgarası (`kabul/actions.ts`)
 *  - depocunun hızlı ekranı ("Kabul Parça Çıkışı", `parca-cikis/actions.ts`)
 *
 * Aynı mantık iki yerde ayrı yazılsaydı, birinde düzeltilen bir hata
 * diğerinde kalırdı ve stok ile kart toplamı sessizce ayrışırdı. Bu yüzden
 * tek kaynak burası; iki taraf da aynı `tx` (transaction) içinde çağırır.
 */

type Islem = Prisma.TransactionClient

/** Parça çıkışını yazar ve stok miktarını düşürür. */
export async function stokCikisiYaz(
  tx: Islem,
  veri: {
    kalemId: number
    kabulId: number
    stokId: number
    miktar: number
    birimFiyat: number
    tutar: number
    kullaniciId: number
    aciklama?: string
  }
) {
  const stok = await tx.stok.findUnique({
    where: { id: veri.stokId },
    select: { depoId: true },
  })

  await tx.stokHareket.create({
    data: {
      stok: { connect: { id: veri.stokId } },
      ...(stok?.depoId ? { depo: { connect: { id: stok.depoId } } } : {}),
      tur: "CIKIS",
      miktar: veri.miktar,
      birimFiyat: veri.birimFiyat,
      tutar: veri.tutar,
      kabulId: veri.kabulId,
      kabulKalemId: veri.kalemId,
      aciklama: veri.aciklama ?? "Araç kabul parça çıkışı",
      kullaniciId: veri.kullaniciId,
    },
  })

  await tx.stok.update({
    where: { id: veri.stokId },
    data: { mevcutMiktar: { decrement: veri.miktar } },
  })
}

/** Satıra ait stok çıkışlarını iptal eder ve miktarı geri yükler. */
export async function stokHareketiniGeriAl(tx: Islem, kalemId: number) {
  const hareketler = await tx.stokHareket.findMany({
    where: { kabulKalemId: kalemId },
    select: { id: true, stokId: true, miktar: true },
  })

  for (const h of hareketler) {
    await tx.stok.update({
      where: { id: h.stokId },
      data: { mevcutMiktar: { increment: h.miktar } },
    })
  }
  if (hareketler.length) {
    await tx.stokHareket.deleteMany({ where: { kabulKalemId: kalemId } })
  }
}

/**
 * Kart toplamlarını kalemlerden yeniden hesaplar.
 * Toplamlar `kabuller` tablosunda tutuluyor (liste ekranı her satır için
 * kalemleri toplasaydı liste yavaşlardı) — ama tek doğru kaynak kalemlerdir,
 * bu yüzden her değişiklikte sıfırdan hesaplanır.
 */
export async function toplamlariYenile(tx: Islem, kabulId: number) {
  const kalemler = await tx.kabulKalem.findMany({
    where: { kabulId },
    select: {
      tur: true,
      miktar: true,
      birimFiyat: true,
      kdvOrani: true,
    },
  })

  const kabul = await tx.kabul.findUnique({
    where: { id: kabulId },
    select: { kdvDahilGirilir: true },
  })

  const satirlar = kalemler.map((k) => ({
    tur: k.tur,
    ...kalemHesapla(
      {
        miktar: Number(k.miktar.toString()),
        birimFiyat: Number(k.birimFiyat.toString()),
        kdvOrani: Number(k.kdvOrani.toString()),
      },
      kabul?.kdvDahilGirilir ?? false
    ),
  }))

  const t = kabulToplamlari(satirlar)

  await tx.kabul.update({
    where: { id: kabulId },
    data: {
      // Dış hizmet parça tarafında raporlanıyor (Selpar'da da malzeme
      // toplamının içinde görünür), ayrı sütuna gerek duyulmadı.
      parcaToplam: kurusaYuvarla(t.parcaToplam + t.disHizmetToplam),
      iscilikToplam: t.iscilikToplam,
      araToplam: t.araToplam,
      kdvToplam: t.kdvToplam,
      genelToplam: t.genelToplam,
    },
  })

  return t
}
