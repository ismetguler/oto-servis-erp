import type { SiparisDurum } from "@/generated/prisma/enums"

export const SIPARIS_DURUM_ADI: Record<SiparisDurum, string> = {
  TASLAK: "Taslak",
  ONAYLANDI: "Onaylandı",
  KISMI_SEVK: "Kısmi Sevk",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
}

/** Durum rozeti — evrak modülündeki `EvrakDurumRozeti` deseninin aynısı. */
export function SiparisDurumRozeti({ durum }: { durum: SiparisDurum }) {
  const renk =
    durum === "TAMAMLANDI"
      ? "bg-basari-yumusak text-basari"
      : durum === "IPTAL"
        ? "bg-tehlike-yumusak text-tehlike"
        : durum === "KISMI_SEVK"
          ? "bg-bilgi-yumusak text-bilgi"
          : durum === "ONAYLANDI"
            ? "bg-basari-yumusak text-basari"
            : "bg-uyari-yumusak text-uyari"

  return (
    <span className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[0.75rem] ${renk}`}>
      {SIPARIS_DURUM_ADI[durum]}
    </span>
  )
}
