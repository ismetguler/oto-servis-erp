"use client"

import { useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { paketSilmeDurumu } from "@/app/(panel)/servis/bakim-paketi/actions"
import { Button } from "@/components/ui/button"

export function PaketSilDugmesi({
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
      ? `"${ad}" paketi geri alınsın mı?`
      : `"${ad}" paketi silinsin mi? Kabul ekranından kalkar, daha önce uygulandığı kartlar etkilenmez.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await paketSilmeDurumu(id, !silinmis)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(silinmis ? "Paket geri alındı." : "Paket silindi.")
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
