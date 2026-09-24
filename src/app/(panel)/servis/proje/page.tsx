import type { Metadata } from "next"
import Link from "next/link"
import { BarChart3 } from "lucide-react"

import { projeleriGetir } from "./veri"
import { ProjeYonetimi } from "@/components/proje/proje-yonetimi"
import { Button } from "@/components/ui/button"
import { tanimDonusYoluGuvenliMi } from "@/lib/donus"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Projeler" }
export const dynamic = "force-dynamic"

export default async function ProjeTanimlari({
  searchParams,
}: {
  searchParams: Promise<{ donusYol?: string; donusAlan?: string }>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")
  const projeler = await projeleriGetir()
  const p = await searchParams
  const donusYol =
    p.donusYol && p.donusAlan && tanimDonusYoluGuvenliMi(p.donusYol) ? p.donusYol : undefined
  const donusAlan = donusYol ? p.donusAlan : undefined

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Projeler</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Filo ve kurumsal işlerin toplandığı etiketler — kabul ve araç kartında seçilir ·{" "}
            {projeler.length} proje
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/servis/proje/rapor">
            <BarChart3 className="size-4" aria-hidden />
            Proje Raporu
          </Link>
        </Button>
      </div>

      <ProjeYonetimi
        projeler={projeler}
        duzeltebilir={yetkiVar(kullanici, "kabul", "duzelt")}
        silebilir={yetkiVar(kullanici, "kabul", "sil")}
        donusYol={donusYol}
        donusAlan={donusAlan}
      />
    </div>
  )
}
