import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { aracDropdownlariGetir, aracFormVerisi, sahipCarileriGetir } from "../../veri"
import { AracFormu } from "@/components/arac/arac-formu"
import { Button } from "@/components/ui/button"
import { aracKatalogVerisi } from "@/lib/arac-katalog"
import { plaka } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Araç Düzenle" }

export default async function AracDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("arac", "duzelt")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const [arac, dropdownlar, sahipCariler, katalog] = await Promise.all([
    aracFormVerisi(kayitId),
    aracDropdownlariGetir(),
    sahipCarileriGetir(),
    aracKatalogVerisi(),
  ])
  if (!arac) notFound()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/arac/${arac.id}`} aria-label="Araç kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="font-mono text-[1.0625rem] font-semibold tracking-tight">
              {plaka(arac.plaka)}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {[arac.marka, arac.model].filter(Boolean).join(" ") || "Araç düzenle"}
            </p>
          </div>
        </div>
      </div>

      <AracFormu
        baslangic={arac}
        dropdownlar={dropdownlar}
        katalog={katalog}
        sahipCariler={sahipCariler}
      />
    </div>
  )
}
