import type { Metadata } from "next"

import { KabulListesi } from "@/components/kabul/kabul-listesi"

export const metadata: Metadata = { title: "Kapalı Onarımlar" }
export const dynamic = "force-dynamic"

type Aramalar = {
  q?: string
  bas?: string
  bit?: string
  formen?: string
  fatura?: string
  sayfa?: string
}

export default async function KapaliOnarimlar({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const p = await searchParams
  return (
    <KabulListesi
      baslik="Kapalı Onarımlar"
      aciklama="Teslim edilmiş, kapanmış iş emirleri"
      yol="/servis/kapali"
      aramalar={{ ...p, durum: "kapali" }}
      durumSabit
    />
  )
}
