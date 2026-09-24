"use client"

import { useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { aracSilmeDurumu } from "@/app/(panel)/arac/actions"
import { Button } from "@/components/ui/button"

export function AracSilDugmesi({
  id,
  silinmis,
  plaka,
}: {
  id: number
  silinmis: boolean
  plaka: string
}) {
  const [bekliyor, basla] = useTransition()

  function tikla() {
    const soru = silinmis
      ? `"${plaka}" kaydı geri alınsın mı?`
      : `"${plaka}" silinsin mi? Kayıt listeden kalkar, geçmişi korunur ve istenirse geri alınabilir.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await aracSilmeDurumu(id, !silinmis)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(silinmis ? "Kayıt geri alındı." : "Kayıt silindi.")
    })
  }

  return (
    <Button
      variant={silinmis ? "outline" : "ghost"}
      size="sm"
      onClick={tikla}
      disabled={bekliyor}
      className={silinmis ? undefined : "text-tehlike hover:text-tehlike"}
    >
      {silinmis ? (
        <RotateCcw className="size-4" aria-hidden />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
      {silinmis ? "Geri Al" : "Sil"}
    </Button>
  )
}
