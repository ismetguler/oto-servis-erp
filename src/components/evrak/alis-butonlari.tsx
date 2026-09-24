"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { evrakIptalEt, evrakKesinlestir, evrakSil } from "@/app/(panel)/evrak/alis/actions"
import { Button } from "@/components/ui/button"

/**
 * TASLAK'ta Kesinleştir/Sil, KESILDI'de İptal Et düğmesi — satış faturasındaki
 * `EvrakButonlari`nın aynası, metinler alış tarafına uyarlandı (stok artar,
 * tedarikçiye borçlanılır).
 */
export function AlisButonlari({
  id,
  durum,
  iade = false,
}: {
  id: number
  durum: "TASLAK" | "KESILDI" | "IPTAL"
  iade?: boolean
}) {
  const [bekliyor, basla] = useTransition()
  const [onayModu, setOnayModu] = useState(false)
  const router = useRouter()

  function kesinlestir() {
    basla(async () => {
      const sonuc = await evrakKesinlestir(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success(
        sonuc.bilgi ??
          (iade
            ? "İade faturası kesildi; iade edilen mal stoktan çıktı, tedarikçiye borcunuz azaldı."
            : "Fatura kesildi, stok arttı ve tedarikçiye borçlanıldı.")
      )
      setOnayModu(false)
      router.refresh()
    })
  }

  function iptalEt() {
    basla(async () => {
      const sonuc = await evrakIptalEt(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Fatura iptal edildi, stok ve cari bakiye geri alındı.")
      setOnayModu(false)
      router.refresh()
    })
  }

  function sil() {
    basla(async () => {
      const sonuc = await evrakSil(id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Fatura silindi.")
      router.push("/evrak/alis")
    })
  }

  if (durum === "IPTAL") {
    return (
      <Button variant="ghost" size="sm" disabled={bekliyor} onClick={sil}>
        Sil
      </Button>
    )
  }

  if (durum === "KESILDI") {
    if (onayModu) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-muted-foreground">
            {iade
              ? "İade edilen mal stoğa geri alınacak, cari etkisi geri alınacak. Emin misin?"
              : "Stok ve cari borcu geri alınacak. Emin misin?"}
          </span>
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
          {iade
            ? "Kesinleşince iade edilen mal stoktan çıkacak, tedarikçiye borcunuz azalacak ve fatura kilitlenecek. Emin misin?"
            : "Kesinleşince stok artacak, stok kartındaki alış fiyatı güncellenecek, tedarikçiye borçlanılacak ve fatura kilitlenecek. Emin misin?"}
        </span>
        <Button variant="ghost" size="sm" disabled={bekliyor} onClick={() => setOnayModu(false)}>
          Vazgeç
        </Button>
        <Button size="sm" disabled={bekliyor} onClick={kesinlestir}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Evet, Kesinleştir
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
        Kesinleştir
      </Button>
    </div>
  )
}
