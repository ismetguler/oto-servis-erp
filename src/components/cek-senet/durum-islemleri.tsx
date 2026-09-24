"use client"

import { useActionState, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { durumDegistir, type CekSenetFormDurumu } from "@/app/(panel)/cek-senet/actions"
import { CariSecici } from "@/components/cek-senet/cek-senet-formu"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * DURUM İŞLEMLERİ
 *
 * Yalnızca sunucunun izin verdiği geçişler düğme olarak çıkar (liste sayfadan
 * geliyor). Kasa ya da ciro carisi gereken geçişte form açılıyor; gerekmeyen
 * geçişte tek tıkla uygulanıyor.
 */

type CariAdayi = { id: number; kod: string; unvan: string }
type KasaSecenegi = { id: number; kod: string; ad: string; bakiye: number }

export function DurumIslemleri({
  id,
  tutar,
  gecisler,
  kasalar,
  durumAdlari,
  kasaliDurumlar,
}: {
  id: number
  tutar: number
  gecisler: string[]
  kasalar: KasaSecenegi[]
  durumAdlari: Record<string, string>
  /** Kasa seçimi zorunlu olan hedef durumlar (sunucu kuralının aynası). */
  kasaliDurumlar: string[]
}) {
  const [durum, gonder, bekliyor] = useActionState<CekSenetFormDurumu, FormData>(
    durumDegistir,
    {}
  )
  const [secili, setSecili] = useState<string | null>(null)
  const [ciroCari, setCiroCari] = useState<CariAdayi | null>(null)

  // setState effect gövdesinde senkron çağrılmıyor (cascading render uyarısı).
  useEffect(() => {
    if (durum.basarili) {
      toast.success(durum.basarili)
      const zamanlayici = setTimeout(() => {
        setSecili(null)
        setCiroCari(null)
      }, 0)
      return () => clearTimeout(zamanlayici)
    } else if (durum.hata) {
      toast.error(durum.hata)
    }
  }, [durum])

  if (gecisler.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
        Bu kâğıt için yapılabilecek başka işlem yok.
      </p>
    )
  }

  const kasaLazim = secili !== null && kasaliDurumlar.includes(secili)
  const ciroLazim = secili === "CIRO_EDILDI"
  const bugun = new Date()
  const varsayilanTarih = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, "0")}-${String(bugun.getDate()).padStart(2, "0")}`

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-2">
        {gecisler.map((g) => (
          <Button
            key={g}
            type="button"
            size="sm"
            variant={secili === g ? "default" : "outline"}
            onClick={() => setSecili(secili === g ? null : g)}
            className={cn(
              g === "KARSILIKSIZ" && secili !== g && "border-tehlike/40 text-tehlike"
            )}
          >
            {durumAdlari[g]}
          </Button>
        ))}
      </div>

      {secili ? (
        <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="mt-3 rounded-sm border border-border bg-muted/30 p-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="yeniDurum" value={secili} />
          {ciroLazim ? <input type="hidden" name="ciroCariId" value={ciroCari?.id ?? ""} /> : null}

          <p className="mb-2 text-[0.8125rem]">
            <strong>{durumAdlari[secili]}</strong> işlemi — {para(tutar)}
            {kasaLazim ? " · para kasaya işlenecek" : ""}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="form-alani">
              <label htmlFor="tarih" className="form-etiket">
                İşlem Tarihi
              </label>
              <input
                id="tarih"
                name="tarih"
                type="date"
                defaultValue={varsayilanTarih}
                className={ALAN_SINIFI}
              />
            </div>

            {kasaLazim ? (
              <div className="form-alani">
                <label htmlFor="kasaId" className="form-etiket zorunlu-alan">
                  Kasa
                </label>
                <select id="kasaId" name="kasaId" className={ALAN_SINIFI} required>
                  <option value="">Seçin…</option>
                  {kasalar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.kod} — {k.ad} ({para(k.bakiye)})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {ciroLazim ? (
              <CariSecici secili={ciroCari} onSec={setCiroCari} etiket="Ciro Edilen Cari" />
            ) : null}

            <div className="form-alani sm:col-span-2">
              <label htmlFor="aciklama" className="form-etiket">
                Açıklama
              </label>
              <input
                id="aciklama"
                name="aciklama"
                maxLength={300}
                placeholder="İsteğe bağlı not"
                className={ALAN_SINIFI}
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSecili(null)}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={bekliyor}>
              {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {bekliyor ? "İşleniyor…" : "Uygula"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
