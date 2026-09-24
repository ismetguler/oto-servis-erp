import "server-only"

import { evrakToplamlariniYenile } from "../satis/stok-islem"
import type { Prisma } from "@/generated/prisma/client"

/**
 * ALIŞ FATURASI — stok girişi
 *
 * Toplam hesabı (`evrakToplamlariniYenile`) satış tarafıyla birebir aynı
 * (Evrak/EvrakKalem şeması ortak) — burada yeniden yazılmadı, doğrudan
 * yeniden kullanıldı. Stok hareketi satıştaki `evrakStoklariniDus`un
 * AYNASI: yön ters (GIRIS, increment) ve ek olarak stok kartının alış
 * fiyatı güncelleniyor (bu adımın kararı — "en mantıklısı": fatura
 * kesilirken kart otomatik güncellenir, ayrı bir onay istenmez).
 *
 * Satırlar TASLAK durumdayken stoğa DOKUNULMAZ; giriş yalnızca fatura
 * KESİLDİ'ye geçerken tek seferde uygulanır (satıştaki ilkenin aynısı).
 */

type Islem = Prisma.TransactionClient

export { evrakToplamlariniYenile }

/**
 * Fatura kesinleşirken: stoklu her satır için GIRIS hareketi + miktar artışı
 * + stok kartının `alisFiyat` alanının faturadaki (KDV hariç) birim fiyatla
 * güncellenmesi.
 */
export async function evrakStoklariniArtir(
  tx: Islem,
  evrakId: number,
  evrakNo: string,
  kullaniciId: number,
  iade = false
) {
  // İade alış faturasında yön TERS: malı tedarikçiye geri veriyoruz, stoktan
  // ÇIKIŞ olur. Ağırlıklı ortalama maliyet ve alış fiyatı bu durumda
  // GÜNCELLENMEZ — çıkan mal maliyeti yeniden ağırlıklandırmaz.
  const hareketTuru = iade ? "CIKIS" : "GIRIS"
  const kalemler = await tx.evrakKalem.findMany({
    where: { evrakId, stokId: { not: null } },
    select: { stokId: true, miktar: true, birimFiyat: true, tutar: true },
  })

  for (const k of kalemler) {
    if (!k.stokId) continue
    const stok = await tx.stok.findUnique({
      where: { id: k.stokId },
      select: { depoId: true, mevcutMiktar: true, ortalamaMaliyet: true },
    })

    await tx.stokHareket.create({
      data: {
        stok: { connect: { id: k.stokId } },
        ...(stok?.depoId ? { depo: { connect: { id: stok.depoId } } } : {}),
        tur: hareketTuru,
        miktar: k.miktar,
        birimFiyat: k.birimFiyat,
        tutar: k.tutar,
        evrakId,
        aciklama: `${iade ? "İade faturası" : "Alış faturası"} ${evrakNo}`,
        kullaniciId,
      },
    })

    if (iade) {
      await tx.stok.update({
        where: { id: k.stokId },
        data: { mevcutMiktar: { decrement: k.miktar } },
      })
      continue
    }

    // Ağırlıklı ortalama maliyet: (eldeki değer + giren değer) / toplam miktar.
    // Kart maliyeti hiç girilmemişse (0) ilk alış fiyatını taban al —
    // yoksa envanter / maliyet raporları stoğu sıfır değerle gösterir.
    const eskiMiktar = Number(stok?.mevcutMiktar ?? 0)
    const eskiOrt = Number(stok?.ortalamaMaliyet ?? 0)
    const girenMiktar = Number(k.miktar)
    const girenFiyat = Number(k.birimFiyat)
    const tabanOrt = eskiOrt > 0 ? eskiOrt : girenFiyat
    const yeniMiktar = eskiMiktar + girenMiktar
    const yeniOrt =
      yeniMiktar > 0
        ? (eskiMiktar * tabanOrt + girenMiktar * girenFiyat) / yeniMiktar
        : girenFiyat

    await tx.stok.update({
      where: { id: k.stokId },
      data: {
        mevcutMiktar: { increment: k.miktar },
        alisFiyat: k.birimFiyat,
        ortalamaMaliyet: yeniOrt.toFixed(2),
      },
    })
  }
}

/**
 * Fatura iptal edilirken: kesilişte yazılan GIRIS hareketlerini geri alır.
 * Stok kartındaki `alisFiyat` bilerek GERİ ALINMIYOR — kart üstünde
 * sonradan başka bir işlemin yazmış olabileceği fiyatı geçersiz kılmamak
 * için (satıştaki fiyata hiç dokunmama ilkesiyle tutarlı: tek yön güncelleme).
 */
export async function evrakStoklariniGeriAl(tx: Islem, evrakId: number, iade = false) {
  const hareketTuru = iade ? "CIKIS" : "GIRIS"
  const hareketler = await tx.stokHareket.findMany({
    where: { evrakId, tur: hareketTuru },
    select: { id: true, stokId: true, miktar: true },
  })

  for (const h of hareketler) {
    await tx.stok.update({
      where: { id: h.stokId },
      data: { mevcutMiktar: iade ? { increment: h.miktar } : { decrement: h.miktar } },
    })
  }
  if (hareketler.length) {
    await tx.stokHareket.deleteMany({ where: { evrakId, tur: hareketTuru } })
  }
}
