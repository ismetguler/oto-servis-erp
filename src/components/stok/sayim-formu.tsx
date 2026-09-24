"use client"

import { useActionState, useMemo, useState } from "react"
import { Loader2, ClipboardCheck } from "lucide-react"

import { sayimOlustur, type SayimFormDurumu } from "@/app/(panel)/stok/sayim/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { miktar } from "@/lib/bicim"

export type SayimSatirGosterim = {
  id: number
  kod: string
  ad: string
  birim: string
  mevcutMiktar: number
  depoAdi: string | null
}

/**
 * Yeni sayım fişi ızgarası. Filtreye uyan tüm aktif stoklar listelenir;
 * kullanıcı yalnızca gerçekten SAYDIĞI satırlara miktar girer, boş
 * bıraktığı satır fişe hiç girmez (o stok "sayılmayanlar" listesinde kalır).
 * Fark, kaydetmeden ÖNCE burada canlı gösterilir — sunucuya gitmeden
 * kullanıcı ne kaydedeceğini görür.
 */
export function SayimFormu({
  depoId,
  urunGrubu,
  kayitlar,
}: {
  depoId: string
  urunGrubu: string
  kayitlar: SayimSatirGosterim[]
}) {
  const [degerler, setDegerler] = useState<Record<number, string>>({})
  const [durum, gonder, bekliyor] = useActionState<SayimFormDurumu, FormData>(
    sayimOlustur,
    {}
  )

  const sayilanSayisi = useMemo(
    () => Object.values(degerler).filter((v) => v.trim() !== "").length,
    [degerler]
  )

  function farkGoster(kayit: SayimSatirGosterim) {
    const yazi = degerler[kayit.id]
    if (yazi === undefined || yazi.trim() === "") return null
    const sayilan = Number(yazi.replace(",", "."))
    if (!Number.isFinite(sayilan)) return null
    const fark = sayilan - kayit.mevcutMiktar
    if (fark === 0) return <span className="text-muted-foreground">0</span>
    return (
      <span className={fark > 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
        {fark > 0 ? "+" : ""}
        {miktar(fark)}
      </span>
    )
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col gap-4">
      <input type="hidden" name="depoId" value={depoId} />
      <input type="hidden" name="urunGrubu" value={urunGrubu} />

      {durum.hata ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-[0.8125rem] text-destructive">
          {durum.hata}
        </p>
      ) : null}

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-[0.875rem] font-semibold">
            Sayılacak Stoklar ({kayitlar.length})
          </h2>
          <span className="text-[0.8125rem] text-muted-foreground">
            {sayilanSayisi} satıra miktar girildi
          </span>
        </div>
        <div className="max-h-[30rem] overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Ürün Adı</th>
                <th>Depo</th>
                <th className="text-right">Sistem Miktarı</th>
                <th className="text-right">Sayılan Miktar</th>
                <th className="text-right">Fark</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id}>
                  <td className="font-mono text-[0.75rem]">{k.kod}</td>
                  <td className="max-w-[20rem] truncate font-medium">{k.ad}</td>
                  <td className="text-muted-foreground">{k.depoAdi ?? "—"}</td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {miktar(k.mevcutMiktar)} {k.birim}
                  </td>
                  <td className="text-right">
                    <input type="hidden" name="stokId" value={k.id} />
                    <input
                      name="sayilanMiktar"
                      inputMode="decimal"
                      placeholder="—"
                      value={degerler[k.id] ?? ""}
                      onChange={(e) =>
                        setDegerler((onceki) => ({ ...onceki, [k.id]: e.target.value }))
                      }
                      className="h-8 w-24 rounded-sm border border-input bg-background px-2 text-right text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    />
                  </td>
                  <td className="text-right tabular-nums">{farkGoster(k)}</td>
                </tr>
              ))}
              {kayitlar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Filtreye uyan stok bulunamadı.
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
          placeholder="Örn. Dönem sonu genel sayım"
          className="h-8 w-full max-w-md rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={bekliyor || sayilanSayisi === 0}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ClipboardCheck className="size-4" aria-hidden />
          )}
          {bekliyor
            ? "Oluşturuluyor…"
            : `Sayım Fişini Oluştur (${sayilanSayisi} satır)`}
        </Button>
      </div>
    </form>
  )
}
