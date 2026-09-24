import type { Metadata } from "next"

import { KabulListesi } from "@/components/kabul/kabul-listesi"

export const metadata: Metadata = { title: "Tüm Kabuller" }
export const dynamic = "force-dynamic"

type Aramalar = {
  q?: string
  durum?: string
  bas?: string
  bit?: string
  formen?: string
  fatura?: string
  sayfa?: string
}

export default async function TumKabuller({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const p = await searchParams
  return (
    <KabulListesi
      baslik="Tüm Kabuller"
      aciklama="Servise giren tüm iş emirleri"
      yol="/servis/kabul"
      aramalar={p}
    />
  )
}
