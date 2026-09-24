"use client"

import Link from "next/link"
import { Download, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * RAPOR ARAÇLARI — yazdır / dışa aktar
 *
 * Selpar'daki her liste ve raporun üstünde bu ikisi var; muhasebeci dökümü
 * ya kâğıda alıyor ya Excel'e atıp kendi hesabını yapıyor. Tek bileşende
 * toplandı ki her ekranda aynı yerde, aynı görünsün.
 */

export function YazdirDugmesi({ etiket = "Yazdır" }: { etiket?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="yazdirma-disi"
      onClick={() => window.print()}
    >
      <Printer className="size-4" aria-hidden />
      {etiket}
    </Button>
  )
}

/**
 * Dışa aktarma sunucudaki bir adrese gider, tarayıcıda dosya üretilmez:
 * böylece ekranda görünen 50 satır değil, filtreye uyan TÜM kayıtlar iner
 * ve işlem `DISA_AKTAR` olarak loglanabilir.
 */
export function DisaAktarDugmesi({
  yol,
  etiket = "Excel'e Aktar",
}: {
  yol: string
  etiket?: string
}) {
  return (
    <Button variant="outline" size="sm" className="yazdirma-disi" asChild>
      <Link href={yol} prefetch={false}>
        <Download className="size-4" aria-hidden />
        {etiket}
      </Link>
    </Button>
  )
}
