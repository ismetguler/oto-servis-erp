"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { sayimIptalEt, sayimOnayla } from "@/app/(panel)/stok/sayim/actions"
import { Button } from "@/components/ui/button"

/** TASLAK fişte gösterilen Onayla/İptal Et düğmeleri — ikisi de geri dönüşü olmayan işlem, kısa bir onay istiyor. */
export function SayimFisButonlari({ id }: { id: number }) {
  const [bekliyor, basla] = useTransition()
  const [onayModu, setOnayModu] = useState(false)
  const router = useRouter()

  function onayla() {
    basla(async () => {
      const sonuc = await sayimOnayla(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Sayım fişi onaylandı, fark stok hareketleri işlendi.")
      setOnayModu(false)
      router.refresh()
    })
  }

  function iptalEt() {
    basla(async () => {
      const sonuc = await sayimIptalEt(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Sayım fişi iptal edildi.")
      router.refresh()
    })
  }

  if (onayModu) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.8125rem] text-muted-foreground">
          Onaylanınca fark, stok hareketi olarak işlenecek ve fiş kilitlenecek. Emin misin?
        </span>
        <Button variant="ghost" size="sm" disabled={bekliyor} onClick={() => setOnayModu(false)}>
          Vazgeç
        </Button>
        <Button size="sm" disabled={bekliyor} onClick={onayla}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Evet, Onayla
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" disabled={bekliyor} onClick={iptalEt}>
        İptal Et
      </Button>
      <Button size="sm" disabled={bekliyor} onClick={() => setOnayModu(true)}>
        Onayla ve Uygula
      </Button>
    </div>
  )
}
