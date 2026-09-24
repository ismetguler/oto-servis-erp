import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { girisDepolariGetir } from "../veri"
import { GirisFormu } from "@/components/stok/giris-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Stok Girişi" }

export default async function YeniStokGirisi() {
  await yetkiliOturum("stok", "ekle")
  const depolar = await girisDepolariGetir()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stok/giris" aria-label="Stok girişi listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Yeni Stok Girişi</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Mevcut ürünü barkot/koddan seçin, miktar ve alış fiyatını girin
            </p>
          </div>
        </div>
      </div>

      <GirisFormu depolar={depolar} />
    </div>
  )
}
