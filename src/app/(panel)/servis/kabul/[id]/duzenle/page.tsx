import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import {
  formenleriGetir,
  kabulAraclariGetir,
  kabulCarileriGetir,
  kabulDropdownlariGetir,
  kabulFormVerisi,
  personelleriGetir,
} from "../../veri"
import { tumAktifFiloSozlesmeleriGetir } from "../../../../cari/filo/veri"
import { KabulFormu } from "@/components/kabul/kabul-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Kabul Kartını Düzenle" }
export const dynamic = "force-dynamic"

export default async function KabulDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("kabul", "duzelt")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const [
    baslangic,
    cariler,
    araclar,
    formenler,
    personeller,
    dropdownlar,
    filoSozlesmeleri,
  ] = await Promise.all([
    kabulFormVerisi(kayitId),
    kabulCarileriGetir(),
    kabulAraclariGetir(),
    formenleriGetir(),
    personelleriGetir(),
    kabulDropdownlariGetir(),
    tumAktifFiloSozlesmeleriGetir(),
  ])

  if (!baslangic) notFound()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/servis/kabul/${kayitId}`} aria-label="Kabul kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              {baslangic.kabulNo} — Kartı Düzenle
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Kabul bilgileri. Parça / işçilik satırları kart ekranından yönetilir.
            </p>
          </div>
        </div>
      </div>

      <KabulFormu
        baslangic={baslangic}
        cariler={cariler}
        araclar={araclar}
        formenler={formenler}
        personeller={personeller}
        dropdownlar={dropdownlar}
        filoSozlesmeleri={filoSozlesmeleri}
      />
    </div>
  )
}
