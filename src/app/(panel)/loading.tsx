import { TabloSkeleton } from "@/components/kabuk/tablo-skeleton"

/**
 * (panel) grubunun GENEL "yükleniyor" iskeleti. Kendi `loading.tsx`'i
 * olmayan her panel rotası navigasyonda bunu gösterir — boş beyaz ekran
 * kalmaz. Yüksek trafikli listelerin kendi (daha isabetli) iskeleti var.
 */
export default function PanelYukleniyor() {
  return <TabloSkeleton />
}
