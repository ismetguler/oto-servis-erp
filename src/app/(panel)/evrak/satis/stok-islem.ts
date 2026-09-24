import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { kalemHesapla, kurusaYuvarla } from "@/lib/hesap"

/**
 * SATIŞ FATURASI — toplam hesabı ve stok düşümü
 *
 * Kalem hesabı (`kalemHesapla`) kabul modülüyle AYNI ortak fonksiyondan
 * geliyor — burada yeniden yazılmadı. Stok hareketi de aynı ilkeyle
 * (StokHareket + mevcutMiktar) çalışıyor, ama kabuldeki `stokCikisiYaz`
 * doğrudan çağrılamıyor: o fonksiyon `kabulId`/`kabulKalemId` alanlarına
 * sıkı bağlı (zorunlu alan), evrakın kendi FK'leri farklı. Depo Transferi
 * modülü de aynı sebeple kendi çift-hareket yazımını yapıyor (bkz.
 * `stok/transfer/actions.ts`) — proje genelinde kabul edilen desen bu.
 *
 * Satırlar TASLAK durumdayken stoğa DOKUNULMAZ; düşüm yalnızca fatura
 * KESİLDİ'ye geçerken tek seferde, tüm satırlar için yapılır (Sayım/
 * Transfer'deki "önce taslak, sonra uygula" ilkesinin aynısı). Bu sayede
 * satır ekleme/silme sırasında stok telafi etme karmaşası hiç doğmuyor.
 */

type Islem = Prisma.TransactionClient

/** Kart toplamlarını kalemlerden yeniden hesaplar (Kabul'deki `toplamlariYenile`nin sade hâli). */
export async function evrakToplamlariniYenile(tx: Islem, evrakId: number) {
  const kalemler = await tx.evrakKalem.findMany({
    where: { evrakId },
    select: { miktar: true, birimFiyat: true, kdvOrani: true },
  })

  const t = { araToplam: 0, kdvToplam: 0, genelToplam: 0 }
  for (const k of kalemler) {
    const h = kalemHesapla({
      miktar: Number(k.miktar.toString()),
      birimFiyat: Number(k.birimFiyat.toString()),
      kdvOrani: Number(k.kdvOrani.toString()),
    })
    t.araToplam += h.tutar
    t.kdvToplam += h.kdvTutar
    t.genelToplam += h.toplam
  }

  for (const anahtar of Object.keys(t) as (keyof typeof t)[]) {
    t[anahtar] = kurusaYuvarla(t[anahtar])
  }

  await tx.evrak.update({ where: { id: evrakId }, data: t })
  return t
}

/**
 * Fatura kesinleşirken: stoklu her satır için CIKIS hareketi + miktar düşümü.
 * `kesinlesenMi` false ise (stok yetersizse dahi) işlem durdurulmaz — Selpar
 * da satış faturasında stok eksi bakiyeye düşmesine izin veriyor, sadece
 * kart üstündeki mevcut miktar uyarısı bilgi amaçlı kalıyor.
 */
export async function evrakStoklariniDus(
  tx: Islem,
  evrakId: number,
  evrakNo: string,
  kullaniciId: number,
  iade = false
) {
  // İade satış faturasında yön TERS: müşteri malı geri getiriyor, stoğa
  // GİRİŞ olur. Normal satışta CIKIS + düşüm.
  const hareketTuru = iade ? "GIRIS" : "CIKIS"
  const kalemler = await tx.evrakKalem.findMany({
    where: { evrakId, stokId: { not: null } },
    select: { stokId: true, miktar: true, birimFiyat: true, tutar: true },
  })

  for (const k of kalemler) {
    if (!k.stokId) continue
    const stok = await tx.stok.findUnique({ where: { id: k.stokId }, select: { depoId: true } })

    await tx.stokHareket.create({
      data: {
        stok: { connect: { id: k.stokId } },
        ...(stok?.depoId ? { depo: { connect: { id: stok.depoId } } } : {}),
        tur: hareketTuru,
        miktar: k.miktar,
        birimFiyat: k.birimFiyat,
        tutar: k.tutar,
        evrakId,
        aciklama: `${iade ? "İade faturası" : "Satış faturası"} ${evrakNo}`,
        kullaniciId,
      },
    })

    await tx.stok.update({
      where: { id: k.stokId },
      data: { mevcutMiktar: iade ? { increment: k.miktar } : { decrement: k.miktar } },
    })
  }
}

/** Fatura iptal edilirken: kesilişte yazılan hareketleri geri yükler. */
export async function evrakStoklariniGeriYukle(tx: Islem, evrakId: number, iade = false) {
  const hareketTuru = iade ? "GIRIS" : "CIKIS"
  const hareketler = await tx.stokHareket.findMany({
    where: { evrakId, tur: hareketTuru },
    select: { id: true, stokId: true, miktar: true },
  })

  for (const h of hareketler) {
    await tx.stok.update({
      where: { id: h.stokId },
      data: { mevcutMiktar: iade ? { decrement: h.miktar } : { increment: h.miktar } },
    })
  }
  if (hareketler.length) {
    await tx.stokHareket.deleteMany({ where: { evrakId, tur: hareketTuru } })
  }
}
