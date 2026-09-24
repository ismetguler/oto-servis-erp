"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { transferIptalEt, transferOnayla, transferGeriAl } from "@/app/(panel)/stok/transfer/actions"
import { Button } from "@/components/ui/button"

/** TASLAK fişte Onayla/İptal, ONAYLANDI fişte Geri Al düğmesi — hepsi geri dönüşü zor işlem, kısa bir onay ister. */
export function TransferFisButonlari({
  id,
  durum,
}: {
  id: number
  durum: "TASLAK" | "ONAYLANDI"
}) {
  const [bekliyor, basla] = useTransition()
  const [onayModu, setOnayModu] = useState(false)
  const router = useRouter()

  function onayla() {
    basla(async () => {
      const sonuc = await transferOnayla(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Transfer fişi onaylandı, kartlar hedef depoya taşındı.")
      setOnayModu(false)
      router.refresh()
    })
  }

  function iptalEt() {
    basla(async () => {
      const sonuc = await transferIptalEt(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Transfer fişi iptal edildi.")
      router.refresh()
    })
  }

  function geriAl() {
    basla(async () => {
      const sonuc = await transferGeriAl(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Transfer geri alındı, kartlar kaynak depoya döndü.")
      setOnayModu(false)
      router.refresh()
    })
  }

  if (durum === "ONAYLANDI") {
    if (onayModu) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-muted-foreground">
            Kartlar kaynak depoya geri taşınacak. Emin misin?
          </span>
          <Button variant="ghost" size="sm" disabled={bekliyor} onClick={() => setOnayModu(false)}>
            Vazgeç
          </Button>
          <Button size="sm" disabled={bekliyor} onClick={geriAl}>
            {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Evet, Geri Al
          </Button>
        </div>
      )
    }
    return (
      <Button variant="ghost" size="sm" disabled={bekliyor} onClick={() => setOnayModu(true)}>
        Geri Al
      </Button>
    )
  }

  if (onayModu) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.8125rem] text-muted-foreground">
          Onaylanınca kartlar hedef depoya taşınacak ve fiş kilitlenecek. Emin misin?
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
