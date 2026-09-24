"use client"

import { useState } from "react"
import { useActionState } from "react"
import Link from "next/link"
import { Loader2, Save, X } from "lucide-react"

import { kasaKaydet, type KasaFormDurumu } from "@/app/(panel)/kasa/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * KASA KARTI FORMU
 *
 * Banka alanları yalnızca tür BANKA iken, komisyon oranı yalnızca POS iken
 * görünür — boş alanlar ekranı doldurmasın, kullanıcı "burayı da doldurmam
 * gerekiyor mu?" diye düşünmesin.
 */

export type KasaBaslangic = {
  id: number
  kod: string
  ad: string
  tur: "NAKIT" | "BANKA" | "POS"
  paraBirimi: string
  banka: string | null
  bankaSube: string | null
  hesapNo: string | null
  ibanNo: string | null
  posKomisyonOrani: number
  acilisBakiye: number
  notu: string | null
  sira: number
  aktif: boolean
}

export function KasaFormu({ baslangic }: { baslangic?: KasaBaslangic }) {
  const [durum, gonder, bekliyor] = useActionState<KasaFormDurumu, FormData>(kasaKaydet, {})
  const [tur, setTur] = useState(baslangic?.tur ?? "NAKIT")
  const hata = (alan: string) => durum.alanHatalari?.[alan]

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="p-4">
        <div className="panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Alan
              ad="kod"
              etiket="Kasa Kodu"
              hata={hata("kod")}
              ipucu={baslangic ? undefined : "Boş bırakılırsa sıradaki kasa kodu otomatik verilir."}
            >
              <Girdi
                name="kod"
                defaultValue={baslangic?.kod}
                maxLength={30}
                placeholder="otomatik"
                className="font-mono"
              />
            </Alan>

            <Alan ad="ad" etiket="Kasa Adı" zorunlu hata={hata("ad")}>
              <Girdi
                name="ad"
                defaultValue={baslangic?.ad}
                maxLength={120}
                required
                placeholder="Örn: Merkez Nakit Kasa"
              />
            </Alan>

            <Alan ad="tur" etiket="Kasa Türü" zorunlu hata={hata("tur")}>
              <select
                id="tur"
                name="tur"
                value={tur}
                onChange={(e) => setTur(e.target.value as KasaBaslangic["tur"])}
                className={ALAN_SINIFI}
              >
                <option value="NAKIT">Nakit</option>
                <option value="BANKA">Banka</option>
                <option value="POS">POS</option>
              </select>
            </Alan>

            <Alan ad="paraBirimi" etiket="Para Birimi" hata={hata("paraBirimi")}>
              <Girdi
                name="paraBirimi"
                defaultValue={baslangic?.paraBirimi ?? "TRY"}
                maxLength={3}
                className="uppercase"
              />
            </Alan>

            {tur === "BANKA" ? (
              <>
                <Alan ad="banka" etiket="Banka" hata={hata("banka")}>
                  <Girdi name="banka" defaultValue={baslangic?.banka ?? ""} maxLength={80} />
                </Alan>
                <Alan ad="bankaSube" etiket="Şube" hata={hata("bankaSube")}>
                  <Girdi
                    name="bankaSube"
                    defaultValue={baslangic?.bankaSube ?? ""}
                    maxLength={80}
                  />
                </Alan>
                <Alan ad="hesapNo" etiket="Hesap No" hata={hata("hesapNo")}>
                  <Girdi
                    name="hesapNo"
                    defaultValue={baslangic?.hesapNo ?? ""}
                    maxLength={40}
                    className="font-mono"
                  />
                </Alan>
                <Alan ad="ibanNo" etiket="IBAN" hata={hata("ibanNo")}>
                  <Girdi
                    name="ibanNo"
                    defaultValue={baslangic?.ibanNo ?? ""}
                    maxLength={40}
                    className="font-mono uppercase"
                  />
                </Alan>
              </>
            ) : null}

            {tur === "POS" ? (
              <Alan
                ad="posKomisyonOrani"
                etiket="POS Komisyon Oranı (%)"
                hata={hata("posKomisyonOrani")}
                ipucu="Bilgi amaçlı tutulur; komisyon gideri Tahsilat modülünde işlenecek."
              >
                <Girdi
                  name="posKomisyonOrani"
                  defaultValue={baslangic?.posKomisyonOrani ?? 0}
                  inputMode="decimal"
                  className="text-right"
                />
              </Alan>
            ) : null}

            <Alan
              ad="acilisBakiye"
              etiket="Açılış Bakiyesi"
              hata={hata("acilisBakiye")}
              ipucu="Devir tutarı. Kasa defterine 'Açılış' satırı olarak yazılır."
            >
              <Girdi
                name="acilisBakiye"
                defaultValue={baslangic?.acilisBakiye ?? 0}
                inputMode="decimal"
                className="text-right"
              />
            </Alan>

            <Alan ad="sira" etiket="Sıra" hata={hata("sira")}>
              <Girdi
                name="sira"
                defaultValue={baslangic?.sira ?? 0}
                inputMode="numeric"
                className="text-right"
              />
            </Alan>

            <Alan ad="aktif" etiket="Durum">
              <Onay
                name="aktif"
                etiket="Aktif — hareket girilebilsin"
                defaultChecked={baslangic?.aktif ?? true}
              />
            </Alan>

            <Alan ad="notu" etiket="Not" hata={hata("notu")} genis>
              <Metin name="notu" defaultValue={baslangic?.notu ?? ""} rows={2} maxLength={1000} />
            </Alan>
          </div>
        </div>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href={baslangic ? `/kasa/${baslangic.id}` : "/kasa"}>
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

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

function Girdi({ name, className, ...kalan }: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

function Metin({
  name,
  className,
  ...kalan
}: React.ComponentProps<"textarea"> & { name: string }) {
  return (
    <textarea
      id={name}
      name={name}
      className={cn(ALAN_SINIFI, "h-auto resize-y py-1.5", className)}
      {...kalan}
    />
  )
}

function Onay({
  name,
  etiket,
  defaultChecked,
}: {
  name: string
  etiket: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex h-8 items-center gap-2 text-[0.8125rem]">
      <input
        id={name}
        name={name}
        type="checkbox"
        className="size-4 accent-primary"
        defaultChecked={defaultChecked}
      />
      {etiket}
    </label>
  )
}
