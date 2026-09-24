"use client"

import { useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { stokSilmeDurumu } from "@/app/(panel)/stok/actions"
import { Button } from "@/components/ui/button"

/** Silme/geri alma düğmesi — Cari kartındakiyle aynı desen. */
export function StokSilDugmesi({
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
      : `"${ad}" silinsin mi? Kayıt listeden kalkar, geçmişi korunur ve istenirse geri alınabilir.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await stokSilmeDurumu(id, !silinmis)
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
