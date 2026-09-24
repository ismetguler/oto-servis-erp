import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { cariFormVerisi, plasiyerleriGetir } from "../../../cari/veri"
import { tanimSecenekleri } from "@/app/(panel)/ayar/tanim/veri"
import { CariFormu } from "@/components/cari/cari-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Personel Düzenle" }

export default async function PersonelDuzenle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mevcut?: string }>
}) {
  await yetkiliOturum("cari", "duzelt")

  const { id } = await params
  // SA-3.2: aynı VKN'li kayıt zaten vardı → yeni kart açılmadı, buraya yönlendirildi.
  const { mevcut } = await searchParams
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const personel = await cariFormVerisi(kayitId)
  // Türü personel olmayan bir kart bu ekrandan düzenlenmiyor: adres
  // çubuğuna elle id yazıp müşteri kartını personel formunda açmak,
  // kaydederken kartı sessizce personele çevirirdi.
  if (!personel || personel.turu !== "PERSONEL") notFound()

  const [plasiyerler, musteriSiniflari] = await Promise.all([
    plasiyerleriGetir(personel.plasiyerId),
    tanimSecenekleri("MUSTERI_SINIFI"),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/personel/${personel.id}`} aria-label="Personel kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              {personel.unvan}
            </h1>
            <p className="font-mono text-[0.8125rem] text-muted-foreground">
              {personel.kod}
            </p>
          </div>
        </div>
      </div>

      {mevcut ? (
        <div className="mx-4 mt-4 rounded-md border border-uyari/30 bg-uyari-yumusak px-3.5 py-2.5 text-[0.8125rem] text-uyari">
          Bu vergi numarasında bir kayıt <strong>zaten var</strong> — yeni kart
          açılmadı, mevcut kartın düzenleme ekranına getirildiniz.
        </div>
      ) : null}

      <CariFormu
        baslangic={personel}
        plasiyerler={plasiyerler}
        musteriSiniflari={musteriSiniflari}
      />
    </div>
  )
}
