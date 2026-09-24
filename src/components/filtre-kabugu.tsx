"use client"

import { useState } from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * FİLTRE KABUĞU — mobilde filtreleri katlar
 *
 * ERP filtre çubukları 4-7 alanlı; telefonda hepsi alt alta dizilince
 * listeyi ekrandan aşağı itiyordu. md ALTINDA filtreler "Filtreler"
 * düğmesinin arkasında duruyor, md ÜSTÜNDE hiç değişmiyor (düğme bile
 * çizilmiyor). Filtre formunun kendisi sunucu bileşeni olarak kalıyor,
 * buraya `children` olarak geçiyor.
 *
 * `filtreliMi` doğruysa (kullanıcı bir filtre uygulamışsa) panel mobilde de
 * açık başlar — yoksa "neden 3 kayıt görüyorum" sorusu doğuyor.
 */
export function FiltreKabugu({
  children,
  filtreliMi = false,
}: {
  children: React.ReactNode
  filtreliMi?: boolean
}) {
  const [acik, setAcik] = useState(filtreliMi)

  return (
    <>
      <div className="yazdirma-disi border-b border-border bg-card px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setAcik((o) => !o)}
          aria-expanded={acik}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-1 text-[0.8125rem] font-medium"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
            Filtreler
            {filtreliMi ? (
              <span className="rounded-sm bg-primary/10 px-1.5 py-px text-[0.6875rem] font-semibold text-primary">
                etkin
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              acik && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </div>

      <div className={cn(!acik && "hidden", "md:block")}>{children}</div>
    </>
  )
}
