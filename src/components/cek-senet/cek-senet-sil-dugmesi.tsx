"use client"

import { useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cekSenetSilmeDurumu } from "@/app/(panel)/cek-senet/actions"
import { Button } from "@/components/ui/button"

export function CekSenetSilDugmesi({
  id,
  silinmis,
  etiket,
}: {
  id: number
  silinmis: boolean
  etiket: string
}) {
  const [bekliyor, basla] = useTransition()

  function tikla() {
    const soru = silinmis
      ? `${etiket} geri alınsın mı? Cari bakiyesine yeniden işlenir.`
      : `${etiket} silinsin mi? Cari bakiyesindeki etkisi kaldırılır.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await cekSenetSilmeDurumu(id, !silinmis)
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
