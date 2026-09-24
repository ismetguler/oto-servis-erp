import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { KasaFormu } from "@/components/kasa/kasa-formu"
import { Button } from "@/components/ui/button"
import { sayi } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Kasa Düzenle" }
export const dynamic = "force-dynamic"

export default async function KasaDuzenle({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("tahsilat", "duzelt")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const kasa = await prisma.kasa.findUnique({ where: { id } })
  if (!kasa || kasa.silindi) notFound()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/kasa/${kasa.id}`} aria-label="Kasa kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Kasa Düzenle</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {kasa.kod} — {kasa.ad}
            </p>
          </div>
        </div>
      </div>

      <KasaFormu
        baslangic={{
          id: kasa.id,
          kod: kasa.kod,
          ad: kasa.ad,
          tur: kasa.tur,
          paraBirimi: kasa.paraBirimi,
          banka: kasa.banka,
          bankaSube: kasa.bankaSube,
          hesapNo: kasa.hesapNo,
          ibanNo: kasa.ibanNo,
          posKomisyonOrani: sayi(kasa.posKomisyonOrani),
          acilisBakiye: sayi(kasa.acilisBakiye),
          notu: kasa.notu,
          sira: kasa.sira,
          aktif: kasa.aktif,
        }}
      />
    </div>
  )
}
