import Link from "next/link"
import { Search } from "lucide-react"

import {
  EKSPERTIZ_DURUM_ETIKETI,
  EKSPERTIZ_DURUMLARI,
} from "@/app/(panel)/servis/ekspertiz/sema"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Button } from "@/components/ui/button"

/**
 * Ekspertiz liste filtresi. Sunucu bileşeni — GET formu, durum URL'de
 * taşınıyor (projenin her yerindeki desen: filtre paylaşılabilir/yer
 * imlenebilir olsun).
 */
export function EkspertizFiltre({
  yol,
  q,
  durum,
  bas,
  bit,
}: {
  yol: string
  q: string
  durum: string
  bas: string
  bit: string
}) {
  const filtreliMi = Boolean(q || bas || bit || (durum && durum !== "hepsi"))

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action={yol}
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-[0.75rem] text-muted-foreground">Ara</span>
          <span className="relative">
            <Search
              className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Ekspertiz no, dosya no, poliçe, plaka, müşteri"
              className={`${ALAN} pl-8`}
            />
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.75rem] text-muted-foreground">Durum</span>
          <select name="durum" defaultValue={durum} className={ALAN}>
            <option value="hepsi">Hepsi</option>
            {EKSPERTIZ_DURUMLARI.map((d) => (
              <option key={d} value={d}>
                {EKSPERTIZ_DURUM_ETIKETI[d]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.75rem] text-muted-foreground">Başlangıç</span>
          <input type="date" name="bas" defaultValue={bas} className={ALAN} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.75rem] text-muted-foreground">Bitiş</span>
          <input type="date" name="bit" defaultValue={bit} className={ALAN} />
        </label>

        <Button type="submit" size="sm">
          Filtrele
        </Button>
        {filtreliMi ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={yol}>Temizle</Link>
          </Button>
        ) : null}
      </form>
    </FiltreKabugu>
  )
}

const ALAN =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
