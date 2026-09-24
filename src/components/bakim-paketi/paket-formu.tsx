"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Loader2, Save, X } from "lucide-react"

import { paketKaydet, type PaketFormDurumu } from "@/app/(panel)/servis/bakim-paketi/actions"
import { ListeVeyaYaz } from "@/components/liste-veya-yaz"
import { Button } from "@/components/ui/button"
import { TanimEkleTusu } from "@/components/ui/tanim-ekle-tusu"
import { formGonderimi } from "@/lib/form-gonderim"
import { useTanimDonusu } from "@/lib/kullan-tanim-donusu"
import { cn } from "@/lib/utils"

/**
 * BAKIM PAKETİ BAŞLIK FORMU
 *
 * Sadece paketin kimliği ve ön koşulları burada; satırlar paket kartında
 * yönetiliyor. Selpar'da da paket önce açılıp sonra doldurulur — satır
 * formunu aynı sayfaya koymak, kaydedilmemiş paket için satır tutmayı
 * (ve yarım kalan kayıt riskini) gerektirirdi.
 */

export type PaketBaslangic = {
  id: number
  kod: string
  ad: string
  aciklama: string | null
  aracTuru: string | null
  marka: string | null
  km: number | null
  aktif: boolean
}

export function PaketFormu({
  baslangic,
  aracTurleri,
  markalar,
}: {
  baslangic?: PaketBaslangic
  aracTurleri: string[]
  markalar: string[]
}) {
  const [durum, gonder, bekliyor] = useActionState<PaketFormDurumu, FormData>(paketKaydet, {})
  const hata = (alan: string) => durum.alanHatalari?.[alan]
  const aracTuruDonus = useTanimDonusu("aracTuru")
  const markaDonus = useTanimDonusu("marka")

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
              etiket="Paket Kodu"
              hata={hata("kod")}
              ipucu={baslangic ? undefined : "Boş bırakılırsa otomatik üretilir (BP0001)."}
            >
              <Girdi
                name="kod"
                defaultValue={baslangic?.kod}
                maxLength={30}
                placeholder="otomatik"
                className="font-mono"
              />
            </Alan>

            <Alan ad="ad" etiket="Paket Adı" zorunlu hata={hata("ad")}>
              <Girdi
                name="ad"
                defaultValue={baslangic?.ad}
                maxLength={200}
                required
                placeholder="Örn: 20.000 km periyodik bakım"
              />
            </Alan>

            <Alan
              ad="km"
              etiket="Bakım Km'si"
              hata={hata("km")}
              ipucu="Bilgi amaçlı; paketi uygulamayı engellemez."
            >
              <Girdi
                name="km"
                defaultValue={baslangic?.km ?? ""}
                inputMode="numeric"
                className="text-right"
                placeholder="20000"
              />
            </Alan>

            <Alan
              ad="aracTuru"
              etiket="Araç Türü"
              hata={hata("aracTuru")}
              yanTus={
                <TanimEkleTusu
                  hedefYol="/ayar/tanim?tur=ARAC_TURU"
                  alan="aracTuru"
                  baslik="Araç Türü"
                />
              }
            >
              <ListeVeyaYaz
                key={aracTuruDonus ?? "sabit"}
                name="aracTuru"
                secenekler={aracTurleri}
                defaultValue={aracTuruDonus ?? baslangic?.aracTuru ?? ""}
                maxLength={60}
                placeholder="Tümü"
              />
            </Alan>

            <Alan
              ad="marka"
              etiket="Marka"
              hata={hata("marka")}
              yanTus={
                <TanimEkleTusu
                  hedefYol="/ayar/tanim?tur=ARAC_MARKA"
                  alan="marka"
                  baslik="Araç Markası"
                />
              }
            >
              <ListeVeyaYaz
                key={markaDonus ?? "sabit"}
                name="marka"
                secenekler={markalar}
                defaultValue={markaDonus ?? baslangic?.marka ?? ""}
                maxLength={60}
                placeholder="Tümü"
              />
            </Alan>

            <Alan ad="aktif" etiket="Durum">
              <Onay
                name="aktif"
                etiket="Aktif — kabul kartında seçilebilsin"
                defaultChecked={baslangic?.aktif ?? true}
              />
            </Alan>

            <Alan ad="aciklama" etiket="Açıklama" hata={hata("aciklama")} genis>
              <Metin
                name="aciklama"
                defaultValue={baslangic?.aciklama ?? ""}
                rows={3}
                maxLength={1000}
                placeholder="Paketin kapsamı, müşteriye anlatılacaklar…"
              />
            </Alan>
          </div>
        </div>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href={baslangic ? `/servis/bakim-paketi/${baslangic.id}` : "/servis/bakim-paketi"}>
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

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  ipucu,
  genis,
  yanTus,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  /** Etiketin sağında duran küçük eylem (ör. "+ Yeni"). */
  yanTus?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
          {etiket}
        </label>
        {yanTus}
      </div>
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

function Girdi({
  name,
  className,
  ...kalan
}: React.ComponentProps<"input"> & { name: string }) {
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
