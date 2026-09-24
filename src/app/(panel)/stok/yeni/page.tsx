import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { depolariGetir } from "../veri"
import { tanimSecenekleri } from "@/app/(panel)/ayar/tanim/veri"
import { StokFormu } from "@/components/stok/stok-formu"
import { Button } from "@/components/ui/button"
import { aracKatalogVerisi } from "@/lib/arac-katalog"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Stok Kartı" }

export default async function YeniStok() {
  await yetkiliOturum("stok", "ekle")

  const [depolar, katalog, ureticiSecenekleri, urunGrubuSecenekleri] = await Promise.all([
    depolariGetir(),
    aracKatalogVerisi(),
    tanimSecenekleri("URETICI"),
    tanimSecenekleri("URUN_GRUBU"),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stok" aria-label="Stok listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Yeni Stok Kartı
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Parça, hizmet veya araca özel parça kaydı açın
            </p>
          </div>
        </div>
      </div>

      <StokFormu
        depolar={depolar}
        katalog={katalog}
        ureticiSecenekleri={ureticiSecenekleri}
        urunGrubuSecenekleri={urunGrubuSecenekleri}
      />
    </div>
  )
}
