import { Suspense } from "react"

import { BaskiDonemBandi } from "@/components/rapor/baski-donem-bandi"
import { prisma } from "@/lib/prisma"

/**
 * AYARLAR — ORTAK BASKI BAŞLIĞI
 *
 * Ekranda hiçbir şey değişmez; bu düzen yalnız KÂĞIT için var.
 * Ayarlar grubundaki ekranların ("Kim Ne Yaptı" log dökümü, kullanıcı
 * listesi) "Yazdır" düğmesi var ama çıktı "hangi firma, hangi dönem"
 * bilgisini taşımıyordu — Raporlar (`rapor/layout.tsx`, TEST-03) ve
 * Personel (`personel/layout.tsx`, TEST-06 BULGU-7) gruplarında kapatılan
 * aynı boşluk.
 *
 * Dönem satırı `yalnizVarsa` ile isteniyor: firma/tanım/kullanıcı ekranlarının
 * adres çubuğunda tarih aralığı yok, oraya varsayılan bir aralık basmak
 * yanıltırdı. `/ayar/log` adres çubuğunda `bas`/`bit` taşır — orada bant çıkar.
 */
export default async function AyarDuzeni({ children }: { children: React.ReactNode }) {
  const firma = await prisma.firma.findFirst({ select: { unvan: true } })

  return (
    <>
      {firma?.unvan ? (
        <div className="yazdirma-sadece px-4 pt-2 text-[0.9375rem] font-semibold">
          {firma.unvan}
        </div>
      ) : null}
      <Suspense fallback={null}>
        <BaskiDonemBandi yalnizVarsa />
      </Suspense>
      {children}
    </>
  )
}
