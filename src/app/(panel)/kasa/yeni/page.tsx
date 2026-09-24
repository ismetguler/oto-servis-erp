import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { KasaFormu } from "@/components/kasa/kasa-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Kasa" }
export const dynamic = "force-dynamic"

export default async function YeniKasa() {
  await yetkiliOturum("tahsilat", "ekle")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/kasa" aria-label="Kasa listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Yeni Kasa</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Nakit, banka veya POS kasası tanımlayın
            </p>
          </div>
        </div>
      </div>

      <KasaFormu />
    </div>
  )
}
