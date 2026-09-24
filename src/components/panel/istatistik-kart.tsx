import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type KartTonu = "notr" | "bilgi" | "basari" | "uyari" | "tehlike"

const TON_SINIFLARI: Record<KartTonu, { serit: string; ikon: string }> = {
  notr: { serit: "bg-muted-foreground/40", ikon: "text-muted-foreground bg-muted" },
  bilgi: { serit: "bg-bilgi", ikon: "text-bilgi bg-bilgi-yumusak" },
  basari: { serit: "bg-basari", ikon: "text-basari bg-basari-yumusak" },
  uyari: { serit: "bg-uyari", ikon: "text-uyari bg-uyari-yumusak" },
  tehlike: { serit: "bg-tehlike", ikon: "text-tehlike bg-tehlike-yumusak" },
}

type Props = {
  baslik: string
  deger: string | number
  altBilgi?: string
  ikon: LucideIcon
  ton?: KartTonu
  yol?: string
}

/**
 * Ana sayfadaki sayı kartı. Selpar'ın 12 kartlık panosunun karşılığı:
 * sol kenarda durum rengi şeridi, büyük rakam, altında açıklama.
 */
export function IstatistikKart({
  baslik,
  deger,
  altBilgi,
  ikon: Ikon,
  ton = "notr",
  yol,
}: Props) {
  const ton_ = TON_SINIFLARI[ton]

  const icerik = (
    <div className="relative flex h-full items-start gap-3 overflow-hidden p-3.5 pl-4">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", ton_.serit)}
      />
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded",
          ton_.ikon
        )}
      >
        <Ikon className="size-[1.125rem]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="rakam text-[1.375rem] font-bold leading-none tracking-tight">
            {deger}
          </span>
        </div>
        <div className="mt-1.5 truncate text-[0.8125rem] font-medium text-foreground/80">
          {baslik}
        </div>
        {altBilgi ? (
          <div className="mt-0.5 truncate text-[0.75rem] text-muted-foreground">
            {altBilgi}
          </div>
        ) : null}
      </div>
      {yol ? (
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </div>
  )

  if (!yol) return <div className="panel">{icerik}</div>

  return (
    <Link
      href={yol}
      className="panel group transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {icerik}
    </Link>
  )
}
