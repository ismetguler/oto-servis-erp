import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ekspertizAraclariGetir, ekspertizCarileriGetir } from "../veri"
import { EkspertizFormu } from "@/components/ekspertiz/ekspertiz-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Ekspertiz" }
export const dynamic = "force-dynamic"

export default async function YeniEkspertiz({
  searchParams,
}: {
  searchParams: Promise<{ arac?: string; cari?: string }>
}) {
  await yetkiliOturum("kabul", "ekle")
  const p = await searchParams

  const [cariler, araclar] = await Promise.all([
    ekspertizCarileriGetir(),
    ekspertizAraclariGetir(),
  ])

  const aracId = Number(p.arac)
  const cariId = Number(p.cari)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/servis/ekspertiz" aria-label="Ekspertiz listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Yeni Ekspertiz
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Ekspertiz numarası kayıtta otomatik üretilir. Bu kart bir ön
              tahmindir; cari, kasa veya stok hareketi oluşturmaz.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <EkspertizFormu
          cariler={cariler}
          araclar={araclar}
          varsayilanAracId={Number.isInteger(aracId) && aracId > 0 ? aracId : undefined}
          varsayilanCariId={Number.isInteger(cariId) && cariId > 0 ? cariId : undefined}
        />
      </div>
    </div>
  )
}
