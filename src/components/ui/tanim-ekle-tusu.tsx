"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"

/**
 * "+ Yeni X" — açılır listede aranan tanım (kart türü, bakım şekli, marka,
 * üretici, proje, işçilik bölümü...) yoksa kaçış kapısı. `YeniKayitTusu`nun
 * (araç/cari kartı açan) tanım ekranlarına özel hâli:
 *
 *  - `hedefYol`: tanımın yönetildiği ekran — çoğu tür için
 *    `/ayar/tanim?tur=KART_TURU` gibi, Proje/İşçilik Bölümü gibi kendi özel
 *    ekranı olanlar için `/servis/proje` / `/iscilik/bolum`.
 *  - Dönüş adresi (bu formun tam adresi) `usePathname`/`useSearchParams`den
 *    kendiliğinden üretilir — çağıran bunu bilmek zorunda değil.
 *  - Kayıt eklenince o ekran kullanıcıyı buraya, `alan` sorgu parametresiyle
 *    işaretlenen alanda yeni değeri seçili bırakarak geri yollar
 *    (bkz. `useTanimDonusu`, `lib/donus.ts`).
 */
export function TanimEkleTusu({
  hedefYol,
  alan,
  baslik,
}: {
  hedefYol: string
  alan: string
  baslik: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const suAnkiSorgu = searchParams.toString()
  const suAnkiYol = `${pathname}${suAnkiSorgu ? `?${suAnkiSorgu}` : ""}`

  const ayrac = hedefYol.includes("?") ? "&" : "?"
  const hedef = `${hedefYol}${ayrac}donusYol=${encodeURIComponent(suAnkiYol)}&donusAlan=${encodeURIComponent(alan)}`

  return (
    <Link
      href={hedef}
      title={`${baslik} listede yok — yeni tanım ekle`}
      onClick={(olay) => {
        if (
          !window.confirm(
            `${baslik} ekranına gidilecek. Bu formda doldurduklarınız kaybolur — devam edilsin mi?`
          )
        ) {
          olay.preventDefault()
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5 text-[0.6875rem] font-medium text-primary transition-colors hover:bg-accent hover:underline"
    >
      <Plus className="size-3" aria-hidden />
      Yeni
    </Link>
  )
}
