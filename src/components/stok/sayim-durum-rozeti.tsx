import type { SayimDurum } from "@/generated/prisma/enums"

export const SAYIM_DURUM_ADI: Record<SayimDurum, string> = {
  TASLAK: "Taslak",
  ONAYLANDI: "Onaylandı",
  IPTAL: "İptal",
}

/** Durum rozeti — Çek-Senet'teki `DurumRozeti` deseninin aynısı. */
export function SayimDurumRozeti({ durum }: { durum: SayimDurum }) {
  const renk =
    durum === "ONAYLANDI"
      ? "bg-basari-yumusak text-basari"
      : durum === "IPTAL"
        ? "bg-tehlike-yumusak text-tehlike"
        : "bg-uyari-yumusak text-uyari"

  return (
    <span className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[0.75rem] ${renk}`}>
      {SAYIM_DURUM_ADI[durum]}
    </span>
  )
}
