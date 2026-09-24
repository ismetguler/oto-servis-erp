import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { tanimAdlari } from "../tanimlar"
import { PaketFormu } from "@/components/bakim-paketi/paket-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Bakım Paketi" }
export const dynamic = "force-dynamic"

export default async function YeniBakimPaketi() {
  await yetkiliOturum("kabul", "ekle")

  const [aracTurleri, markalar] = await Promise.all([
    tanimAdlari("ARAC_TURU"),
    tanimAdlari("ARAC_MARKA"),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/servis/bakim-paketi" aria-label="Paket listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Yeni Bakım Paketi</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Önce paketi açın, sonra parça ve işçilik satırlarını ekleyin
            </p>
          </div>
        </div>
      </div>

      <PaketFormu aracTurleri={aracTurleri} markalar={markalar} />
    </div>
  )
}
