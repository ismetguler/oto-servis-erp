import type { Metadata } from "next"

import { KabulListesi } from "@/components/kabul/kabul-listesi"

export const metadata: Metadata = { title: "Silinen Kabuller" }
export const dynamic = "force-dynamic"

type Aramalar = { q?: string; bas?: string; bit?: string; formen?: string; sayfa?: string }

export default async function SilinenKabuller({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const p = await searchParams
  return (
    <KabulListesi
      baslik="Silinen Kabuller"
      aciklama="Silinmiş kartlar — istenirse geri alınabilir"
      yol="/servis/kabul/silinen"
      aramalar={{ ...p, durum: "silinen" }}
      durumSabit
    />
  )
}
