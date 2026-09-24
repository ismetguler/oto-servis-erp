"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RotateCcw, Trash2 } from "lucide-react"

import { stokGirisiGeriAl, stokGirisiSil } from "@/app/(panel)/stok/giris/actions"
import { Button } from "@/components/ui/button"

/**
 * Stok Girişi fiş detayı — durum aksiyonları.
 *  ONAYLANDI  → "Geri Al" (stok bakiyesini eski hâline döndürür)
 *  GERI_ALINDI → "Sil" (kalıcı, hareket zaten yok)
 */
export function GirisFisButonlari({ id, durum }: { id: number; durum: string }) {
  const router = useRouter()
  const [bekliyor, basla] = useTransition()
  const [hata, setHata] = useState<string | null>(null)
  const [onay, setOnay] = useState<null | "geri" | "sil">(null)

  function calistir(tur: "geri" | "sil") {
    setHata(null)
    basla(async () => {
      const sonuc = tur === "geri" ? await stokGirisiGeriAl(id) : await stokGirisiSil(id)
      if (sonuc?.hata) {
        setHata(sonuc.hata)
        setOnay(null)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {hata ? <span className="text-[0.75rem] text-tehlike">{hata}</span> : null}

        {durum === "ONAYLANDI" ? (
          onay === "geri" ? (
            <>
              <Button size="sm" variant="destructive" disabled={bekliyor} onClick={() => calistir("geri")}>
                {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Evet, geri al"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOnay(null)}>
                Vazgeç
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setOnay("geri")}>
              <RotateCcw className="size-4" aria-hidden />
              Geri Al
            </Button>
          )
        ) : null}

        {durum === "GERI_ALINDI" ? (
          onay === "sil" ? (
            <>
              <Button size="sm" variant="destructive" disabled={bekliyor} onClick={() => calistir("sil")}>
                {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Evet, sil"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOnay(null)}>
                Vazgeç
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-tehlike hover:text-tehlike"
              onClick={() => setOnay("sil")}
            >
              <Trash2 className="size-4" aria-hidden />
              Sil
            </Button>
          )
        ) : null}
      </div>
    </div>
  )
}
