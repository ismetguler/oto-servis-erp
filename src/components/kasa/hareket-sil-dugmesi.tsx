"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { kasaHareketiSil } from "@/app/(panel)/kasa/actions"
import { Button } from "@/components/ui/button"

export function HareketSilDugmesi({
  id,
  virman,
  aciklama,
}: {
  id: number
  virman: boolean
  aciklama: string
}) {
  const [bekliyor, basla] = useTransition()

  function tikla() {
    const soru = virman
      ? `Bu virman iptal edilsin mi? Her iki kasadaki satır birlikte silinir.\n\n${aciklama}`
      : `Bu kasa hareketi silinsin mi?\n\n${aciklama}`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await kasaHareketiSil(id)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(sonuc.basarili ?? "Silindi.")
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={tikla}
      disabled={bekliyor}
      title="Sil"
      aria-label="Hareketi sil"
      className="text-tehlike hover:text-tehlike"
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  )
}
