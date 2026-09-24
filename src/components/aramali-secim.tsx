"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Yazarak aranan seçim kutusu (combobox).
 *
 * Neden: kabul/araç/sipariş formlarındaki araç ve cari seçimleri düz
 * `<select>` idi — yüzlerce plaka/cari arasında kaydırarak aramak zordu.
 * Bu kutuya plaka, ünvan, kod, telefon… ne yazılırsa anında süzülür.
 * Türkçe harf ve büyük/küçük harf duyarsız ("ismet" → "İSMET", "34abc" →
 * "34 ABC" bulur). Klavye: ↑↓ gez, Enter seç, Esc kapat.
 *
 * Forma giden değer `name`'li gizli input'tadır — FormData akışı aynı kalır.
 * Kontrollü (`value`+`onChange`) veya kontrolsüz (`defaultValue`) kullanılır.
 */

export type AramaliSecenek = {
  value: string
  /** Kutuda ve listede görünen ana metin. */
  etiket: string
  /** Listede ana metnin altında soluk gösterilen bilgi (kod, telefon…). */
  aciklama?: string
  /** Aramaya dahil edilen ama gösterilmeyen ek metinler. */
  aramaMetni?: string
}

type Props = {
  name: string
  secenekler: AramaliSecenek[]
  value?: string
  defaultValue?: string
  onChange?: (deger: string) => void
  placeholder?: string
  bosEtiket?: string
  className?: string
  /** Listede aynı anda gösterilecek en fazla satır (performans). */
  enFazla?: number
}

// Türkçe karakterleri ve boşlukları sadeleştir: "İstanbul 34 ABC" → "istanbul34abc"
export function aramaIcinSadelestir(metin: string) {
  return metin
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s\-./()]/g, "")
}

export function AramaliSecim({
  name,
  secenekler,
  value,
  defaultValue = "",
  onChange,
  placeholder = "Yazarak arayın…",
  bosEtiket,
  className,
  enFazla = Infinity,
}: Props) {
  const kontrollu = value !== undefined
  const [icDeger, setIcDeger] = useState(defaultValue)
  const deger = kontrollu ? value : icDeger

  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState("")
  const [vurgu, setVurgu] = useState(0)
  const kapRef = useRef<HTMLDivElement>(null)
  const girdiRef = useRef<HTMLInputElement>(null)
  const listeRef = useRef<HTMLUListElement>(null)
  const listeId = useId()

  const secili = useMemo(
    () => secenekler.find((s) => s.value === deger) ?? null,
    [secenekler, deger]
  )

  // Arama indeksini bir kez hazırla — her tuşta yeniden sadeleştirme yok.
  const indeks = useMemo(
    () =>
      secenekler.map((s) => ({
        s,
        metin: aramaIcinSadelestir(`${s.etiket} ${s.aciklama ?? ""} ${s.aramaMetni ?? ""}`),
        basi: aramaIcinSadelestir(s.etiket),
      })),
    [secenekler]
  )

  const { sonuclar, toplam } = useMemo(() => {
    const kelimeler = arama.split(/\s+/).map(aramaIcinSadelestir).filter(Boolean)
    if (kelimeler.length === 0) {
      return { sonuclar: indeks.slice(0, enFazla).map((x) => x.s), toplam: indeks.length }
    }
    // Her kelime bir yerde geçmeli; etiketin başıyla eşleşenler öne gelir.
    const bulunan = indeks.filter((x) => kelimeler.every((k) => x.metin.includes(k)))
    const ilk = kelimeler[0]
    bulunan.sort((a, b) => Number(b.basi.startsWith(ilk)) - Number(a.basi.startsWith(ilk)))
    return { sonuclar: bulunan.slice(0, enFazla).map((x) => x.s), toplam: bulunan.length }
  }, [arama, indeks, enFazla])

  // Dışarı tıklanınca kapat.
  useEffect(() => {
    if (!acik) return
    function disari(olay: PointerEvent) {
      if (!kapRef.current?.contains(olay.target as Node)) kapat()
    }
    document.addEventListener("pointerdown", disari)
    return () => document.removeEventListener("pointerdown", disari)
  }, [acik])

  // Vurgulanan satırı görünür tut.
  useEffect(() => {
    if (!acik) return
    listeRef.current
      ?.querySelector<HTMLElement>(`[data-indeks="${vurgu}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [vurgu, acik])

  function ac() {
    if (acik) return
    setArama("")
    const i = sonuclarIcinSeciliIndeks()
    setVurgu(i)
    setAcik(true)
  }

  function sonuclarIcinSeciliIndeks() {
    const i = secenekler.slice(0, enFazla).findIndex((s) => s.value === deger)
    return i < 0 ? 0 : i + (bosEtiket ? 1 : 0)
  }

  function kapat() {
    setAcik(false)
    setArama("")
  }

  function sec(yeni: string) {
    if (!kontrollu) setIcDeger(yeni)
    if (yeni !== deger) onChange?.(yeni)
    kapat()
  }

  // Boş seçenek (varsa) listenin başında, arama yapılmıyorken görünür.
  const bosGorunur = Boolean(bosEtiket) && arama.trim() === ""
  const satirSayisi = sonuclar.length + (bosGorunur ? 1 : 0)

  function tus(olay: React.KeyboardEvent<HTMLInputElement>) {
    if (olay.key === "ArrowDown") {
      olay.preventDefault()
      if (!acik) return ac()
      setVurgu((v) => Math.min(v + 1, satirSayisi - 1))
    } else if (olay.key === "ArrowUp") {
      olay.preventDefault()
      setVurgu((v) => Math.max(v - 1, 0))
    } else if (olay.key === "Enter") {
      if (!acik) return
      olay.preventDefault() // formu göndermesin
      if (bosGorunur && vurgu === 0) return sec("")
      const s = sonuclar[vurgu - (bosGorunur ? 1 : 0)]
      if (s) sec(s.value)
    } else if (olay.key === "Escape") {
      if (acik) {
        olay.preventDefault()
        kapat()
      }
    } else if (olay.key === "Tab") {
      kapat()
    }
  }

  return (
    <div ref={kapRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={deger} />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={girdiRef}
          id={name}
          type="text"
          role="combobox"
          aria-expanded={acik}
          aria-controls={listeId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={secili ? secili.etiket : placeholder}
          value={acik ? arama : (secili?.etiket ?? "")}
          onFocus={ac}
          onClick={ac}
          onChange={(e) => {
            setArama(e.target.value)
            setVurgu(0)
            if (!acik) setAcik(true)
          }}
          onKeyDown={tus}
          className={cn(
            "h-8 w-full truncate rounded-sm border border-input bg-background pl-7 pr-12 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
            acik && secili && "placeholder:text-foreground/60"
          )}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
          {deger && bosEtiket !== undefined ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Seçimi temizle"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => sec("")}
              className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Listeyi aç"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => (acik ? kapat() : (girdiRef.current?.focus(), ac()))}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", acik && "rotate-180")} />
          </button>
        </div>
      </div>

      {acik ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
          <ul ref={listeRef} id={listeId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {bosGorunur ? (
              <Satir
                indeks={0}
                vurgulu={vurgu === 0}
                secili={deger === ""}
                onVurgu={setVurgu}
                onSec={() => sec("")}
              >
                <span className="text-muted-foreground">{bosEtiket}</span>
              </Satir>
            ) : null}
            {sonuclar.map((s, i) => {
              const indeks = i + (bosGorunur ? 1 : 0)
              return (
                <Satir
                  key={s.value}
                  indeks={indeks}
                  vurgulu={vurgu === indeks}
                  secili={s.value === deger}
                  onVurgu={setVurgu}
                  onSec={() => sec(s.value)}
                >
                  <span className="block truncate font-medium">{s.etiket}</span>
                  {s.aciklama ? (
                    <span className="block truncate text-[0.75rem] text-muted-foreground">
                      {s.aciklama}
                    </span>
                  ) : null}
                </Satir>
              )
            })}
            {sonuclar.length === 0 ? (
              <li className="px-3 py-3 text-center text-[0.8125rem] text-muted-foreground">
                &quot;{arama}&quot; ile eşleşen kayıt yok
              </li>
            ) : null}
          </ul>
          {toplam > sonuclar.length ? (
            <div className="border-t px-3 py-1.5 text-[0.7rem] text-muted-foreground">
              {toplam} kayıttan ilk {sonuclar.length} gösteriliyor — daraltmak için yazmaya devam edin
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Satir({
  indeks,
  vurgulu,
  secili,
  onVurgu,
  onSec,
  children,
}: {
  indeks: number
  vurgulu: boolean
  secili: boolean
  onVurgu: (i: number) => void
  onSec: () => void
  children: React.ReactNode
}) {
  return (
    <li
      role="option"
      aria-selected={secili}
      data-indeks={indeks}
      // Girdiden odak kaçmasın diye mousedown engelleniyor.
      onPointerDown={(e) => e.preventDefault()}
      onPointerMove={() => !vurgulu && onVurgu(indeks)}
      onClick={onSec}
      className={cn(
        "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[0.8125rem]",
        vurgulu && "bg-accent text-accent-foreground"
      )}
    >
      <Check className={cn("size-3.5 shrink-0 text-primary", !secili && "invisible")} />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}
