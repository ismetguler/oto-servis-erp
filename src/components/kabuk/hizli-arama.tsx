"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { Modul } from "@/lib/yetki"
import { cn } from "@/lib/utils"

/**
 * HIZLI ARAMA + KLAVYE KISAYOLLARI (ADIM 12.7)
 *
 * Üst bardaki iki kutu (masaüstü `max-w-xs`, mobil büyüteç) 12.7'ye kadar
 * ölüydü — birer `Input`, yazınca hiçbir şey olmuyordu. Artık ikisi de bu
 * bileşendeki `CommandDialog`'u açıyor.
 *
 * - Arama SUNUCUDA (`/api/arama`); her tuşta 250 ms debounce, uçan istek
 *   `AbortController` ile iptal.
 * - `Ctrl/Cmd + K` her yerden açar (input içinde de). `Esc` kapatır,
 *   `↑/↓/Enter` cmdk'nın kendi gezinmesi.
 * - `g` sonra bir tuş: sık ekranlara atlar (Linear/GitHub kalıbı). Bir
 *   input/textarea içindeyken tetiklenmez; hedef modüle yetki yoksa no-op.
 * - Tarayıcının kendi kısayolları (Ctrl+T/W, F5…) EZİLMEZ.
 */

type AramaSonucu = {
  id: number
  baslik: string
  altbaslik?: string
  yol: string
}

type AramaGrubu = {
  anahtar: string
  baslik: string
  toplam: number
  sonuclar: AramaSonucu[]
  tumuYol: string
}

type Props = {
  acik: boolean
  acikDegistir: (acik: boolean) => void
  izinliModuller: Modul[]
}

/** `g` + tuş kısayolları: hedef ekran, tuş ve gereken modül. */
const GIT_KISAYOLLARI: { tus: string; ad: string; yol: string; modul: Modul }[] = [
  { tus: "k", ad: "Araç Kabul", yol: "/servis/kabul/yeni", modul: "kabul" },
  { tus: "t", ad: "Tahsilat Girişi", yol: "/tahsilat/yeni", modul: "tahsilat" },
  { tus: "a", ad: "Açık Onarımlar", yol: "/servis/acik", modul: "kabul" },
  { tus: "s", ad: "Stok Listesi", yol: "/stok", modul: "stok" },
]

function yazilabilirHedef(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof HTMLElement)) return false
  const etiket = hedef.tagName
  return (
    etiket === "INPUT" ||
    etiket === "TEXTAREA" ||
    etiket === "SELECT" ||
    hedef.isContentEditable
  )
}

export function HizliArama({
  acik,
  acikDegistir,
  izinliModuller = [],
}: Props) {
  const router = useRouter()
  const [metin, setMetin] = useState("")
  const [gruplar, setGruplar] = useState<AramaGrubu[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [yardimAcik, setYardimAcik] = useState(false)

  // --- global klavye: Ctrl/Cmd+K aç, "?" yardım, "g" + tuş git ---
  const gBekliyor = useRef(false)
  const gZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function elde(e: KeyboardEvent) {
      // Ctrl/Cmd + K — her yerden, input içinde de.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        acikDegistir(true)
        return
      }
      // Diğer kısayollar yalnızca çıplak tuşta ve yazı alanı dışındayken.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (yazilabilirHedef(e.target)) return

      if (e.key === "?") {
        e.preventDefault()
        setYardimAcik(true)
        return
      }

      if (gBekliyor.current) {
        const eslesme = GIT_KISAYOLLARI.find((k) => k.tus === e.key.toLowerCase())
        gBekliyor.current = false
        if (gZamanlayici.current) clearTimeout(gZamanlayici.current)
        if (eslesme && izinliModuller.includes(eslesme.modul)) {
          e.preventDefault()
          router.push(eslesme.yol)
        }
        return
      }

      if (e.key.toLowerCase() === "g") {
        gBekliyor.current = true
        if (gZamanlayici.current) clearTimeout(gZamanlayici.current)
        gZamanlayici.current = setTimeout(() => {
          gBekliyor.current = false
        }, 1200)
      }
    }

    window.addEventListener("keydown", elde)
    return () => {
      window.removeEventListener("keydown", elde)
      if (gZamanlayici.current) clearTimeout(gZamanlayici.current)
    }
  }, [acikDegistir, izinliModuller, router])

  // --- arama: debounce + AbortController ---
  useEffect(() => {
    const arama = metin.trim()
    const kontrol = new AbortController()
    const zaman = setTimeout(async () => {
      if (arama.length < 2) {
        setGruplar([])
        setYukleniyor(false)
        return
      }
      setYukleniyor(true)
      try {
        const yanit = await fetch(`/api/arama?q=${encodeURIComponent(arama)}`, {
          signal: kontrol.signal,
        })
        if (!yanit.ok) {
          setGruplar([])
          return
        }
        const veri = (await yanit.json()) as { gruplar: AramaGrubu[] }
        setGruplar(veri.gruplar ?? [])
      } catch (hata) {
        if ((hata as Error).name !== "AbortError") setGruplar([])
      } finally {
        setYukleniyor(false)
      }
    }, 250)

    return () => {
      clearTimeout(zaman)
      kontrol.abort()
    }
  }, [metin])

  // Panel kapanırken metni temizle — bir sonraki açılış boş başlasın.
  const paneliDegistir = useCallback(
    (yeni: boolean) => {
      if (!yeni) {
        setMetin("")
        setGruplar([])
      }
      acikDegistir(yeni)
    },
    [acikDegistir]
  )

  const git = useCallback(
    (yol: string) => {
      paneliDegistir(false)
      router.push(yol)
    },
    [paneliDegistir, router]
  )

  const aramaVar = metin.trim().length >= 2

  return (
    <>
      <Dialog open={acik} onOpenChange={paneliDegistir}>
        <DialogContent
          showCloseButton={false}
          className="top-1/4 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Hızlı arama</DialogTitle>
          <Command
            shouldFilter={false}
            className="flex w-full flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 text-popover-foreground"
          >
            <div className="border-b px-2 py-2">
              <CommandInput
                autoFocus
                value={metin}
                onValueChange={setMetin}
                placeholder="Plaka, cari, stok, kabul, evrak ara…"
              />
            </div>

            <CommandList className="max-h-[min(70vh,24rem)] overflow-y-auto overflow-x-hidden p-1">
              {aramaVar && yukleniyor && gruplar.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Aranıyor…
                </div>
              )}

              {aramaVar && !yukleniyor && gruplar.length === 0 && (
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  Sonuç bulunamadı
                </CommandEmpty>
              )}

              {!aramaVar && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  En az 2 karakter yazın
                </div>
              )}

              {gruplar.map((grup) => (
                <CommandGroup
                  key={grup.anahtar}
                  heading={
                    <span className="flex items-center justify-between px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>{grup.baslik}</span>
                      <span>{grup.toplam}</span>
                    </span>
                  }
                >
                  {grup.sonuclar.map((s) => (
                    <CommandItem
                      key={`${grup.anahtar}:${s.id}`}
                      value={`${grup.anahtar}:${s.id}`}
                      onSelect={() => git(s.yol)}
                      className={cn(
                        "flex cursor-pointer flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-sm",
                        "data-[selected=true]:bg-muted"
                      )}
                    >
                      <span className="font-medium">{s.baslik}</span>
                      {s.altbaslik && (
                        <span className="text-xs text-muted-foreground">
                          {s.altbaslik}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                  {grup.toplam > grup.sonuclar.length && (
                    <CommandItem
                      value={`${grup.anahtar}:tumu`}
                      onSelect={() => git(grup.tumuYol)}
                      className="cursor-pointer rounded-md px-2 py-1.5 text-xs text-primary data-[selected=true]:bg-muted"
                    >
                      Tümünü gör ({grup.toplam})
                    </CommandItem>
                  )}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog open={yardimAcik} onOpenChange={setYardimAcik}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Klavye kısayolları</DialogTitle>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Hızlı arama</span>
              <span><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> <Kbd>K</Kbd></span>
            </li>
            {GIT_KISAYOLLARI.map((k) => (
              <li key={k.tus} className="flex justify-between">
                <span className={cn(!izinliModuller.includes(k.modul) && "text-muted-foreground line-through")}>
                  {k.ad}
                </span>
                <span><Kbd>g</Kbd> <Kbd>{k.tus}</Kbd></span>
              </li>
            ))}
            <li className="flex justify-between">
              <span>Bu pencere</span>
              <span><Kbd>?</Kbd></span>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
      {children}
    </kbd>
  )
}
