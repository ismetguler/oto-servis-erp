"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ScanLine } from "lucide-react"

import { stokBarkodAra } from "@/app/(panel)/stok/barkod/actions"
import type { BulunanParca } from "@/app/(panel)/servis/parca-cikis/veri"
import { para } from "@/lib/bicim"

/**
 * Depocunun elindeki barkod okuyucu bu alana yazıp Enter'a basacak —
 * ekranın odağı hep bu kutuda kalmalı ki art arda okutma yapılabilsin.
 * Yazdıkça da otomatik arıyor (300 ms debounce); Enter beklemeden bulunan
 * tek kayıt varsa Ara'ya basmaya gerek kalmadan doğrudan kart sayfasına
 * atlanır — barkod okuyucu Enter göndererek bunu anında tetikler.
 * Tek kayıt bulunursa doğrudan kart sayfasına atlanır, birden fazla
 * aday varsa (isimle geniş arama) kısa bir liste sunulur.
 */
export function BarkodArama() {
  const [metin, setMetin] = useState("")
  const [adaylar, setAdaylar] = useState<BulunanParca[]>([])
  const [aranmadi, setAranmadi] = useState(false)
  const [bekliyor, setBekliyor] = useState(false)
  const girdiRef = useRef<HTMLInputElement>(null)
  const sonAramaRef = useRef("")
  const router = useRouter()

  async function ara(deger: string) {
    setBekliyor(true)
    const sonuc = await stokBarkodAra(deger)
    // Kullanıcı bu sırada yazmaya devam ettiyse eski sonuç ekrana basılmasın.
    if (sonAramaRef.current !== deger) return
    setBekliyor(false)
    if (sonuc.tam) {
      router.push(`/stok/${sonuc.tam.id}`)
      setMetin("")
      setAdaylar([])
      setAranmadi(false)
      return
    }
    setAdaylar(sonuc.adaylar)
    setAranmadi(sonuc.adaylar.length === 0)
  }

  // Yazdıkça otomatik arama — Ara'ya basmaya gerek kalmasın.
  useEffect(() => {
    const deger = metin.trim()
    sonAramaRef.current = deger

    if (deger.length < 2) {
      setAdaylar([])
      setAranmadi(false)
      return
    }

    const zamanlayici = setTimeout(() => ara(deger), 300)
    return () => clearTimeout(zamanlayici)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metin])

  return (
    <div className="flex flex-col gap-4 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const deger = metin.trim()
          // Barkod okuyucu taramanın sonunda Enter gönderir — debounce
          // beklemeden anında arat.
          if (deger.length >= 2) ara(deger)
        }}
        className="panel flex items-center gap-2 p-4"
      >
        <ScanLine className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="relative flex-1">
          <input
            ref={girdiRef}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            autoFocus
            placeholder="Barkod okutun veya stok kodu / ürün adı yazın"
            className="h-9 w-full rounded-sm border border-input bg-background px-3 pr-8 text-[0.875rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          {bekliyor ? (
            <Loader2
              className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>
      </form>

      {aranmadi ? (
        <p className="px-1 text-[0.8125rem] text-muted-foreground">
          Bu barkod/koda uyan aktif bir stok kartı bulunamadı.
        </p>
      ) : null}

      {adaylar.length > 0 ? (
        <div className="panel overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-[0.875rem] font-semibold">
              {adaylar.length} sonuç bulundu — birini seçin
            </h2>
          </div>
          <div className="tablo-sarmal">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Barkod</th>
                  <th>Raf</th>
                  <th className="text-right">Stokta</th>
                  <th className="text-right">Fiyat</th>
                </tr>
              </thead>
              <tbody>
                {adaylar.map((a) => (
                  <tr
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/stok/${a.id}`)}
                  >
                    <td className="font-mono text-[0.75rem]">{a.kod}</td>
                    <td className="max-w-[20rem] truncate font-medium">{a.ad}</td>
                    <td className="font-mono text-[0.75rem]">{a.barkod ?? "—"}</td>
                    <td>{a.rafYeri ?? "—"}</td>
                    <td className="text-right tabular-nums">{a.stokta}</td>
                    <td className="text-right tabular-nums">{para(a.fiyat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
