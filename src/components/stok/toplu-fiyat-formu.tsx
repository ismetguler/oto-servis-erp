"use client"

import { useMemo, useState, useTransition } from "react"
import { Loader2, TrendingUp } from "lucide-react"
import { toast } from "sonner"

import {
  topluFiyatOnizle,
  topluFiyatUygula,
  type TopluFiyatOnizleme,
} from "@/app/(panel)/stok/toplu-fiyat/actions"
import { FIYAT_ALANLARI, type FiyatAlani } from "@/app/(panel)/stok/toplu-fiyat/sema"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"

export type TopluFiyatSatirGosterim = {
  id: number
  kod: string
  ad: string
  fiyatlar: Record<FiyatAlani, number>
}

/**
 * Toplu fiyat güncelleme — iki adımlı: önce ÖNİZLEME (kaç kart, eski→yeni),
 * onaydan sonra uygulama. Bakım paketi uygulama modalindeki desenin aynısı
 * (`components/kabul/paket-uygula.tsx`).
 *
 * Seçim yalnızca EKRANDAKİ (sayfalanmış) listedeki kartlar arasından yapılır
 * — filtreler geniş bir sonuç verirse kullanıcı sayfa sayfa gezip seçer,
 * bu da önizlemede "N kart" derken gerçekten göz gezdirilebilir bir sayı
 * kalmasını sağlıyor.
 */
export function TopluFiyatFormu({ kayitlar }: { kayitlar: TopluFiyatSatirGosterim[] }) {
  const [secili, setSecili] = useState<Set<number>>(new Set())
  const [alan, setAlan] = useState<FiyatAlani>("satisFiyat")
  const [tip, setTip] = useState<"YUZDE" | "TUTAR">("YUZDE")
  const [yon, setYon] = useState<"ZAM" | "INDIRIM">("ZAM")
  const [deger, setDeger] = useState("")
  const [onizleme, setOnizleme] = useState<TopluFiyatOnizleme | null>(null)
  const [bekliyor, basla] = useTransition()

  const hepsiSecili = kayitlar.length > 0 && secili.size === kayitlar.length

  function tumunuSecToggle() {
    setSecili(hepsiSecili ? new Set() : new Set(kayitlar.map((k) => k.id)))
    setOnizleme(null)
  }

  function satiriSecToggle(id: number) {
    setSecili((onceki) => {
      const yeni = new Set(onceki)
      if (yeni.has(id)) yeni.delete(id)
      else yeni.add(id)
      return yeni
    })
    setOnizleme(null)
  }

  const girdi = useMemo(
    () => ({ alan, tip, yon, deger, idler: Array.from(secili) }),
    [alan, tip, yon, deger, secili]
  )

  function onizle() {
    if (secili.size === 0) {
      toast.error("En az bir stok kartı seçin.")
      return
    }
    basla(async () => {
      const sonuc = await topluFiyatOnizle(girdi)
      setOnizleme(sonuc)
      if (sonuc.hata) toast.error(sonuc.hata)
    })
  }

  function uygula() {
    basla(async () => {
      const sonuc = await topluFiyatUygula(girdi)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success(sonuc.basarili ?? "Fiyatlar güncellendi.")
      setOnizleme(null)
      setSecili(new Set())
      setDeger("")
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <div className="form-alani">
          <label htmlFor="alan" className="form-etiket">
            Fiyat Alanı
          </label>
          <select
            id="alan"
            value={alan}
            onChange={(e) => {
              setAlan(e.target.value as FiyatAlani)
              setOnizleme(null)
            }}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {Object.entries(FIYAT_ALANLARI).map(([k, ad]) => (
              <option key={k} value={k}>
                {ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="yon" className="form-etiket">
            Yön
          </label>
          <select
            id="yon"
            value={yon}
            onChange={(e) => {
              setYon(e.target.value as "ZAM" | "INDIRIM")
              setOnizleme(null)
            }}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="ZAM">Fiyatı artır</option>
            <option value="INDIRIM">Fiyatı azalt</option>
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="tip" className="form-etiket">
            Tip
          </label>
          <select
            id="tip"
            value={tip}
            onChange={(e) => {
              setTip(e.target.value as "YUZDE" | "TUTAR")
              setOnizleme(null)
            }}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="YUZDE">Yüzde (%)</option>
            <option value="TUTAR">Sabit Tutar (₺)</option>
          </select>
        </div>

        <div className="form-alani w-32">
          <label htmlFor="deger" className="form-etiket">
            Değer
          </label>
          <input
            id="deger"
            value={deger}
            onChange={(e) => {
              setDeger(e.target.value)
              setOnizleme(null)
            }}
            inputMode="decimal"
            placeholder={tip === "YUZDE" ? "Örn. 10" : "Örn. 25,00"}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>

        <Button size="sm" disabled={bekliyor} onClick={onizle}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <TrendingUp className="size-4" aria-hidden />}
          Önizle ({secili.size} kart seçili)
        </Button>
      </div>

      <div className="panel overflow-hidden">
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
                <th className="text-right">{FIYAT_ALANLARI[alan]}</th>
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
                  <td className="text-right tabular-nums">{para(k.fiyatlar[alan])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onizleme?.satirlar ? (
        <div className="panel overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-[0.875rem] font-semibold">
              Önizleme — {onizleme.alanAdi}
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">
              {onizleme.satirlar.length} kart etkilenecek
            </p>
          </div>
          <div className="max-h-[22rem] overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th className="text-right">Eski Fiyat</th>
                  <th className="text-right">Yeni Fiyat</th>
                </tr>
              </thead>
              <tbody>
                {onizleme.satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem]">{s.kod}</td>
                    <td className="max-w-[24rem] truncate font-medium">{s.ad}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {para(s.eskiFiyat)}
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {para(s.yeniFiyat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setOnizleme(null)}>
              Vazgeç
            </Button>
            <Button size="sm" disabled={bekliyor} onClick={uygula}>
              {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Onayla ve Uygula
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
