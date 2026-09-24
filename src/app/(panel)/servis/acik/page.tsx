import type { Metadata } from "next"

import { KabulListesi } from "@/components/kabul/kabul-listesi"

export const metadata: Metadata = { title: "Açık Onarımlar" }
export const dynamic = "force-dynamic"

type Aramalar = {
  q?: string
  bas?: string
  bit?: string
  formen?: string
  fatura?: string
  sayfa?: string
}

export default async function AcikOnarimlar({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const p = await searchParams
  return (
    <KabulListesi
      baslik="Açık Onarımlar"
      aciklama="Serviste bulunan, henüz teslim edilmemiş araçlar"
      yol="/servis/acik"
      aramalar={{ ...p, durum: "acik" }}
      durumSabit
    />
  )
}
