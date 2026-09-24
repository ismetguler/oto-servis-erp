import "server-only"

import type { TanimTur } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export type TanimSatiri = {
  id: number
  kod: string | null
  ad: string
  sira: number
  aktif: boolean
  kullanim: number
}

/**
 * KULLANIM SAYISI — Selpar/şema kararı: bu ekranın yönettiği türlerin
 * çoğu (araç markası, yakıt türü, kart türü, masraf türü...) `Arac`/
 * `Kabul`/`KasaHareket` tablolarında GERÇEK bir yabancı anahtar DEĞİL,
 * seçilen METNİN kopyalandığı serbest sütun (`Arac.marka`, `Kabul.
 * kartTuru` gibi) — İşçilik Bölümü'nün aksine `_count` ile
 * sayılamıyor. Bu yüzden "kaç kayıtta kullanılıyor" sorusu METİN
 * EŞLEŞMESİYLE cevaplanıyor: silme/pasife alma öncesi uyarı buradan geliyor.
 *
 * STOK_GRUP / URUN_GRUBU / URETICI / MUSTERI_SINIFI şu an hiçbir formda
 * seçilmiyor (kontrol edildi, kod hiçbir yerde bu türleri okumuyor) — bu
 * yüzden karşılığı yok, hep 0 döner. İleride bu alanlar gerçek bir forma
 * bağlanırsa buraya da bir `case` eklenmeli.
 */
async function kullanimSayisi(tur: TanimTur, ad: string): Promise<number> {
  switch (tur) {
    case "ARAC_MARKA":
      return prisma.arac.count({ where: { marka: ad, silindi: false } })
    case "ARAC_MODEL_UST":
      return prisma.arac.count({ where: { modelUst: ad, silindi: false } })
    case "ARAC_MODEL":
      return prisma.arac.count({ where: { model: ad, silindi: false } })
    case "ARAC_RENK":
      return prisma.arac.count({ where: { renk: ad, silindi: false } })
    case "ARAC_TURU":
      return prisma.arac.count({ where: { aracTuru: ad, silindi: false } })
    case "YAKIT_TURU":
      return prisma.arac.count({ where: { yakitTuru: ad, silindi: false } })
    case "VITES_TURU":
      return prisma.arac.count({ where: { vitesTuru: ad, silindi: false } })
    case "KASA_TIPI":
      return prisma.arac.count({ where: { kasaTipi: ad, silindi: false } })
    case "ISTEK_TURU":
      return prisma.kabul.count({ where: { istekTuru: ad } })
    case "BAKIM_SEKLI":
      return prisma.kabul.count({ where: { bakimSekli: ad } })
    case "KART_TURU":
      return prisma.kabul.count({ where: { kartTuru: ad } })
    case "MASRAF":
      return prisma.kasaHareket.count({ where: { masrafTuru: ad } })
    default:
      return 0
  }
}

export async function tanimlariGetir(tur: TanimTur): Promise<TanimSatiri[]> {
  const kayitlar = await prisma.tanim.findMany({
    where: { tur },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { id: true, kod: true, ad: true, sira: true, aktif: true },
  })

  return Promise.all(
    kayitlar.map(async (k) => ({ ...k, kullanim: await kullanimSayisi(tur, k.ad) }))
  )
}

/** Sil/pasife almadan önce tek bir kaydın kullanım sayısını sorgular. */
export async function tanimKullanimSayisi(tur: TanimTur, ad: string): Promise<number> {
  return kullanimSayisi(tur, ad)
}

/**
 * Bir tanım türünün AKTİF adları — form açılırlarını beslemek için hafif
 * sorgu (kullanım sayısı hesaplamıyor). `<ListeVeyaYaz>` bileşenine
 * doğrudan `secenekler` olarak verilir; liste boşsa alan serbest metne düşer.
 */
export async function tanimSecenekleri(tur: TanimTur): Promise<string[]> {
  const kayitlar = await prisma.tanim.findMany({
    where: { tur, aktif: true },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: { ad: true },
  })
  return kayitlar.map((k) => k.ad)
}
