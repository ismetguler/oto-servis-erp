import type { Metadata } from "next"

import { EkspertizListesi } from "@/components/ekspertiz/ekspertiz-listesi"

export const metadata: Metadata = { title: "Ekspertiz" }
export const dynamic = "force-dynamic"

type Aramalar = {
  q?: string
  durum?: string
  bas?: string
  bit?: string
  sayfa?: string
}

export default async function EkspertizSayfasi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  return <EkspertizListesi aramalar={await searchParams} />
}
