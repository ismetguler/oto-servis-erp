"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { siparisIptalEt, siparisOnayla, siparisSil } from "@/app/(panel)/siparis/alinan/actions"
import { Button } from "@/components/ui/button"

/**
 * TASLAK'ta Onayla/Sil, ONAYLANDI'de İptal Et düğmesi — evrak modülündeki
 * `AlisButonlari`nın aynası. Fark: onaylayınca stok/cari hareketi doğmuyor
 * (sipariş faturaya dönüşünce doğacak, adım 9.7) — metinler buna göre.
 */
export function SiparisButonlari({
  id,
  durum,
}: {
  id: number
  durum: "TASLAK" | "ONAYLANDI" | "KISMI_SEVK" | "TAMAMLANDI" | "IPTAL"
}) {
  const [bekliyor, basla] = useTransition()
  const [onayModu, setOnayModu] = useState(false)
  const router = useRouter()

  function onayla() {
    basla(async () => {
      const sonuc = await siparisOnayla(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Sipariş onaylandı, satırlar kilitlendi.")
      setOnayModu(false)
      router.refresh()
    })
  }

  function iptalEt() {
    basla(async () => {
      const sonuc = await siparisIptalEt(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Sipariş iptal edildi.")
      setOnayModu(false)
      router.refresh()
    })
  }

  function sil() {
    basla(async () => {
      const sonuc = await siparisSil(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Sipariş silindi.")
      router.push("/siparis/alinan")
    })
  }

  if (durum === "IPTAL") {
    return (
      <Button variant="ghost" size="sm" disabled={bekliyor} onClick={sil}>
        Sil
      </Button>
    )
  }

  if (durum === "TAMAMLANDI") return null

  if (durum === "ONAYLANDI" || durum === "KISMI_SEVK") {
    if (onayModu) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-muted-foreground">Sipariş iptal edilecek. Emin misin?</span>
          <Button variant="ghost" size="sm" disabled={bekliyor} onClick={() => setOnayModu(false)}>
            Vazgeç
          </Button>
          <Button size="sm" disabled={bekliyor} onClick={iptalEt}>
            {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Evet, İptal Et
          </Button>
        </div>
      )
    }
    return (
      <Button variant="ghost" size="sm" disabled={bekliyor} onClick={() => setOnayModu(true)}>
        İptal Et
      </Button>
    )
  }

  // TASLAK
  if (onayModu) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.8125rem] text-muted-foreground">
          Onaylanınca satırlar kilitlenecek, sevkiyat/bakiye takibi başlayacak. Emin misin?
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
      <Button variant="ghost" size="sm" disabled={bekliyor} onClick={sil}>
        Sil
      </Button>
      <Button size="sm" disabled={bekliyor} onClick={() => setOnayModu(true)}>
        Onayla
      </Button>
    </div>
  )
}
