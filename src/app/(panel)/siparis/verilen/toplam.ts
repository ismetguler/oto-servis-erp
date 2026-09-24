import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { kalemHesapla, kurusaYuvarla } from "@/lib/hesap"

/**
 * Kart toplamlarını kalem satırlarından yeniden hesaplar — `siparis/alinan/
 * toplam.ts`nin aynası, `SiparisKalem` tablosu tipe göre ayrılmadığı için
 * mantık birebir aynı kalıyor.
 */
export async function siparisToplamlariniYenile(tx: Prisma.TransactionClient, siparisId: number) {
  const kalemler = await tx.siparisKalem.findMany({
    where: { siparisId },
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

  await tx.siparis.update({ where: { id: siparisId }, data: t })
  return t
}
