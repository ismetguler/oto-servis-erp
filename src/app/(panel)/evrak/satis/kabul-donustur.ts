import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { kalemHesapla } from "@/lib/hesap"

/**
 * KABULDEN FATURAYA DÖNÜŞTÜRME — satır kopyalama (adım 9.2)
 *
 * Servis kabul kartı kapandıktan sonra müşteriye kesilecek fatura, kartın
 * parça + işçilik satırlarının aynısıdır. Bu yüzden fatura sıfırdan
 * yazılmaz: kart satırları `EvrakKalem`e KOPYALANIR ve fatura o kabule
 * `Evrak.kabulId` ile bağlanır (alan şemada baştan vardı).
 *
 * KOPYA, BAĞ DEĞİL — bilinçli karar (25 Ağu 2026 desenlerinin devamı):
 * fatura kesildikten sonra kabul satırı değişse bile faturanın tarihsel
 * içeriği bozulmamalı. Kabul kartı kilitli (TESLIM_EDILDI) olduğu için
 * pratikte ayrışma da olmuyor.
 *
 * KDV DAHİL GİRİŞ FARKI: kabul kartında `kdvDahilGirilir` işaretliyse
 * girilen birim fiyat KDV'lidir ve `kalemHesapla` içinden KDV'yi ayrıştırır.
 * `Evrak` tablosunda böyle bir alan YOK (satış faturası her zaman KDV
 * hariç fiyatla çalışıyor) — bu yüzden kopyalarken birim fiyat NET'e
 * çevriliyor. Çevrilmeseydi faturanın genel toplamı kabul kartınınkinden
 * yüksek çıkardı ve cariye yanlış borç yazılırdı.
 */

type Islem = Prisma.TransactionClient

/** Kabul kalemlerini faturaya kopyalar; kopyalanan satır sayısını döner. */
export async function kabulKalemleriniKopyala(
  tx: Islem,
  kabulId: number,
  evrakId: number,
  kdvDahilGirilir: boolean
) {
  const kalemler = await tx.kabulKalem.findMany({
    where: { kabulId },
    orderBy: { sira: "asc" },
  })

  let sira = 0
  for (const k of kalemler) {
    const kdvOrani = Number(k.kdvOrani.toString())
    const girilenFiyat = Number(k.birimFiyat.toString())
    // Faturada tek doğru fiyat KDV hariç olan; hesap `kalemHesapla` ile
    // yapıldığı için burada da aynı ayrıştırma formülü kullanılıyor.
    const birimFiyat = kdvDahilGirilir ? girilenFiyat / (1 + kdvOrani / 100) : girilenFiyat

    const hesap = kalemHesapla({
      miktar: Number(k.miktar.toString()),
      birimFiyat,
      kdvOrani,
    })

    sira += 1
    await tx.evrakKalem.create({
      data: {
        evrak: { connect: { id: evrakId } },
        sira,
        // İşçilik satırının stok kartı yoktur; `stokId` boş kalır ve
        // kesinleştirmede stok tarafına hiç dokunulmaz.
        ...(k.stokId ? { stok: { connect: { id: k.stokId } } } : {}),
        aciklama: k.aciklama,
        birim: k.birim,
        miktar: k.miktar,
        birimFiyat,
        kdvOrani: k.kdvOrani,
        tutar: hesap.tutar,
        kdvTutar: hesap.kdvTutar,
        toplam: hesap.toplam,
      },
    })
  }

  return sira
}
