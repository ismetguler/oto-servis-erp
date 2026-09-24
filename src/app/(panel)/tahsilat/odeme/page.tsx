import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { hazirCariGetir } from "../veri"
import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import { TahsilatFormu } from "@/components/tahsilat/tahsilat-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Ödeme Girişi" }
export const dynamic = "force-dynamic"

/**
 * Ödeme (tediye) girişi. Tahsilatla aynı formu kullanır, yalnız yön ters:
 * ayrı bir ekran açmak yerine `tur` sabitlenmiş hâli gösteriliyor — iki
 * ayrı form olsaydı bir tarafa eklenen alan diğerine unutulurdu.
 */
export default async function OdemeGirisi({
  searchParams,
}: {
  searchParams: Promise<{ cari?: string }>
}) {
  await yetkiliOturum("tahsilat", "ekle")
  const p = await searchParams

  const [kasalar, hazirCari] = await Promise.all([
    secilebilirKasalar(),
    hazirCariGetir(p.cari ? Number(p.cari) : undefined),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/tahsilat" aria-label="Listeye dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Ödeme Girişi</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Cariye yapılan ödeme (tediye) — cari alacağı azalır, kasadan çıkış düşer
            </p>
          </div>
        </div>
      </div>

      <TahsilatFormu tur="TEDIYE" kasalar={kasalar} hazirCari={hazirCari} />
    </div>
  )
}
