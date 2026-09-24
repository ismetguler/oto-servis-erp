"use client"

import { useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { kasaSilmeDurumu } from "@/app/(panel)/kasa/actions"
import { Button } from "@/components/ui/button"

export function KasaSilDugmesi({
  id,
  silinmis,
  ad,
}: {
  id: number
  silinmis: boolean
  ad: string
}) {
  const [bekliyor, basla] = useTransition()

  function tikla() {
    const soru = silinmis
      ? `"${ad}" kasası geri alınsın mı?`
      : `"${ad}" kasası silinsin mi? Hareketi olan kasa silinemez.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await kasaSilmeDurumu(id, !silinmis)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(sonuc.basarili ?? "Tamam.")
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={tikla}
      disabled={bekliyor}
      title={silinmis ? "Geri al" : "Sil"}
      aria-label={silinmis ? "Geri al" : "Sil"}
      className={silinmis ? undefined : "text-tehlike hover:text-tehlike"}
    >
      {silinmis ? (
        <RotateCcw className="size-4" aria-hidden />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
    </Button>
  )
}
