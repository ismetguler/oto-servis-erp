import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { iscilikBolumleriGetir } from "../veri"
import { IscilikFormu } from "@/components/iscilik/iscilik-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni İşçilik" }

export default async function YeniIscilik() {
  await yetkiliOturum("iscilik", "ekle")

  const bolumler = await iscilikBolumleriGetir()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/iscilik" aria-label="İşçilik kataloğuna dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Yeni İşçilik Tanımı
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Kabul kartında tek tıkla eklenecek hazır iş kalemi
            </p>
          </div>
        </div>
      </div>

      <IscilikFormu bolumler={bolumler} />
    </div>
  )
}
