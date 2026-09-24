import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { plasiyerleriGetir } from "../veri"
import { tanimSecenekleri } from "@/app/(panel)/ayar/tanim/veri"
import { CariFormu } from "@/components/cari/cari-formu"
import { Button } from "@/components/ui/button"
import { donusAnahtari } from "@/lib/donus"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Cari" }

export default async function YeniCari({
  searchParams,
}: {
  searchParams: Promise<{ donus?: string }>
}) {
  await yetkiliOturum("cari", "ekle")
  const p = await searchParams

  const [plasiyerler, musteriSiniflari] = await Promise.all([
    plasiyerleriGetir(),
    tanimSecenekleri("MUSTERI_SINIFI"),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cari" aria-label="Cari listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Yeni Cari Kartı
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Müşteri, tedarikçi veya personel kaydı açın
            </p>
          </div>
        </div>
      </div>

      <CariFormu
        plasiyerler={plasiyerler}
        musteriSiniflari={musteriSiniflari}
        donus={donusAnahtari(p.donus)}
      />
    </div>
  )
}
