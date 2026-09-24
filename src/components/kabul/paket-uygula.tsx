"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, Loader2, PackagePlus, X } from "lucide-react"
import { toast } from "sonner"

import {
  paketOnizle,
  paketiUygula,
  type PaketOnizleme,
} from "@/app/(panel)/servis/bakim-paketi/actions"
import { Button } from "@/components/ui/button"
import { miktar as miktarBicim, para } from "@/lib/bicim"

/**
 * BAKIM PAKETİ UYGULAMA (kabul kartı)
 *
 * İki adımlı: önce ÖNİZLEME, sonra uygulama. Tek adım yapılsaydı kullanıcı
 * 10-15 satırın hangi fiyatla düşeceğini görmeden onaylamış olurdu; fiyatlar
 * pakette değil katalogda tutulduğu için bu gerçek bir risk.
 */

export type UygulanabilirPaket = {
  id: number
  kod: string
  ad: string
  km: number | null
  marka: string | null
  aracTuru: string | null
  satirSayisi: number
}

export function PaketUygula({
  kabulId,
  paketler,
}: {
  kabulId: number
  paketler: UygulanabilirPaket[]
}) {
  const [acik, setAcik] = useState(false)
  const [paketId, setPaketId] = useState<number | null>(paketler[0]?.id ?? null)
  const [onizleme, setOnizleme] = useState<PaketOnizleme | null>(null)
  const [bekliyor, basla] = useTransition()

  function kapat() {
    setAcik(false)
    setOnizleme(null)
  }

  function onizlemeGetir(secilen: number) {
    basla(async () => {
      const sonuc = await paketOnizle(kabulId, secilen)
      setOnizleme(sonuc)
      if (sonuc.hata) toast.error(sonuc.hata)
    })
  }

  function uygula() {
    if (!paketId) return
    basla(async () => {
      const sonuc = await paketiUygula(kabulId, paketId)
      if (sonuc.hata) toast.error(sonuc.hata)
      else {
        toast.success(sonuc.basarili ?? "Paket uygulandı.")
        kapat()
      }
    })
  }

  if (paketler.length === 0) return null

  if (!acik) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAcik(true)}>
        <PackagePlus className="size-4" aria-hidden />
        Bakım Paketi
      </Button>
    )
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={kapat}>
        <X className="size-4" aria-hidden />
        Kapat
      </Button>

      {/* Ekranın tamamını kaplamayan basit bir katman: kalem ızgarasının
          üstünde durup kartın geri kalanını okunur bırakıyor. */}
      <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-4 pt-16">
        <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-md border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-[0.875rem] font-semibold">Bakım Paketi Uygula</h2>
            <Button variant="ghost" size="icon" onClick={kapat} aria-label="Kapat">
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
            <div className="form-alani min-w-[18rem] flex-1">
              <label htmlFor="paketSecimi" className="form-etiket">
                Paket
              </label>
              <select
                id="paketSecimi"
                value={paketId ?? ""}
                onChange={(e) => {
                  const secilen = Number(e.target.value)
                  setPaketId(secilen)
                  setOnizleme(null)
                }}
                className="h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                {paketler.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.kod} — {p.ad}
                    {p.km ? ` (${p.km.toLocaleString("tr-TR")} km)` : ""} · {p.satirSayisi} satır
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={bekliyor || !paketId}
              onClick={() => paketId && onizlemeGetir(paketId)}
            >
              {bekliyor && !onizleme ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Önizle
            </Button>
          </div>

          {onizleme?.hata ? (
            <div className="m-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
              {onizleme.hata}
            </div>
          ) : null}

          {onizleme?.satirlar ? (
            <>
              <div className="overflow-auto">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Tür</th>
                      <th>Açıklama</th>
                      <th className="text-right">Miktar</th>
                      <th className="text-right">Fiyat</th>
                      <th className="text-right">KDV %</th>
                      <th className="text-right">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onizleme.satirlar.map((s, i) => (
                      <tr key={i}>
                        <td className="text-[0.6875rem] text-muted-foreground">
                          {s.tur === "PARCA"
                            ? "Parça"
                            : s.tur === "ISCILIK"
                              ? "İşçilik"
                              : "Dış Hizmet"}
                        </td>
                        <td className="max-w-[18rem] truncate font-medium">
                          {s.aciklama}
                          {s.uyari ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-[0.6875rem] text-uyari">
                              <AlertTriangle className="size-3" aria-hidden />
                              {s.uyari}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-right tabular-nums">
                          {miktarBicim(s.miktar)} {s.birim}
                        </td>
                        <td className="text-right tabular-nums">{para(s.birimFiyat)}</td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {miktarBicim(s.kdvOrani)}
                        </td>
                        <td className="text-right tabular-nums font-medium">{para(s.toplam)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-[0.8125rem]">
                  <span className="text-muted-foreground">Karta eklenecek:</span>{" "}
                  <span className="font-semibold">{onizleme.satirlar.length} satır</span> ·{" "}
                  <span className="font-semibold tabular-nums">
                    {para(onizleme.genelToplam ?? 0)}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={kapat}>
                    Vazgeç
                  </Button>
                  <Button size="sm" disabled={bekliyor} onClick={uygula}>
                    {bekliyor ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <PackagePlus className="size-4" aria-hidden />
                    )}
                    Karta Ekle
                  </Button>
                </div>
              </div>
            </>
          ) : !onizleme?.hata ? (
            <p className="px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
              Paketi seçip &quot;Önizle&quot;ye basın — hangi satırların hangi fiyatla
              ekleneceğini onaylamadan önce görün.
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
}
