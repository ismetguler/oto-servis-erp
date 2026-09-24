"use client"

import { useActionState } from "react"
import { Loader2, Save, X } from "lucide-react"
import Link from "next/link"

import { evrakKaydet, type EvrakFormDurumu } from "@/app/(panel)/evrak/alis/actions"
import type { AlisCarisi } from "@/app/(panel)/evrak/alis/veri"
import { AramaliSecim } from "@/components/aramali-secim"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * ALIŞ FATURASI KARTI — üst bilgi formu.
 *
 * Satış faturasının `EvrakFormu`sunun sadesi: kabulden dönüştürme kipi yok
 * (o yalnız satış/servis tarafına özgü). Kalemler bu ekranda YOK — önce kart
 * (TASLAK) kaydedilir, kalemler ayrı ekranda (`/evrak/alis/[id]`) eklenir.
 */
export function AlisFormu({
  baslangic,
  cariler,
  iade,
}: {
  baslangic?: {
    id: number
    evrakNo: string
    cariId: number
    tarih: string
    vadeTarihi: string
    aciklama: string
    kaynakEvrakNo?: string
    irsaliyeNo?: string
    irsaliyeTarihi?: string
    tasiyiciPlaka?: string
    sevkAdresi?: string
    tevkifatKodu?: string
    tevkifatOrani?: string
  }
  cariler: AlisCarisi[]
  /** Düzenlenen kayıt zaten İade Faturası ise (adım 11.8) — tür değiştirilemez, sadece bilgi. */
  iade?: boolean
}) {
  const [durum, gonder, bekliyor] = useActionState<EvrakFormDurumu, FormData>(evrakKaydet, {})
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
        <Alan ad="evrakNo" etiket="Fatura No" zorunlu hata={hata("evrakNo")} ipucu="Elle girilir">
          <Girdi name="evrakNo" defaultValue={baslangic?.evrakNo ?? ""} placeholder="örn. AF2026-00001" />
        </Alan>

        <Alan ad="cariId" etiket="Tedarikçi (cari)" zorunlu hata={hata("cariId")}>
<AramaliSecim
            name="cariId"
            defaultValue={baslangic?.cariId ? String(baslangic.cariId) : ""}
            placeholder="Tedarikçi ara — ünvan veya kod…"
            secenekler={cariler.map((c) => ({ value: String(c.id), etiket: c.unvan, aciklama: c.kod }))}
          />
        </Alan>

        <Alan ad="tarih" etiket="Tarih">
          <Girdi name="tarih" type="date" defaultValue={baslangic?.tarih ?? bugun} />
        </Alan>

        <Alan ad="vadeTarihi" etiket="Vade Tarihi" hata={hata("vadeTarihi")}>
          <Girdi name="vadeTarihi" type="date" defaultValue={baslangic?.vadeTarihi ?? ""} />
        </Alan>

        <Alan ad="aciklama" etiket="Açıklama" genis>
          <Girdi name="aciklama" defaultValue={baslangic?.aciklama ?? ""} />
        </Alan>
      </div>

      {/* Adım 11.8: baskı şablonlarını besleyen elle-girilen alanlar (satış
          faturasındaki `EvrakFormu` bölümünün aynısı). */}
      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-[0.75rem] font-medium text-muted-foreground">
          İrsaliye / Tevkifat / İade Bilgileri (opsiyonel)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!baslangic ? (
            <Alan ad="iade" etiket="Fatura Türü" ipucu="İşaretlenirse İade Faturası olarak kaydedilir">
              <label className="flex h-8 items-center gap-2 text-[0.8125rem]">
                <input type="checkbox" name="iade" className="size-4" />
                Bu bir İade Faturası
              </label>
            </Alan>
          ) : iade ? (
            <Alan ad="iadeBilgi" etiket="Fatura Türü">
              <div className="flex h-8 items-center text-[0.8125rem] font-medium text-tehlike">
                İade Faturası
              </div>
            </Alan>
          ) : null}

          <Alan ad="kaynakEvrakNo" etiket="Kaynak Evrak No" ipucu="İade ise hangi faturaya istinaden">
            <Girdi name="kaynakEvrakNo" defaultValue={baslangic?.kaynakEvrakNo ?? ""} />
          </Alan>

          <Alan ad="irsaliyeNo" etiket="İrsaliye No">
            <Girdi name="irsaliyeNo" defaultValue={baslangic?.irsaliyeNo ?? ""} />
          </Alan>

          <Alan ad="irsaliyeTarihi" etiket="İrsaliye Tarihi" hata={hata("irsaliyeTarihi")}>
            <Girdi name="irsaliyeTarihi" type="date" defaultValue={baslangic?.irsaliyeTarihi ?? ""} />
          </Alan>

          <Alan ad="tasiyiciPlaka" etiket="Taşıyıcı / Araç Plakası">
            <Girdi name="tasiyiciPlaka" defaultValue={baslangic?.tasiyiciPlaka ?? ""} />
          </Alan>

          <Alan ad="sevkAdresi" etiket="Sevk Adresi" genis>
            <Girdi name="sevkAdresi" defaultValue={baslangic?.sevkAdresi ?? ""} />
          </Alan>

          <Alan ad="tevkifatKodu" etiket="Tevkifat Kodu">
            <Girdi name="tevkifatKodu" defaultValue={baslangic?.tevkifatKodu ?? ""} placeholder="örn. 601" />
          </Alan>

          <Alan ad="tevkifatOrani" etiket="Tevkifat Oranı (%)" hata={hata("tevkifatOrani")}>
            <Girdi name="tevkifatOrani" defaultValue={baslangic?.tevkifatOrani ?? ""} inputMode="decimal" />
          </Alan>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/evrak/alis">
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
  ipucu,
  genis,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
      {children}
      {hata ? (
        <p className="text-[0.75rem] text-tehlike">{hata}</p>
      ) : ipucu ? (
        <p className="text-[0.6875rem] text-muted-foreground">{ipucu}</p>
      ) : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

function Girdi({ name, className, ...kalan }: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

