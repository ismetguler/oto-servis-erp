import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { evrakToplamlariniYenile } from "@/app/(panel)/evrak/satis/stok-islem"
import { kalemHesapla } from "@/lib/hesap"

/**
 * SİPARİŞTEN FATURAYA DÖNÜŞTÜRME (adım 9.7) — alınan/verilen ortak fonksiyon
 *
 * Kabulden faturaya dönüştürmenin (adım 9.2, `evrak/satis/kabul-donustur.ts`)
 * aksine burada satırlar OLDUĞU GİBİ kopyalanmıyor — kullanıcı her satır için
 * ne kadarını sevk edeceğini SEÇİYOR (kısmi sevkiyat). Bu yüzden kopyalama
 * mantığı "tüm kalemler" yerine `secimler` listesiyle çalışıyor.
 *
 * `evrakToplamlariniYenile` satış tarafından import edildi ama iş EvrakKalem
 * üzerinde jenerik çalışıyor (evrakId'ye göre) — alış tarafında da doğru
 * sonucu verir, ayrı bir kopya yazmaya gerek yok.
 *
 * ÇİFT STOK/CARİ İŞLEMİ RİSKİ: bu fonksiyon SADECE TASLAK bir Evrak açıp
 * sipariş bakiyesini (sevkMiktar) düşürür. Stok artışı/düşümü ve cariye
 * borç yazma işi burada YAPILMAZ — mevcut Kesinleştir akışı (evrak/satis
 * veya evrak/alis `actions.ts` → `evrakKesinlestir`) faturayı KESILDI'ye
 * geçirirken zaten yapıyor, ona dokunulmadı.
 */

type Islem = Prisma.TransactionClient

export type FaturalanacakSecim = { siparisKalemId: number; miktar: number }

export class SiparisDonusturHatasi extends Error {}

/**
 * Seçilen sipariş kalemlerini yeni bir TASLAK evraka kopyalar, sevkMiktar'ı
 * günceller ve sipariş durumunu (ONAYLANDI → KISMI_SEVK/TAMAMLANDI) ilerletir.
 * Döner: yeni evrakın id'si.
 */
export async function siparisiFaturayaDonustur(
  tx: Islem,
  opts: {
    siparisId: number
    beklenenTip: "ALINAN" | "VERILEN"
    evrakTur: "SATIS" | "ALIS"
    evrakNo: string
    tarih: Date
    vadeTarihi: Date | null
    aciklama: string | null
    secimler: FaturalanacakSecim[]
    kullaniciId: number
  }
): Promise<number> {
  const siparis = await tx.siparis.findUnique({
    where: { id: opts.siparisId },
    include: { kalemler: true },
  })
  if (!siparis || siparis.silindi) throw new SiparisDonusturHatasi("Sipariş bulunamadı.")
  if (siparis.tip !== opts.beklenenTip) throw new SiparisDonusturHatasi("Sipariş bulunamadı.")
  if (siparis.durum !== "ONAYLANDI" && siparis.durum !== "KISMI_SEVK") {
    throw new SiparisDonusturHatasi("Yalnız onaylanmış/kısmi sevk edilmiş sipariş faturaya dönüştürülebilir.")
  }

  const secimHaritasi = new Map(opts.secimler.filter((s) => s.miktar > 0).map((s) => [s.siparisKalemId, s.miktar]))
  if (secimHaritasi.size === 0) {
    throw new SiparisDonusturHatasi("En az bir satırda sevk edilecek miktar girilmeli.")
  }

  const kalemHaritasi = new Map(siparis.kalemler.map((k) => [k.id, k]))
  for (const [kalemId, miktar] of secimHaritasi) {
    const kalem = kalemHaritasi.get(kalemId)
    if (!kalem) throw new SiparisDonusturHatasi("Satır bu siparişe ait değil.")
    const kalan = Number(kalem.miktar.toString()) - Number(kalem.sevkMiktar.toString())
    if (miktar > kalan + 1e-6) {
      throw new SiparisDonusturHatasi(`"${kalem.aciklama}" satırında girilen miktar kalan bakiyeyi aşıyor.`)
    }
  }

  const evrak = await tx.evrak.create({
    data: {
      evrakNo: opts.evrakNo,
      tur: opts.evrakTur,
      tarih: opts.tarih,
      vadeTarihi: opts.vadeTarihi,
      aciklama: opts.aciklama,
      cari: { connect: { id: siparis.cariId } },
      siparis: { connect: { id: siparis.id } },
      olusturanId: opts.kullaniciId,
    },
  })

  let sira = 0
  for (const [kalemId, miktar] of secimHaritasi) {
    const kalem = kalemHaritasi.get(kalemId)!
    const birimFiyat = Number(kalem.birimFiyat.toString())
    const kdvOrani = Number(kalem.kdvOrani.toString())
    const hesap = kalemHesapla({ miktar, birimFiyat, kdvOrani })

    sira += 1
    await tx.evrakKalem.create({
      data: {
        evrak: { connect: { id: evrak.id } },
        sira,
        ...(kalem.stokId ? { stok: { connect: { id: kalem.stokId } } } : {}),
        aciklama: kalem.aciklama,
        birim: kalem.birim,
        miktar,
        birimFiyat,
        kdvOrani,
        tutar: hesap.tutar,
        kdvTutar: hesap.kdvTutar,
        toplam: hesap.toplam,
      },
    })

    await tx.siparisKalem.update({
      where: { id: kalemId },
      data: { sevkMiktar: { increment: miktar } },
    })
  }

  await evrakToplamlariniYenile(tx, evrak.id)

  // Güncel sevkMiktar'lara göre sipariş durumunu ilerlet.
  const guncelKalemler = await tx.siparisKalem.findMany({
    where: { siparisId: siparis.id },
    select: { miktar: true, sevkMiktar: true },
  })
  const tamamiSevkEdildi = guncelKalemler.every(
    (k) => Number(k.sevkMiktar.toString()) >= Number(k.miktar.toString()) - 1e-6
  )
  await tx.siparis.update({
    where: { id: siparis.id },
    data: { durum: tamamiSevkEdildi ? "TAMAMLANDI" : "KISMI_SEVK" },
  })

  return evrak.id
}

/**
 * SİPARİŞTEN KESİLEN FATURA GERİ ALINDIĞINDA (iptal/silme) — sevkMiktar'ı ve
 * sipariş durumunu eski haline döndürür. `siparisiFaturayaDonustur`'un TERSİ.
 *
 * DEMO-HAZIRLIK Z3-A: `evrakIptalEt` stok+cari+kabul borcunu geri yazıyordu
 * ama `Evrak.siparisId` → `SiparisKalem.sevkMiktar` / `Siparis.durum`'a hiç
 * dokunmuyordu. Sonuç: faturası kalmamış "Tamamlandı" sipariş; yeniden
 * faturalanamıyor, UI'dan silinemiyordu.
 *
 * EvrakKalem ↔ SiparisKalem arasında FK yok (migration yasak), ileri yön de
 * satırı `stokId` + `aciklama` + fiyat alanlarını BİREBİR kopyalayarak
 * oluşturuyor — bu yüzden geri eşleme `stokId + aciklama` anahtarıyla
 * yapılıyor, düşülen miktar mevcut sevkMiktar ile sınırlanıyor (asla < 0).
 */
export async function siparisSevkiniGeriAl(tx: Islem, evrakId: number): Promise<void> {
  const evrak = await tx.evrak.findUnique({
    where: { id: evrakId },
    include: { kalemler: true },
  })
  if (!evrak || evrak.siparisId == null) return

  const siparisKalemler = await tx.siparisKalem.findMany({
    where: { siparisId: evrak.siparisId },
  })
  if (siparisKalemler.length === 0) return

  const anahtar = (k: { stokId: number | null; aciklama: string }) =>
    `${k.stokId ?? "x"}|${k.aciklama.trim().toLocaleLowerCase("tr")}`

  const kalemGrup = new Map<string, typeof siparisKalemler>()
  for (const sk of siparisKalemler) {
    const a = anahtar(sk)
    const liste = kalemGrup.get(a) ?? []
    liste.push(sk)
    kalemGrup.set(a, liste)
  }

  // Yerel sevkMiktar takibi — aynı anahtardan birden çok fatura kalemi
  // gelebilir, her düşüş bir sonrakini etkilesin.
  const kalanSevk = new Map<number, number>(
    siparisKalemler.map((sk) => [sk.id, Number(sk.sevkMiktar.toString())])
  )

  for (const ek of evrak.kalemler) {
    let geriAlinacak = Number(ek.miktar.toString())
    const adaylar = kalemGrup.get(anahtar(ek)) ?? []
    for (const sk of adaylar) {
      if (geriAlinacak <= 1e-6) break
      const mevcut = kalanSevk.get(sk.id) ?? 0
      if (mevcut <= 1e-6) continue
      const dus = Math.min(mevcut, geriAlinacak)
      await tx.siparisKalem.update({
        where: { id: sk.id },
        data: { sevkMiktar: { decrement: dus } },
      })
      kalanSevk.set(sk.id, mevcut - dus)
      geriAlinacak -= dus
    }
  }

  // Durumu yeniden hesapla — ileri mantığın tersi. Hiç sevk kalmadıysa
  // ONAYLANDI'ya döner (siparişin faturaya dönüşmeden önceki durumu).
  const guncel = await tx.siparisKalem.findMany({
    where: { siparisId: evrak.siparisId },
    select: { miktar: true, sevkMiktar: true },
  })
  const hicSevkYok = guncel.every((k) => Number(k.sevkMiktar.toString()) <= 1e-6)
  const tamamiSevk = guncel.every(
    (k) => Number(k.sevkMiktar.toString()) >= Number(k.miktar.toString()) - 1e-6
  )
  await tx.siparis.update({
    where: { id: evrak.siparisId },
    data: { durum: hicSevkYok ? "ONAYLANDI" : tamamiSevk ? "TAMAMLANDI" : "KISMI_SEVK" },
  })
}
