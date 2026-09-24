"use client"

import { useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { iscilikSilmeDurumu } from "@/app/(panel)/iscilik/actions"
import { Button } from "@/components/ui/button"

export function IscilikSilDugmesi({
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
      ? `"${ad}" kaydı geri alınsın mı?`
      : `"${ad}" silinsin mi? Katalogdan kalkar, geçmiş iş emirleri korunur ve istenirse geri alınabilir.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await iscilikSilmeDurumu(id, !silinmis)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(silinmis ? "Kayıt geri alındı." : "Kayıt silindi.")
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
