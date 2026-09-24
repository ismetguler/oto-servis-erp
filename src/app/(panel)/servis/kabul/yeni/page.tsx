import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import {
  formenleriGetir,
  kabulAraclariGetir,
  kabulCarileriGetir,
  kabulDropdownlariGetir,
  personelleriGetir,
} from "../veri"
import { tumAktifFiloSozlesmeleriGetir } from "../../../cari/filo/veri"
import { KabulFormu } from "@/components/kabul/kabul-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Araç Kabul" }
export const dynamic = "force-dynamic"

export default async function YeniKabul({
  searchParams,
}: {
  searchParams: Promise<{ arac?: string; cari?: string }>
}) {
  await yetkiliOturum("kabul", "ekle")
  const p = await searchParams

  const [cariler, araclar, formenler, personeller, dropdownlar, filoSozlesmeleri] =
    await Promise.all([
      kabulCarileriGetir(),
      kabulAraclariGetir(),
      formenleriGetir(),
      personelleriGetir(),
      kabulDropdownlariGetir(),
      tumAktifFiloSozlesmeleriGetir(),
    ])

  const aracId = Number(p.arac)
  const cariId = Number(p.cari)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/servis/kabul" aria-label="Kabul listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Araç Kabul</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Kabul numarası kayıtta otomatik üretilir. Parça / işçilik satırları kart
              açıldıktan sonra eklenir.
            </p>
          </div>
        </div>
      </div>

      <KabulFormu
        cariler={cariler}
        araclar={araclar}
        formenler={formenler}
        personeller={personeller}
        dropdownlar={dropdownlar}
        filoSozlesmeleri={filoSozlesmeleri}
        varsayilanAracId={Number.isInteger(aracId) && aracId > 0 ? aracId : undefined}
        varsayilanCariId={Number.isInteger(cariId) && cariId > 0 ? cariId : undefined}
      />
    </div>
  )
}
