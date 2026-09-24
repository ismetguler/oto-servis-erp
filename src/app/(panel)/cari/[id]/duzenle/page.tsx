import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { cariFormVerisi, plasiyerleriGetir } from "../../veri"
import { tanimSecenekleri } from "@/app/(panel)/ayar/tanim/veri"
import { CariFormu } from "@/components/cari/cari-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Cari Düzenle" }

export default async function CariDuzenle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mevcut?: string; sekme?: string }>
}) {
  await yetkiliOturum("cari", "duzelt")

  const { id } = await params
  // SA-3.2: yeni cari açılmaya çalışıldı ama aynı VKN/ünvanlı kart zaten
  // vardı → buraya yönlendirildik. Kullanıcı "neden yeni kart açılmadı"
  // diye şaşırmasın diye bilgilendirme bandı.
  const { mevcut, sekme } = await searchParams
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const cari = await cariFormVerisi(kayitId)
  if (!cari) notFound()

  // Seçenek listesi karttan SONRA okunuyor: kartta seçili olan plasiyer
  // sonradan pasife alınmış olabilir, listeye onu da katmak için önce
  // mevcut değerin bilinmesi gerekiyor.
  const [plasiyerler, musteriSiniflari] = await Promise.all([
    plasiyerleriGetir(cari.plasiyerId),
    tanimSecenekleri("MUSTERI_SINIFI"),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/cari/${cari.id}`} aria-label="Cari kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              {cari.unvan}
            </h1>
            <p className="font-mono text-[0.8125rem] text-muted-foreground">
              {cari.kod}
            </p>
          </div>
        </div>
      </div>

      {mevcut ? (
        <div className="mx-4 mt-4 rounded-md border border-uyari/30 bg-uyari-yumusak px-3.5 py-2.5 text-[0.8125rem] text-uyari">
          Bu isimde / vergi numarasında bir cari <strong>zaten kayıtlı</strong> —
          yeni kart açılmadı, mevcut kartın düzenleme ekranına getirildiniz.
        </div>
      ) : null}

      <CariFormu
        baslangic={cari}
        ilkSekme={sekme}
        plasiyerler={plasiyerler}
        musteriSiniflari={musteriSiniflari}
      />
    </div>
  )
}
