import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { tahsilatGetir, TUR_ADI } from "../../veri"
import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import { TahsilatFormu } from "@/components/tahsilat/tahsilat-formu"
import { Button } from "@/components/ui/button"
import { sayi } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Fiş Düzenle" }
export const dynamic = "force-dynamic"

export default async function TahsilatDuzenle({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("tahsilat", "duzelt")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const fis = await tahsilatGetir(id)
  if (!fis || fis.silindi) notFound()

  const kasalar = await secilebilirKasalar()
  const g = fis.tarih
  const gunMetni = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/tahsilat/${fis.id}`} aria-label="Fişe dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              {TUR_ADI[fis.tur]} Fişi Düzenle
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              <span className="font-mono">{fis.fisNo}</span> · değişiklik cari ve kasa
              bakiyesine anında yansır
            </p>
          </div>
        </div>
      </div>

      <TahsilatFormu
        tur={fis.tur}
        kasalar={kasalar}
        baslangic={{
          id: fis.id,
          fisNo: fis.fisNo,
          tur: fis.tur,
          cari: {
            id: fis.cari.id,
            kod: fis.cari.kod,
            unvan: fis.cari.unvan,
            bakiye: sayi(fis.cari.bakiye),
            karaListe: fis.cari.karaListe,
            karaListeNedeni: fis.cari.karaListeNedeni,
          },
          tarih: gunMetni(g),
          tutar: sayi(fis.tutar),
          odemeSekli: fis.odemeSekli,
          kasaId: fis.kasaId,
          kabulId: fis.kabulId,
          aciklama: fis.aciklama,
          posBanka: fis.posBanka,
          posKartSahibi: fis.posKartSahibi,
          posSon4: fis.posSon4,
          posProvizyon: fis.posProvizyon,
          posTaksit: fis.posTaksit,
          kagit:
            fis.cekSenet && !fis.cekSenet.silindi
              ? {
                  id: fis.cekSenet.id,
                  portfoyNo: fis.cekSenet.portfoyNo,
                  vadeTarihi: gunMetni(fis.cekSenet.vadeTarihi),
                  belgeNo: fis.cekSenet.belgeNo,
                  banka: fis.cekSenet.banka,
                  borclu: fis.cekSenet.borclu,
                  durum: fis.cekSenet.durum,
                }
              : null,
        }}
      />
    </div>
  )
}
