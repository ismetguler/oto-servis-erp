"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useLinkStatus } from "next/link"

/**
 * ÜST İLERLEME ÇUBUĞU — "tıkladım mı, tıklamadım mı?" sorusunu bitirir
 *
 * Belirti (canlı test): menüden bir listeye tıklayınca 1–2 sn hiçbir şey
 * olmuyordu (liste rotaları `dynamic = "force-dynamic"` ve `loading.tsx`
 * yoktu → `<Link>` prefetch'i tamamen iptal, tarayıcı sunucu render'ını
 * sessizce bekliyor). Kullanıcı ikinci kez tıklıyor, tıklamalar yutulmuş
 * gibi görünüyordu.
 *
 * Çözüm iki katman:
 *  1) rotalara `loading.tsx` — içerik alanında iskelet, boş beyaz kalmaz.
 *  2) bu çubuk — tıklama anında ekranın en üstünde ince bir şerit.
 *
 * App Router'ın "navigasyon başladı" event'i yok. `useLinkStatus` bir
 * `<Link>`'in ALTINDA çalışıp o link için `pending` verir. Menü linklerine
 * görünmez bir `<GezinmeIsareti/>` gömüyoruz; hepsi ortak bir sayaca yazıyor,
 * çubuk sayacı `useSyncExternalStore` ile dinliyor.
 *
 * DAVRANIŞ DEĞİŞİKLİĞİ YOK — yalnızca görsel geri bildirim katmanı.
 */

let aktifSayac = 0
const dinleyiciler = new Set<() => void>()

function bildir() {
  for (const dinle of dinleyiciler) dinle()
}

const depo = {
  abone(dinle: () => void) {
    dinleyiciler.add(dinle)
    return () => {
      dinleyiciler.delete(dinle)
    }
  },
  oku() {
    return aktifSayac > 0
  },
  sunucuDegeri() {
    return false
  },
}

/**
 * Menü / liste linklerinin içine konan görünmez işaret. `useLinkStatus`
 * yalnız bir `<Link>` alt ağacında çalıştığı için ayrı bir bileşen.
 */
export function GezinmeIsareti() {
  const { pending } = useLinkStatus()

  useEffect(() => {
    if (!pending) return
    aktifSayac += 1
    bildir()
    return () => {
      aktifSayac = Math.max(0, aktifSayac - 1)
      bildir()
    }
  }, [pending])

  return null
}

/**
 * Ekranın en üstündeki 2px şerit. Panel layout'unda bir kez çizilir.
 * Şeridin animasyonu 120 ms gecikmeli başlar; gerçekten anında biten
 * navigasyonda göz kırpması yapmaz (belgedeki "gracefully handling fast
 * navigation" deseni).
 */
export function UstIlerlemeCubugu() {
  const bekliyor = useSyncExternalStore(depo.abone, depo.oku, depo.sunucuDegeri)

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className={
          bekliyor
            ? "h-full origin-left bg-primary animate-[gezinme-ilerleme_2s_ease-out_120ms_forwards]"
            : "h-full w-0 bg-primary opacity-0"
        }
      />
    </div>
  )
}
