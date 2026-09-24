"use client"

import { useTransition } from "react"
import { RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cariSilmeDurumu } from "@/app/(panel)/cari/actions"
import { Button } from "@/components/ui/button"

/**
 * Silme/geri alma düğmesi.
 *
 * Onay kutusu var: cari kartı silmek fatura ve kabul geçmişini de görünmez
 * kılar, yanlışlıkla tıklanacak bir işlem değil. Sunucudan gelen hata
 * (örn. bakiyesi olan cari) kullanıcıya bildirim olarak gösterilir.
 */
export function CariSilDugmesi({
  id,
  silinmis,
  unvan,
}: {
  id: number
  silinmis: boolean
  unvan: string
}) {
  const [bekliyor, basla] = useTransition()

  function tikla() {
    const soru = silinmis
      ? `"${unvan}" kaydı geri alınsın mı?`
      : `"${unvan}" silinsin mi? Kayıt listeden kalkar, geçmişi korunur ve istenirse geri alınabilir.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await cariSilmeDurumu(id, !silinmis)
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
