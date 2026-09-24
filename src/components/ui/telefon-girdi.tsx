"use client"

import { useState } from "react"

import { telefonFormatla } from "@/lib/telefon"
import { cn } from "@/lib/utils"

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

/**
 * Telefon girişi: kullanıcı sadece rakamları yazar, başına `+90` ve
 * boşluk/parantezler otomatik eklenir — raconu (552) 213 33 81 biçiminde.
 * `name` alanına giden değer de aynı biçimde tam metindir, ayrı bir ülke
 * kodu alanı yok.
 */
export function TelefonGirdi({
  name,
  id,
  defaultValue,
  className,
  ...kalan
}: Omit<React.ComponentProps<"input">, "defaultValue" | "onChange" | "type" | "inputMode"> & {
  name: string
  defaultValue?: string | null
}) {
  const [deger, setDeger] = useState(() => telefonFormatla(defaultValue ?? ""))

  return (
    <input
      id={id ?? name}
      name={name}
      type="tel"
      inputMode="tel"
      value={deger}
      onChange={(olay) => setDeger(telefonFormatla(olay.target.value))}
      placeholder="+90 (5XX) XXX XX XX"
      className={cn(ALAN_SINIFI, className)}
      {...kalan}
    />
  )
}
