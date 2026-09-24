"use client"

import { useMemo, useState } from "react"
import { Printer } from "lucide-react"

import { BarkodSvg } from "@/components/stok/barkod-svg"
import { Button } from "@/components/ui/button"

export type EtiketSatirGosterim = {
  id: number
  kod: string
  ad: string
  barkod: string | null
}

/**
 * Seçim ekranı toplu fiyat güncellemedeki checkbox deseninin aynısı.
 * Yazdırma AYRI bir sayfa/PDF üretmiyor — ekranda gizli duran bir
 * `yazdirma-alani` bloğu `window.print()` ile kâğıda basılıyor
 * (globals.css'teki ortak @media print kuralları burayı da kapsıyor).
 * Barkodu boş kartlar için stok KODU barkod olarak basılır — depoda
 * fiilen barkod etiketi olmayan parçalara da tarayıcıyla okunabilir bir
 * etiket üretilebilsin diye.
 */
export function EtiketFormu({
  kayitlar,
  onSecili,
}: {
  kayitlar: EtiketSatirGosterim[]
  onSecili?: number
}) {
  const [secili, setSecili] = useState<Set<number>>(
    () => new Set(onSecili && kayitlar.some((k) => k.id === onSecili) ? [onSecili] : [])
  )
  const [adetler, setAdetler] = useState<Record<number, number>>({})

  const hepsiSecili = kayitlar.length > 0 && secili.size === kayitlar.length

  function tumunuSecToggle() {
    setSecili(hepsiSecili ? new Set() : new Set(kayitlar.map((k) => k.id)))
  }

  function satiriSecToggle(id: number) {
    setSecili((onceki) => {
      const yeni = new Set(onceki)
      if (yeni.has(id)) yeni.delete(id)
      else yeni.add(id)
      return yeni
    })
  }

  function adetGuncelle(id: number, deger: string) {
    const n = Math.max(1, Math.min(99, Number(deger) || 1))
    setAdetler((onceki) => ({ ...onceki, [id]: n }))
  }

  // Her seçili kart, girilen adet kadar tekrarlanarak etiket listesine girer.
  const etiketler = useMemo(() => {
    const secilenler = kayitlar.filter((k) => secili.has(k.id))
    return secilenler.flatMap((k) => {
      const adet = adetler[k.id] ?? 1
      return Array.from({ length: adet }, (_, i) => ({ ...k, tekrar: i }))
    })
  }, [kayitlar, secili, adetler])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="yazdirma-disi panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-[0.875rem] font-semibold">
            {secili.size} kart seçili — {etiketler.length} etiket basılacak
          </h2>
          <Button size="sm" disabled={etiketler.length === 0} onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Etiketleri Yazdır
          </Button>
        </div>
        <div className="max-h-[26rem] overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={hepsiSecili}
                    onChange={tumunuSecToggle}
                    aria-label="Tümünü seç"
                  />
                </th>
                <th>Kod</th>
                <th>Ürün Adı</th>
                <th>Barkod</th>
                <th className="w-24 text-right">Adet</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={secili.has(k.id)}
                      onChange={() => satiriSecToggle(k.id)}
                      aria-label={`${k.kod} seç`}
                    />
                  </td>
                  <td className="font-mono text-[0.75rem]">{k.kod}</td>
                  <td className="max-w-[24rem] truncate font-medium">{k.ad}</td>
                  <td className="font-mono text-[0.75rem]">{k.barkod ?? "— (kod basılır)"}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={adetler[k.id] ?? 1}
                      onChange={(e) => adetGuncelle(k.id, e.target.value)}
                      disabled={!secili.has(k.id)}
                      className="h-7 w-16 rounded-sm border border-input bg-background px-2 text-right text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ekranda gizli, sadece yazdırırken görünen etiket sayfası. */}
      <div className="yazdirma-alani hidden grid-cols-3 gap-3 print:grid">
        {etiketler.map((e, i) => (
          <div
            key={`${e.id}-${e.tekrar}-${i}`}
            className="flex flex-col items-center gap-1 border border-dashed border-black/30 p-2 text-center break-inside-avoid"
          >
            <div className="text-[0.7rem] font-semibold leading-tight">{e.ad}</div>
            <BarkodSvg deger={e.barkod ?? e.kod} yukseklik={36} />
            <div className="font-mono text-[0.7rem] tracking-wider">{e.barkod ?? e.kod}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
