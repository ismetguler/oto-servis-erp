"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

export type SekmeTanimi<T extends string> = {
  anahtar: T
  ad: string
}

type Props<T extends string> = {
  sekmeler: readonly SekmeTanimi<T>[]
  etkin: T
  degistir: (anahtar: T) => void
}

/**
 * FORM SEKME ŞERİDİ (madde 4 — mobil/tablet)
 *
 * Kabul, Araç, Cari ve Stok formlarında birebir aynı şerit dört kez
 * kopyalanmıştı; tek bileşene alındı. Davranış:
 *  - md ALTI: şerit kendi içinde yatay kayar (sekmeler alt alta DÜŞMEZ —
 *    telefonda dikey alan kıymetli, 4-6 sekme formu aşağı itmesin).
 *  - Aktif sekme HER ZAMAN görünür: seçilince (ve ilk çizimde) şerit
 *    aktif düğmeyi ortalayacak şekilde kaydırılır. Belirti buydu:
 *    "sağdaki sekme yarım görünüyor".
 *  - md ÜSTÜ: eski davranış aynen — sarmalar, yatay kaydırma yok.
 *
 * Sekme durumu (hangi bölüm açık) çağıran formda kalır; burada yalnızca
 * görünüm var.
 */
export function SekmeSeridi<T extends string>({
  sekmeler,
  etkin,
  degistir,
}: Props<T>) {
  const seritRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const serit = seritRef.current
    if (!serit) return
    const dugme = serit.querySelector<HTMLButtonElement>(`[data-anahtar="${etkin}"]`)
    if (!dugme) return
    // Şerit kaymıyorsa (masaüstü / sığan sekmeler) hiç dokunma: gereksiz
    // `scrollIntoView` sayfayı da kaydırabiliyor.
    if (serit.scrollWidth <= serit.clientWidth) return
    const hedef =
      dugme.offsetLeft - serit.clientWidth / 2 + dugme.offsetWidth / 2
    serit.scrollTo({ left: Math.max(0, hedef), behavior: "smooth" })
  }, [etkin])

  return (
    <div
      ref={seritRef}
      role="tablist"
      className="tablo-sarmal mt-4 flex gap-1 whitespace-nowrap border-b border-border px-4 md:flex-wrap md:overflow-x-visible"
    >
      {sekmeler.map((s) => (
        <button
          key={s.anahtar}
          type="button"
          role="tab"
          aria-selected={etkin === s.anahtar}
          data-anahtar={s.anahtar}
          onClick={() => degistir(s.anahtar)}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition-colors",
            etkin === s.anahtar
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {s.ad}
        </button>
      ))}
    </div>
  )
}
