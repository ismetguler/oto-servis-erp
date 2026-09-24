import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { plasiyerleriGetir } from "../../cari/veri"
import { tanimSecenekleri } from "@/app/(panel)/ayar/tanim/veri"
import { CariFormu } from "@/components/cari/cari-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Personel" }

/**
 * Personel kartı cari formunun ta kendisi; yalnızca türü PERSONEL seçili
 * geliyor ve o zaman "Personel Bilgileri" sekmesi açılıyor. İkinci bir form
 * yazmak, aynı 7 adımlı kayıt akışını (numaratör, açılış hareketi, log)
 * ikinci kez sürdürmek anlamına gelirdi.
 */
export default async function YeniPersonel() {
  await yetkiliOturum("cari", "ekle")

  const [plasiyerler, musteriSiniflari] = await Promise.all([
    plasiyerleriGetir(),
    tanimSecenekleri("MUSTERI_SINIFI"),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/personel" aria-label="Personel listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Yeni Personel Kartı
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Usta, danışman veya diğer çalışan kaydı açın
            </p>
          </div>
        </div>
      </div>

      <CariFormu
        plasiyerler={plasiyerler}
        musteriSiniflari={musteriSiniflari}
        varsayilanTur="PERSONEL"
      />
    </div>
  )
}
