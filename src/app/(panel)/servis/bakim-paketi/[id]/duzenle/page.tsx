import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { paketFormVerisi } from "../../veri"
import { tanimAdlari } from "../../tanimlar"
import { PaketFormu } from "@/components/bakim-paketi/paket-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Bakım Paketi Düzenle" }
export const dynamic = "force-dynamic"

export default async function BakimPaketiDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("kabul", "duzelt")

  const { id } = await params
  const paketId = Number(id)
  if (!Number.isInteger(paketId)) notFound()

  const [baslangic, aracTurleri, markalar] = await Promise.all([
    paketFormVerisi(paketId),
    tanimAdlari("ARAC_TURU"),
    tanimAdlari("ARAC_MARKA"),
  ])
  if (!baslangic) notFound()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/servis/bakim-paketi/${paketId}`} aria-label="Paket kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              {baslangic.kod} — {baslangic.ad}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Paket başlığı ve ön koşulları
            </p>
          </div>
        </div>
      </div>

      <PaketFormu baslangic={baslangic} aracTurleri={aracTurleri} markalar={markalar} />
    </div>
  )
}
