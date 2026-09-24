import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { depolariGetir, stokFormVerisi } from "../../veri"
import { tanimSecenekleri } from "@/app/(panel)/ayar/tanim/veri"
import { StokFormu } from "@/components/stok/stok-formu"
import { Button } from "@/components/ui/button"
import { aracKatalogVerisi } from "@/lib/arac-katalog"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Düzenle" }

export default async function StokDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("stok", "duzelt")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const stok = await stokFormVerisi(kayitId)
  if (!stok) notFound()

  // Seçenek listesi karttan SONRA okunuyor: kartta seçili olan depo sonradan
  // pasife alınmış olabilir, listeye onu da katmak için önce mevcut değerin
  // bilinmesi gerekiyor (aynı kalıp diğer pasife alınabilen listelerde de var).
  const [depolar, katalog, ureticiSecenekleri, urunGrubuSecenekleri] = await Promise.all([
    depolariGetir(stok.depoId),
    aracKatalogVerisi(),
    tanimSecenekleri("URETICI"),
    tanimSecenekleri("URUN_GRUBU"),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/stok/${stok.id}`} aria-label="Stok kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">{stok.ad}</h1>
            <p className="font-mono text-[0.8125rem] text-muted-foreground">{stok.kod}</p>
          </div>
        </div>
      </div>

      <StokFormu
        baslangic={stok}
        depolar={depolar}
        katalog={katalog}
        ureticiSecenekleri={ureticiSecenekleri}
        urunGrubuSecenekleri={urunGrubuSecenekleri}
      />
    </div>
  )
}
