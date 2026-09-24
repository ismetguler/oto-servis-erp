"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { evrakIptalEt, evrakKesinlestir, evrakSil } from "@/app/(panel)/evrak/satis/actions"
import { Button } from "@/components/ui/button"

/**
 * TASLAK'ta Kesinleştir/Sil, KESILDI'de İptal Et düğmesi — Depo Transferi'ndeki
 * onay deseninin aynısı. `kabulden` işaretliyse onay metni değişiyor: kabulden
 * dönüştürülen faturada stok kabul kartında düşülmüş olduğu için burada
 * yeniden düşmez, cari borcu da kabulden devralınır (adım 9.2).
 */
export function EvrakButonlari({
  id,
  durum,
  kabulden = false,
  iade = false,
}: {
  id: number
  durum: "TASLAK" | "KESILDI" | "IPTAL"
  kabulden?: boolean
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
      // Kabulden dönüştürülen faturada stok/cari akışı farklı işliyor;
      // action bunu `bilgi` ile bildiriyor (adım 9.2).
      toast.success(
        sonuc.bilgi ??
          (iade
            ? "İade faturası kesildi; iade edilen mal stoğa girdi, cari alacağı azaldı."
            : "Fatura kesildi, stok düşüldü ve cariye borç yazıldı.")
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
      toast.success(
        kabulden
          ? "Fatura iptal edildi; cari borcu kabul kartına geri yazıldı."
          : "Fatura iptal edildi, stok ve cari bakiye geri alındı."
      )
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
      router.push("/evrak/satis")
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
            {kabulden
              ? "Cari borcu kabul kartına geri yazılacak, kart yeniden faturalanabilir olacak. Emin misin?"
              : iade
                ? "İade edilen mal stoktan çıkarılacak, cari etkisi geri alınacak. Emin misin?"
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
          {kabulden
            ? "Kesinleşince cari borcu kabulden faturaya devredilecek ve fatura kilitlenecek. Stok kabul kartında zaten düşüldüğü için yeniden düşülmeyecek. Emin misin?"
            : iade
              ? "Kesinleşince iade edilen mal stoğa girecek, cari alacağı azalacak ve fatura kilitlenecek. Emin misin?"
              : "Kesinleşince stok düşecek, cariye borç yazılacak ve fatura kilitlenecek. Emin misin?"}
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
