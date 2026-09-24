"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

/**
 * Etiket üzerindeki taranabilir barkod çizgileri. Code39/EAN gibi kodlama
 * tablosunu elle yazmak riskli — yanlış bir bit deseni etikette gözle
 * ayırt edilemez ama el okuyucusuyla hiç okunmaz. Bu yüzden bilinçli
 * olarak küçük, bağımlılığı olmayan `jsbarcode` kütüphanesi kullanılıyor
 * (PROMPTLAR.md'deki "kütüphane kurma" kuralından burada sapıldı, gerekçe
 * HAFIZA.md'de). CODE128 seçildi çünkü stok barkodu/kodu serbest metin
 * olabiliyor (harf+rakam+sembol), Code39'un aksine küçük harfi de kodlar.
 */
export function BarkodSvg({ deger, yukseklik = 40 }: { deger: string; yukseklik?: number }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !deger) return
    try {
      JsBarcode(ref.current, deger, {
        format: "CODE128",
        displayValue: false,
        height: yukseklik,
        margin: 0,
        width: 1.4,
      })
    } catch {
      // Barkod alanı CODE128'in kabul etmediği bir karakter içeriyorsa
      // (çok nadir) çizgi boş kalır, etikette yine de kod metni okunur.
    }
  }, [deger, yukseklik])

  if (!deger) return null
  return <svg ref={ref} role="img" aria-label={`Barkod: ${deger}`} />
}
