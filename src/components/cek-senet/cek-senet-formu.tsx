"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Save, Search, X } from "lucide-react"

import {
  cekSenetCariAra,
  cekSenetKaydet,
  type CekSenetFormDurumu,
} from "@/app/(panel)/cek-senet/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * ÇEK / SENET FORMU
 *
 * Yeni kayıt daima "portföyde + onay bekliyor" olarak açılır; durum ve onay
 * bu formdan DEĞİŞTİRİLEMEZ. Karışık işlemleri (tahsil, ciro, karşılıksız)
 * kartın üzerindeki işlem düğmeleri yürütüyor — yanlışlıkla durum seçilip
 * cariye ters kayıt atılması böyle engelleniyor.
 */

type CariAdayi = { id: number; kod: string; unvan: string }

export type CekSenetBaslangic = {
  id: number
  portfoyNo: string
  tur: "CEK" | "SENET"
  yon: "ALINAN" | "VERILEN"
  cari: CariAdayi | null
  tutar: number
  paraBirimi: string
  vadeTarihi: string
  kesideTarihi: string
  kesideYeri: string | null
  borclu: string | null
  banka: string | null
  bankaSube: string | null
  hesapNo: string | null
  belgeNo: string | null
  aciklama: string | null
}

export function CekSenetFormu({
  baslangic,
  varsayilanYon,
}: {
  baslangic?: CekSenetBaslangic
  varsayilanYon?: "ALINAN" | "VERILEN"
}) {
  const [durum, gonder, bekliyor] = useActionState<CekSenetFormDurumu, FormData>(
    cekSenetKaydet,
    {}
  )
  const [tur, setTur] = useState(baslangic?.tur ?? "CEK")
  const [cari, setCari] = useState<CariAdayi | null>(baslangic?.cari ?? null)
  const hata = (alan: string) => durum.alanHatalari?.[alan]

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}
      <input type="hidden" name="cariId" value={cari?.id ?? ""} />

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="p-4">
        <div className="panel p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Alan ad="tur" etiket="Kıymet Türü" zorunlu hata={hata("tur")}>
              <select
                id="tur"
                name="tur"
                value={tur}
                onChange={(e) => setTur(e.target.value as "CEK" | "SENET")}
                className={ALAN_SINIFI}
              >
                <option value="CEK">Çek</option>
                <option value="SENET">Senet</option>
              </select>
            </Alan>

            <Alan ad="yon" etiket="Yön" zorunlu hata={hata("yon")}>
              <select
                id="yon"
                name="yon"
                defaultValue={baslangic?.yon ?? varsayilanYon ?? "ALINAN"}
                className={ALAN_SINIFI}
              >
                <option value="ALINAN">Alınan (müşteriden)</option>
                <option value="VERILEN">Verilen (tedarikçiye)</option>
              </select>
            </Alan>

            <Alan
              ad="portfoyNo"
              etiket="Portföy No"
              hata={hata("portfoyNo")}
              ipucu={baslangic ? undefined : "Boş bırakılırsa sıradaki portföy no otomatik verilir."}
            >
              <Girdi
                name="portfoyNo"
                defaultValue={baslangic?.portfoyNo}
                maxLength={30}
                placeholder="otomatik"
                className="font-mono"
              />
            </Alan>

            <CariSecici secili={cari} onSec={setCari} />

            <Alan ad="tutar" etiket="Tutar" zorunlu hata={hata("tutar")}>
              <Girdi
                name="tutar"
                defaultValue={baslangic?.tutar}
                inputMode="decimal"
                required
                placeholder="0,00"
                className="text-right font-mono text-[0.9375rem]"
              />
            </Alan>

            <Alan ad="paraBirimi" etiket="Para Birimi" hata={hata("paraBirimi")}>
              <Girdi
                name="paraBirimi"
                defaultValue={baslangic?.paraBirimi ?? "TRY"}
                maxLength={3}
                className="uppercase"
              />
            </Alan>

            <Alan
              ad="vadeTarihi"
              etiket="Vade Tarihi"
              zorunlu
              hata={hata("vadeTarihi")}
              ipucu="Vade takibi ve 'bugün yapılacak tahsilat/ödeme' bu tarihe bakar."
            >
              <input
                id="vadeTarihi"
                name="vadeTarihi"
                type="date"
                defaultValue={baslangic?.vadeTarihi}
                className={ALAN_SINIFI}
                required
              />
            </Alan>

            <Alan ad="kesideTarihi" etiket="Keşide Tarihi" hata={hata("kesideTarihi")}>
              <input
                id="kesideTarihi"
                name="kesideTarihi"
                type="date"
                defaultValue={baslangic?.kesideTarihi}
                className={ALAN_SINIFI}
              />
            </Alan>

            <Alan ad="kesideYeri" etiket="Keşide Yeri" hata={hata("kesideYeri")}>
              <Girdi name="kesideYeri" defaultValue={baslangic?.kesideYeri ?? ""} maxLength={80} />
            </Alan>

            <Alan
              ad="borclu"
              etiket={tur === "CEK" ? "Keşideci" : "Borçlu"}
              hata={hata("borclu")}
              ipucu="Kâğıdı imzalayan kişi/firma — müşterinin kendisi olmak zorunda değil."
            >
              <Girdi name="borclu" defaultValue={baslangic?.borclu ?? ""} maxLength={120} />
            </Alan>

            <Alan
              ad="belgeNo"
              etiket={tur === "CEK" ? "Çek No" : "Seri No"}
              hata={hata("belgeNo")}
            >
              <Girdi
                name="belgeNo"
                defaultValue={baslangic?.belgeNo ?? ""}
                maxLength={40}
                className="font-mono"
              />
            </Alan>

            {tur === "CEK" ? (
              <>
                <Alan ad="banka" etiket="Banka" hata={hata("banka")}>
                  <Girdi name="banka" defaultValue={baslangic?.banka ?? ""} maxLength={80} />
                </Alan>
                <Alan ad="bankaSube" etiket="Şube" hata={hata("bankaSube")}>
                  <Girdi
                    name="bankaSube"
                    defaultValue={baslangic?.bankaSube ?? ""}
                    maxLength={80}
                  />
                </Alan>
                <Alan ad="hesapNo" etiket="Hesap No" hata={hata("hesapNo")}>
                  <Girdi
                    name="hesapNo"
                    defaultValue={baslangic?.hesapNo ?? ""}
                    maxLength={40}
                    className="font-mono"
                  />
                </Alan>
              </>
            ) : (
              <>
                <input type="hidden" name="banka" value="" />
                <input type="hidden" name="bankaSube" value="" />
                <input type="hidden" name="hesapNo" value="" />
              </>
            )}

            <Alan ad="aciklama" etiket="Açıklama" hata={hata("aciklama")} genis>
              <Metin
                name="aciklama"
                defaultValue={baslangic?.aciklama ?? ""}
                rows={2}
                maxLength={1000}
              />
            </Alan>
          </div>

          {baslangic ? null : (
            <p className="mt-3 rounded-sm border border-uyari/30 bg-uyari-yumusak px-3 py-2 text-[0.75rem] text-uyari">
              Yeni kayıt <strong>onay bekliyor</strong> olarak açılır. Onaylanana kadar cari
              bakiyesine işlenmez.
            </p>
          )}
        </div>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href={baslangic ? `/cek-senet/${baslangic.id}` : "/cek-senet"}>
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

export function CariSecici({
  secili,
  onSec,
  etiket = "Cari",
}: {
  secili: CariAdayi | null
  onSec: (c: CariAdayi | null) => void
  etiket?: string
}) {
  const [q, setQ] = useState("")
  const [adaylar, setAdaylar] = useState<CariAdayi[]>([])
  const [ariyor, setAriyor] = useState(false)

  useEffect(() => {
    let iptal = false
    if (secili || q.trim().length < 2) {
      // setState effect gövdesinde senkron çağrılmıyor (cascading render
      // uyarısı) — kalem-tablosu.tsx'teki katalog aramasıyla aynı çözüm.
      const temizle = setTimeout(() => {
        if (!iptal) setAdaylar([])
      }, 0)
      return () => {
        iptal = true
        clearTimeout(temizle)
      }
    }
    const araniyorGoster = setTimeout(() => {
      if (!iptal) setAriyor(true)
    }, 0)
    const zamanlayici = setTimeout(async () => {
      const sonuc = await cekSenetCariAra(q)
      if (!iptal) {
        setAdaylar(sonuc)
        setAriyor(false)
      }
    }, 250)
    return () => {
      iptal = true
      clearTimeout(araniyorGoster)
      clearTimeout(zamanlayici)
    }
  }, [q, secili])

  if (secili) {
    return (
      <div className="form-alani">
        <span className="form-etiket">{etiket}</span>
        <div className="flex h-8 items-center justify-between gap-2 rounded-sm border border-input bg-muted/40 px-2 text-[0.8125rem]">
          <span className="truncate">
            <span className="font-mono text-muted-foreground">{secili.kod}</span> {secili.unvan}
          </span>
          <button
            type="button"
            onClick={() => {
              onSec(null)
              setQ("")
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cari bağını kaldır"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-alani relative">
      <label htmlFor="cariArama" className="form-etiket">
        {etiket}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="cariArama"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Unvan, kod veya vergi no…"
          autoComplete="off"
          className={cn(ALAN_SINIFI, "pl-7")}
        />
      </div>
      {q.trim().length >= 2 && (adaylar.length > 0 || ariyor) ? (
        <ul className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-sm border border-border bg-popover shadow-md">
          {ariyor && adaylar.length === 0 ? (
            <li className="px-2 py-1.5 text-[0.8125rem] text-muted-foreground">Aranıyor…</li>
          ) : null}
          {adaylar.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSec(c)
                  setAdaylar([])
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[0.8125rem] hover:bg-accent"
              >
                <span className="font-mono text-muted-foreground">{c.kod}</span>
                <span className="truncate">{c.unvan}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  ipucu,
  genis,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-3")}>
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
      {children}
      {hata ? (
        <p className="text-[0.75rem] text-tehlike">{hata}</p>
      ) : ipucu ? (
        <p className="text-[0.6875rem] text-muted-foreground">{ipucu}</p>
      ) : null}
    </div>
  )
}

function Girdi({ name, className, ...kalan }: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

function Metin({
  name,
  className,
  ...kalan
}: React.ComponentProps<"textarea"> & { name: string }) {
  return (
    <textarea
      id={name}
      name={name}
      className={cn(ALAN_SINIFI, "h-auto resize-y py-1.5", className)}
      {...kalan}
    />
  )
}
