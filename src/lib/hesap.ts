/**
 * KALEM / TOPLAM HESABI
 *
 * Bir satırın tutarı üç ayrı yerde hesaplanıyor: tarayıcıda anlık önizleme,
 * server action'da kaydederken ve kart toplamları yenilenirken. Formül tek
 * yerde durmazsa er geç ekranda başka, veritabanında başka rakam çıkar —
 * bu yüzden burada tek kaynak olarak tutuluyor (istemci de kullanabilsin
 * diye "server-only" DEĞİL).
 *
 * Selpar'daki davranışın aynısı:
 *  - "KDV dahil giriş" işaretliyse girilen birim fiyat KDV'li kabul edilir
 *    ve içinden KDV ayrıştırılır (fiyatın üstüne eklenmez)
 *
 * NOT: İndirim/iskonto kavramı sistemden tamamen kaldırıldı (HAFIZA §113).
 * Dükkân indirim vermiyor; fiyat kalem üzerinde ayarlanıyor.
 */

/** Para alanlarını 2, miktarı 3 haneye yuvarlar — Decimal(18,2) ile uyumlu. */
export function kurusaYuvarla(deger: number): number {
  return Math.round((deger + Number.EPSILON) * 100) / 100
}

export type KalemGirdisi = {
  miktar: number
  birimFiyat: number
  kdvOrani: number
}

export type KalemSonucu = {
  /** KDV hariç tutar. Kabul kartındaki `tutar` alanı. */
  tutar: number
  kdvTutar: number
  toplam: number
}

export function kalemHesapla(
  { miktar, birimFiyat, kdvOrani }: KalemGirdisi,
  kdvDahilGirilir = false
): KalemSonucu {
  // KDV dahil girişte önce fiyatın içinden KDV ayrıştırılır.
  const netBirim = kdvDahilGirilir ? birimFiyat / (1 + kdvOrani / 100) : birimFiyat

  const tutar = kurusaYuvarla(miktar * netBirim)
  const kdvTutar = kurusaYuvarla((tutar * kdvOrani) / 100)

  return { tutar, kdvTutar, toplam: kurusaYuvarla(tutar + kdvTutar) }
}

export type ToplamSatiri = KalemSonucu & { tur: "PARCA" | "ISCILIK" | "DIS_HIZMET" }

export type KabulToplamlari = {
  parcaToplam: number
  iscilikToplam: number
  disHizmetToplam: number
  araToplam: number
  kdvToplam: number
  genelToplam: number
}

/** Kalem satırlarından kart toplamlarını üretir (Selpar'ın alt toplam satırı). */
export function kabulToplamlari(satirlar: ToplamSatiri[]): KabulToplamlari {
  const t = {
    parcaToplam: 0,
    iscilikToplam: 0,
    disHizmetToplam: 0,
    araToplam: 0,
    kdvToplam: 0,
    genelToplam: 0,
  }

  for (const s of satirlar) {
    if (s.tur === "PARCA") t.parcaToplam += s.tutar
    else if (s.tur === "ISCILIK") t.iscilikToplam += s.tutar
    else t.disHizmetToplam += s.tutar

    t.araToplam += s.tutar
    t.kdvToplam += s.kdvTutar
    t.genelToplam += s.toplam
  }

  for (const anahtar of Object.keys(t) as (keyof KabulToplamlari)[]) {
    t[anahtar] = kurusaYuvarla(t[anahtar])
  }
  return t
}
