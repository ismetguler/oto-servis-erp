"use client"

import { useActionState, useEffect, useState } from "react"
import { Check, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { cekSenetOnayla, type CekSenetFormDurumu } from "@/app/(panel)/cek-senet/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"

/**
 * ONAY / RET
 *
 * Not alanı ret için zorunlu değil ama teşvik ediliyor: "neden reddedildi"
 * sorusu bir hafta sonra kimsenin aklında kalmıyor.
 */
export function OnayDugmeleri({
  id,
  mevcutDurum,
  kompakt,
}: {
  id: number
  mevcutDurum: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI"
  kompakt?: boolean
}) {
  const [durum, gonder, bekliyor] = useActionState<CekSenetFormDurumu, FormData>(
    cekSenetOnayla,
    {}
  )
  const [karar, setKarar] = useState<"ONAYLANDI" | "REDDEDILDI" | null>(null)

  // setState effect gövdesinde senkron çağrılmıyor (cascading render uyarısı).
  useEffect(() => {
    if (durum.basarili) {
      toast.success(durum.basarili)
      const zamanlayici = setTimeout(() => setKarar(null), 0)
      return () => clearTimeout(zamanlayici)
    } else if (durum.hata) {
      toast.error(durum.hata)
    }
  }, [durum])

  if (karar) {
    return (
      <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="karar" value={karar} />
        <input
          name="onayNotu"
          maxLength={300}
          autoFocus
          placeholder={karar === "ONAYLANDI" ? "Not (isteğe bağlı)" : "Ret nedeni"}
          className="h-8 min-w-[12rem] max-md:min-w-0 flex-1 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {bekliyor ? "İşleniyor…" : karar === "ONAYLANDI" ? "Onayla" : "Reddet"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setKarar(null)}>
          Vazgeç
        </Button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {mevcutDurum !== "ONAYLANDI" ? (
        <Button size={kompakt ? "sm" : "sm"} onClick={() => setKarar("ONAYLANDI")}>
          <Check className="size-4" aria-hidden />
          Onayla
        </Button>
      ) : null}
      {mevcutDurum !== "REDDEDILDI" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setKarar("REDDEDILDI")}
          className="border-tehlike/40 text-tehlike hover:text-tehlike"
        >
          <X className="size-4" aria-hidden />
          Reddet
        </Button>
      ) : null}
    </div>
  )
}
