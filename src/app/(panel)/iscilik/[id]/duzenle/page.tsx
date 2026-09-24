import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { iscilikBolumleriGetir, iscilikFormVerisi } from "../../veri"
import { IscilikFormu } from "@/components/iscilik/iscilik-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "İşçilik Düzenle" }

export default async function IscilikDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("iscilik", "duzelt")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const [iscilik, bolumler] = await Promise.all([
    iscilikFormVerisi(kayitId),
    iscilikBolumleriGetir(),
  ])
  if (!iscilik) notFound()

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
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">{iscilik.ad}</h1>
            <p className="font-mono text-[0.8125rem] text-muted-foreground">{iscilik.kod}</p>
          </div>
        </div>
      </div>

      <IscilikFormu baslangic={iscilik} bolumler={bolumler} />
    </div>
  )
}
