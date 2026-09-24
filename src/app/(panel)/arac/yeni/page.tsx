import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { aracDropdownlariGetir, sahipCarileriGetir } from "../veri"
import { AracFormu } from "@/components/arac/arac-formu"
import { Button } from "@/components/ui/button"
import { aracKatalogVerisi } from "@/lib/arac-katalog"
import { donusAnahtari } from "@/lib/donus"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Araç" }

export default async function YeniArac({
  searchParams,
}: {
  searchParams: Promise<{ cariId?: string; donus?: string }>
}) {
  await yetkiliOturum("arac", "ekle")

  const p = await searchParams
  const varsayilanCariId = Number(p.cariId)

  const [dropdownlar, sahipCariler, katalog] = await Promise.all([
    aracDropdownlariGetir(),
    sahipCarileriGetir(),
    aracKatalogVerisi(),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/arac" aria-label="Araç listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Yeni Araç Kartı</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Plaka, teknik bilgiler ve garanti/sigorta takibini girin
            </p>
          </div>
        </div>
      </div>

      <AracFormu
        dropdownlar={dropdownlar}
        katalog={katalog}
        sahipCariler={sahipCariler}
        varsayilanCariId={Number.isInteger(varsayilanCariId) ? varsayilanCariId : undefined}
        donus={donusAnahtari(p.donus)}
      />
    </div>
  )
}
