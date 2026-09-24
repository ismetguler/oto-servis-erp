"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { ArrowDownCircle, ArrowUpCircle, Loader2, Save, Search, X } from "lucide-react"
import { toast } from "sonner"

import {
  kasaCariAra,
  kasaHareketiKaydet,
  type KasaFormDurumu,
} from "@/app/(panel)/kasa/actions"
import { ListeVeyaYaz } from "@/components/liste-veya-yaz"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * KASA GİRİŞ / ÇIKIŞ FORMU
 *
 * Tutar tek alan, yön ayrı düğme. Eksi tutar girdirmek yerine yönü açıkça
 * seçtirmek, "-500 mü yazdım 500 mü?" hatasını tamamen ortadan kaldırıyor
 * (veritabanında da tutar hep pozitif tutuluyor).
 */

export type KasaSecenegi = {
  id: number
  kod: string
  ad: string
  tur: string
  bakiye: number
  paraBirimi: string
}

type CariAdayi = { id: number; kod: string; unvan: string }

export function HareketFormu({
  kasalar,
  masraflar,
  varsayilanKasaId,
}: {
  kasalar: KasaSecenegi[]
  masraflar: string[]
  varsayilanKasaId?: number
}) {
  const [durum, gonder, bekliyor] = useActionState<KasaFormDurumu, FormData>(
    kasaHareketiKaydet,
    {}
  )
  const [tur, setTur] = useState<"GIRIS" | "CIKIS">("GIRIS")
  const [cari, setCari] = useState<CariAdayi | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Başarılı kayıttan sonra form temizlenir; kasiyer arka arkaya satır girer.
  // setState effect gövdesinde senkron çağrılmıyor (cascading render uyarısı).
  useEffect(() => {
    if (durum.basarili) {
      toast.success(durum.basarili)
      formRef.current?.reset()
      const zamanlayici = setTimeout(() => setCari(null), 0)
      return () => clearTimeout(zamanlayici)
    } else if (durum.hata) {
      toast.error(durum.hata)
    }
  }, [durum])

  const hata = (alan: string) => durum.alanHatalari?.[alan]
  const bugun = new Date()
  const varsayilanTarih = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, "0")}-${String(bugun.getDate()).padStart(2, "0")}`

  return (
    <form ref={formRef} onSubmit={(olay) => formGonderimi(olay, gonder)} className="panel p-4">
      <input type="hidden" name="tur" value={tur} />
      <input type="hidden" name="cariId" value={cari?.id ?? ""} />

      <div className="mb-3 flex gap-2">
        <YonDugmesi
          secili={tur === "GIRIS"}
          onClick={() => setTur("GIRIS")}
          renk="basari"
          ikon={<ArrowDownCircle className="size-4" aria-hidden />}
          etiket="Kasaya Giriş"
        />
        <YonDugmesi
          secili={tur === "CIKIS"}
          onClick={() => setTur("CIKIS")}
          renk="tehlike"
          ikon={<ArrowUpCircle className="size-4" aria-hidden />}
          etiket="Kasadan Çıkış"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Alan ad="kasaId" etiket="Kasa" zorunlu hata={hata("kasaId")}>
          <select
            id="kasaId"
            name="kasaId"
            defaultValue={varsayilanKasaId ?? kasalar[0]?.id ?? ""}
            className={ALAN_SINIFI}
            required
          >
            {kasalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kod} — {k.ad} ({para(k.bakiye)})
              </option>
            ))}
          </select>
        </Alan>

        <Alan ad="tarih" etiket="Tarih" zorunlu hata={hata("tarih")}>
          <input
            id="tarih"
            name="tarih"
            type="date"
            defaultValue={varsayilanTarih}
            className={ALAN_SINIFI}
            required
          />
        </Alan>

        <Alan ad="tutar" etiket="Tutar" zorunlu hata={hata("tutar")}>
          <input
            id="tutar"
            name="tutar"
            inputMode="decimal"
            placeholder="0,00"
            className={cn(ALAN_SINIFI, "text-right font-mono text-[0.9375rem]")}
            required
          />
        </Alan>

        <Alan ad="belgeNo" etiket="Belge No" hata={hata("belgeNo")}>
          <input id="belgeNo" name="belgeNo" maxLength={40} className={ALAN_SINIFI} />
        </Alan>

        {tur === "CIKIS" ? (
          <Alan
            ad="masrafTuru"
            etiket="Masraf Türü"
            hata={hata("masrafTuru")}
            ipucu="Gider raporunda gruplamak için."
          >
            <ListeVeyaYaz name="masrafTuru" secenekler={masraflar} maxLength={80} />
          </Alan>
        ) : null}

        <CariSecici secili={cari} onSec={setCari} />

        <Alan ad="aciklama" etiket="Açıklama" zorunlu hata={hata("aciklama")} genis>
          <input
            id="aciklama"
            name="aciklama"
            maxLength={300}
            required
            placeholder="Örn: Kasa devir farkı, yakıt gideri…"
            className={ALAN_SINIFI}
          />
        </Alan>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" disabled={bekliyor || kasalar.length === 0}>
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

/** Cari bağı zorunlu değil: kasa hareketi her zaman bir cariye ait olmayabilir. */
function CariSecici({
  secili,
  onSec,
}: {
  secili: CariAdayi | null
  onSec: (c: CariAdayi | null) => void
}) {
  const [q, setQ] = useState("")
  const [adaylar, setAdaylar] = useState<CariAdayi[]>([])
  const [ariyor, setAriyor] = useState(false)

  useEffect(() => {
    let iptal = false
    if (secili || q.trim().length < 2) {
      // setState effect gövdesinde senkron çağrılmıyor (cascading render uyarısı).
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
      const sonuc = await kasaCariAra(q)
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
        <span className="form-etiket">Cari (isteğe bağlı)</span>
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
        Cari (isteğe bağlı)
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

function YonDugmesi({
  secili,
  onClick,
  renk,
  ikon,
  etiket,
}: {
  secili: boolean
  onClick: () => void
  renk: "basari" | "tehlike"
  ikon: React.ReactNode
  etiket: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={secili}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-sm border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
        secili
          ? renk === "basari"
            ? "border-basari/40 bg-basari-yumusak text-basari"
            : "border-tehlike/40 bg-tehlike-yumusak text-tehlike"
          : "border-border text-muted-foreground hover:bg-accent"
      )}
    >
      {ikon}
      {etiket}
    </button>
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
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
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
