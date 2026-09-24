import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import {
  ekspertizAraclariGetir,
  ekspertizCarileriGetir,
  ekspertizGetir,
} from "../../veri"
import { EkspertizFormu } from "@/components/ekspertiz/ekspertiz-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Ekspertiz Düzenle" }
export const dynamic = "force-dynamic"

export default async function EkspertizDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("kabul", "duzelt")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const [kayit, cariler, araclar] = await Promise.all([
    ekspertizGetir(kayitId),
    ekspertizCarileriGetir(),
    ekspertizAraclariGetir(),
  ])
  if (!kayit) notFound()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/servis/ekspertiz/${kayitId}`} aria-label="Karta dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              {kayit.ekspertizNo}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Ekspertiz kartını düzenle
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <EkspertizFormu baslangic={kayit} cariler={cariler} araclar={araclar} />
      </div>
    </div>
  )
}
