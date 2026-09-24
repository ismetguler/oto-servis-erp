import { MarkaLogo } from "@/components/marka-logo"
import { cn } from "@/lib/utils"

/**
 * FİRMA LOGOSU — Ayarlar > Firma'dan logo yüklenmişse onu (base64 data URI),
 * yüklenmemişse yerleşik `MarkaLogo` işaretini gösterir. Sol menü ve giriş
 * ekranı bunu kullanır. `className` boyutu verir (`size-7` gibi).
 */
export function FirmaLogosu({
  logo,
  className,
}: {
  logo?: string | null
  className?: string
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- base64 data URI; next/image gereksiz
      <img
        src={logo}
        alt="Firma logosu"
        className={cn("object-contain", className)}
      />
    )
  }
  return <MarkaLogo className={className} />
}
