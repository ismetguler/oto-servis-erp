"use client"

import { useActionState, useMemo, useState } from "react"
import { Loader2, ArrowRightLeft } from "lucide-react"

import { transferOlustur, type TransferFormDurumu } from "@/app/(panel)/stok/transfer/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { miktar } from "@/lib/bicim"

export type TransferSatirGosterim = {
  id: number
  kod: string
  ad: string
  birim: string
  mevcutMiktar: number
}

/**
 * Yeni transfer fişi ızgarası. Kaynak depodaki tüm aktif kartlar listelenir;
 * kullanıcı taşınacakları işaretler. Miktar girilmez — kart, o andaki tüm
 * mevcut miktarıyla taşınır (bkz. sema.ts / şema yorumu).
 */
export function TransferFormu({
  kaynakDepoId,
  hedefDepoId,
  kayitlar,
}: {
  kaynakDepoId: string
  hedefDepoId: string
  kayitlar: TransferSatirGosterim[]
}) {
  const [secililer, setSecililer] = useState<Record<number, boolean>>({})
  const [durum, gonder, bekliyor] = useActionState<TransferFormDurumu, FormData>(
    transferOlustur,
    {}
  )

  const seciliSayisi = useMemo(
    () => Object.values(secililer).filter(Boolean).length,
    [secililer]
  )

  const hepsiSecili = kayitlar.length > 0 && seciliSayisi === kayitlar.length

  function hepsiniSecToggle() {
    if (hepsiSecili) {
      setSecililer({})
    } else {
      setSecililer(Object.fromEntries(kayitlar.map((k) => [k.id, true])))
    }
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col gap-4">
      <input type="hidden" name="kaynakDepoId" value={kaynakDepoId} />
      <input type="hidden" name="hedefDepoId" value={hedefDepoId} />

      {durum.hata ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-[0.8125rem] text-destructive">
          {durum.hata}
        </p>
      ) : null}

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-[0.875rem] font-semibold">
            Kaynak Depodaki Kartlar ({kayitlar.length})
          </h2>
          <span className="text-[0.8125rem] text-muted-foreground">
            {seciliSayisi} kart seçildi
          </span>
        </div>
        <div className="max-h-[30rem] overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={hepsiSecili}
                    onChange={hepsiniSecToggle}
                    aria-label="Tümünü seç"
                  />
                </th>
                <th>Kod</th>
                <th>Ürün Adı</th>
                <th className="text-right">Mevcut Miktar</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id}>
                  <td>
                    <input
                      type="checkbox"
                      name="stokId"
                      value={k.id}
                      checked={secililer[k.id] ?? false}
                      onChange={(e) =>
                        setSecililer((onceki) => ({ ...onceki, [k.id]: e.target.checked }))
                      }
                      aria-label={`${k.ad} seç`}
                    />
                  </td>
                  <td className="font-mono text-[0.75rem]">{k.kod}</td>
                  <td className="max-w-[24rem] truncate font-medium">{k.ad}</td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {miktar(k.mevcutMiktar)} {k.birim}
                  </td>
                </tr>
              ))}
              {kayitlar.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    Seçili kaynak depoda kart bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-alani">
        <label htmlFor="aciklama" className="form-etiket">
          Açıklama (opsiyonel)
        </label>
        <input
          id="aciklama"
          name="aciklama"
          placeholder="Örn. Şube açılışı için ilk stok"
          className="h-8 w-full max-w-md rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={bekliyor || seciliSayisi === 0}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRightLeft className="size-4" aria-hidden />
          )}
          {bekliyor
            ? "Oluşturuluyor…"
            : `Transfer Fişini Oluştur (${seciliSayisi} kart)`}
        </Button>
      </div>
    </form>
  )
}
