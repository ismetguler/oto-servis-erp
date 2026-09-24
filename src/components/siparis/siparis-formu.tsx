"use client"

import { useActionState } from "react"
import { Loader2, Save, X } from "lucide-react"
import Link from "next/link"

import { siparisKaydet, type SiparisFormDurumu } from "@/app/(panel)/siparis/alinan/actions"
import type { SiparisCarisi } from "@/app/(panel)/siparis/alinan/veri"
import { AramaliSecim } from "@/components/aramali-secim"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * ALINAN SİPARİŞ KARTI — üst bilgi formu.
 *
 * Alış faturası kartının (`AlisFormu`) aynası: sipariş no burada YOK — elle
 * girilmiyor, kaydedince otomatik üretiliyor (`actions.ts`). Kalemler bu
 * ekranda YOK — önce kart (TASLAK) kaydedilir, kalemler ayrı ekranda eklenir.
 */
export function SiparisFormu({
  baslangic,
  cariler,
}: {
  baslangic?: {
    id: number
    cariId: number
    tarih: string
    teslimTarihi: string
    aciklama: string
  }
  cariler: SiparisCarisi[]
}) {
  const [durum, gonder, bekliyor] = useActionState<SiparisFormDurumu, FormData>(siparisKaydet, {})
  const hata = (alan: string) => durum.alanHatalari?.[alan]
  const bugun = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col gap-4">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}

      {durum.hata ? (
        <div className="rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Alan ad="cariId" etiket="Müşteri (cari)" zorunlu hata={hata("cariId")}>
<AramaliSecim
            name="cariId"
            defaultValue={baslangic?.cariId ? String(baslangic.cariId) : ""}
            placeholder="Müşteri ara — ünvan veya kod…"
            secenekler={cariler.map((c) => ({ value: String(c.id), etiket: c.unvan, aciklama: c.kod }))}
          />
        </Alan>

        <Alan ad="tarih" etiket="Tarih">
          <Girdi name="tarih" type="date" defaultValue={baslangic?.tarih ?? bugun} />
        </Alan>

        <Alan ad="teslimTarihi" etiket="Teslim Tarihi" hata={hata("teslimTarihi")}>
          <Girdi name="teslimTarihi" type="date" defaultValue={baslangic?.teslimTarihi ?? ""} />
        </Alan>

        <Alan ad="aciklama" etiket="Açıklama" genis>
          <Girdi name="aciklama" defaultValue={baslangic?.aciklama ?? ""} />
        </Alan>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/siparis/alinan">
            <X className="size-4" />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  genis,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
      {children}
      {hata ? <p className="text-[0.75rem] text-tehlike">{hata}</p> : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

function Girdi({ name, className, ...kalan }: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

