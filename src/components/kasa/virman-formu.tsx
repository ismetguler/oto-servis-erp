"use client"

import { useActionState, useEffect, useRef } from "react"
import { ArrowRight, Loader2, Repeat } from "lucide-react"
import { toast } from "sonner"

import { virmanYap, type KasaFormDurumu } from "@/app/(panel)/kasa/actions"
import type { KasaSecenegi } from "@/components/kasa/hareket-formu"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * VİRMAN — kasalar arası aktarım
 *
 * Tek formdan iki satır üretiliyor (çıkan kasada çıkış, giren kasada giriş).
 * Kullanıcı açısından "para taşıma" tek işlem; defterde iki kasa da kendi
 * içinde tutarlı kalıyor.
 */
export function VirmanFormu({ kasalar }: { kasalar: KasaSecenegi[] }) {
  const [durum, gonder, bekliyor] = useActionState<KasaFormDurumu, FormData>(virmanYap, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (durum.basarili) {
      toast.success(durum.basarili)
      formRef.current?.reset()
    } else if (durum.hata) {
      toast.error(durum.hata)
    }
  }, [durum])

  const hata = (alan: string) => durum.alanHatalari?.[alan]
  const bugun = new Date()
  const varsayilanTarih = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, "0")}-${String(bugun.getDate()).padStart(2, "0")}`

  if (kasalar.length < 2) {
    return (
      <div className="panel p-6 text-center text-[0.8125rem] text-muted-foreground">
        Virman için en az iki aktif kasa gerekir.
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={(olay) => formGonderimi(olay, gonder)} className="panel p-4">
      {/* Bloklayan iş kuralı hataları (yetersiz bakiye, pasif kasa, farklı para
          birimi) yalnız toast'la gösteriliyordu; toast kaybolunca kullanıcı
          nedenini göremiyordu. Kalıcı bir uyarı bandı ekli. */}
      {durum.hata ? (
        <p className="mb-3 rounded-sm border border-tehlike/40 bg-tehlike/10 px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </p>
      ) : null}

      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Alan ad="kaynakKasaId" etiket="Çıkış Kasası" zorunlu hata={hata("kaynakKasaId")}>
          <select
            id="kaynakKasaId"
            name="kaynakKasaId"
            defaultValue={kasalar[0]?.id}
            className={ALAN_SINIFI}
            required
          >
            {kasalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kod} — {k.ad} ({para(k.bakiye)})
              </option>
            ))}
          </select>
        </Alan>

        <div className="flex h-8 items-center justify-center text-muted-foreground">
          <ArrowRight className="size-5" aria-hidden />
        </div>

        <Alan ad="hedefKasaId" etiket="Giriş Kasası" zorunlu hata={hata("hedefKasaId")}>
          <select
            id="hedefKasaId"
            name="hedefKasaId"
            defaultValue={kasalar[1]?.id}
            className={ALAN_SINIFI}
            required
          >
            {kasalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kod} — {k.ad} ({para(k.bakiye)})
              </option>
            ))}
          </select>
        </Alan>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Alan ad="tarih" etiket="Tarih" zorunlu hata={hata("tarih")}>
          <input
            id="tarih"
            name="tarih"
            type="date"
            defaultValue={varsayilanTarih}
            className={ALAN_SINIFI}
            required
          />
        </Alan>

        <Alan ad="tutar" etiket="Tutar" zorunlu hata={hata("tutar")}>
          <input
            id="tutar"
            name="tutar"
            inputMode="decimal"
            placeholder="0,00"
            className={cn(ALAN_SINIFI, "text-right font-mono text-[0.9375rem]")}
            required
          />
        </Alan>

        <Alan ad="aciklama" etiket="Açıklama" hata={hata("aciklama")}>
          <input
            id="aciklama"
            name="aciklama"
            maxLength={300}
            placeholder="Boş bırakılırsa otomatik yazılır"
            className={ALAN_SINIFI}
          />
        </Alan>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Repeat className="size-4" aria-hidden />
          )}
          Virmanı Uygula
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
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  children: React.ReactNode
}) {
  return (
    <div className="form-alani">
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
      {children}
      {hata ? <p className="text-[0.75rem] text-tehlike">{hata}</p> : null}
    </div>
  )
}
