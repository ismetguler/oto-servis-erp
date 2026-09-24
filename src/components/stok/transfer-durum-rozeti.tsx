import type { StokTransferDurum } from "@/generated/prisma/enums"

export const TRANSFER_DURUM_ADI: Record<StokTransferDurum, string> = {
  TASLAK: "Taslak",
  ONAYLANDI: "Onaylandı",
  IPTAL: "İptal",
  GERI_ALINDI: "Geri Alındı",
}

/** Durum rozeti — Sayım'daki `SayimDurumRozeti` deseninin aynısı. */
export function TransferDurumRozeti({ durum }: { durum: StokTransferDurum }) {
  const renk =
    durum === "ONAYLANDI"
      ? "bg-basari-yumusak text-basari"
      : durum === "IPTAL"
        ? "bg-tehlike-yumusak text-tehlike"
        : durum === "GERI_ALINDI"
          ? "bg-muted text-muted-foreground"
          : "bg-uyari-yumusak text-uyari"

  return (
    <span className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[0.75rem] ${renk}`}>
      {TRANSFER_DURUM_ADI[durum]}
    </span>
  )
}
