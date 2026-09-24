import type { EvrakDurum } from "@/generated/prisma/enums"

export const EVRAK_DURUM_ADI: Record<EvrakDurum, string> = {
  TASLAK: "Taslak",
  KESILDI: "Kesildi",
  IPTAL: "İptal",
}

/** Durum rozeti — Depo Transferi'ndeki `TransferDurumRozeti` deseninin aynısı. */
export function EvrakDurumRozeti({ durum }: { durum: EvrakDurum }) {
  const renk =
    durum === "KESILDI"
      ? "bg-basari-yumusak text-basari"
      : durum === "IPTAL"
        ? "bg-tehlike-yumusak text-tehlike"
        : "bg-uyari-yumusak text-uyari"

  return (
    <span className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[0.75rem] ${renk}`}>
      {EVRAK_DURUM_ADI[durum]}
    </span>
  )
}
