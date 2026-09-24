import { DURUM_ADI } from "@/app/(panel)/cek-senet/veri"
import type { CekSenetDurum } from "@/generated/prisma/enums"

/** Durum rozeti — liste ve kart aynı renk dilini kullansın diye tek yerde. */
export function DurumRozeti({ durum }: { durum: CekSenetDurum }) {
  const renk =
    durum === "TAHSIL_EDILDI" || durum === "ODENDI"
      ? "bg-basari-yumusak text-basari"
      : durum === "KARSILIKSIZ"
        ? "bg-tehlike-yumusak text-tehlike"
        : durum === "TAHSILDE"
          ? "bg-uyari-yumusak text-uyari"
          : "bg-muted text-muted-foreground"

  return (
    <span className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[0.75rem] ${renk}`}>
      {DURUM_ADI[durum]}
    </span>
  )
}
