"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Diğer formlardaki alan kutularıyla birebir aynı görünüm.
const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

type Props = {
  name: string
  secenekler: string[]
  defaultValue?: string
  placeholder?: string
  maxLength?: number
  required?: boolean
  className?: string
  /** Açılır listenin ilk (boş) satırının metni. */
  seciniz?: string
}

/**
 * "Listeden seç ya da elle yaz" alanı.
 *
 * Neden: eskiden bu alanlar `<input list=... >` + `<datalist>` idi. Telefon
 * tarayıcılarının çoğu datalist açılır listesini HİÇ göstermiyor — kullanıcı
 * listeden seçemiyor, yalnızca elle yazabiliyordu (İsmet telefonda araç
 * eklerken takıldı). Çözüm: her cihazda açılan gerçek bir `<select>` +
 * altında serbest yazım kutusu. Listeden seçilen değer kutuya yazılır,
 * kutu elle de düzenlenebilir. Forma giden alan `name`'li `<input>`.
 */
export function ListeVeyaYaz({
  name,
  secenekler,
  defaultValue = "",
  placeholder,
  maxLength,
  required,
  className,
  seciniz = "— listeden seç —",
}: Props) {
  const [deger, setDeger] = useState(defaultValue)

  return (
    <div className="flex flex-col gap-1.5">
      {secenekler.length > 0 && (
        <select
          aria-label="Listeden seç"
          className={cn(ALAN_SINIFI, className)}
          // Kutuya elle yazılan, listede olmayan bir değer varsa select boş görünür.
          value={secenekler.includes(deger) ? deger : ""}
          onChange={(e) => {
            if (e.target.value) setDeger(e.target.value)
          }}
        >
          <option value="">{seciniz}</option>
          {secenekler.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <input
        id={name}
        name={name}
        className={cn(ALAN_SINIFI, className)}
        value={deger}
        onChange={(e) => setDeger(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
      />
    </div>
  )
}
