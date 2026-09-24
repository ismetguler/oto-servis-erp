import { Suspense } from "react"

import { BaskiDonemBandi } from "@/components/rapor/baski-donem-bandi"
import { prisma } from "@/lib/prisma"

/**
 * PERSONEL — ORTAK BASKI BAŞLIĞI
 *
 * Ekranda hiçbir şey değişmez; bu düzen yalnız KÂĞIT için var.
 * Personel grubundaki beş ekranın da "Yazdır" düğmesi var ama çıktı
 * "kimin, hangi dönem dökümü" bilgisini taşımıyordu — Raporlar grubunda
 * (`rapor/layout.tsx`) TEST-03'te kapatılan aynı boşluk. "Personel
 * Komisyonları" zaten Raporlar menüsünde de duruyor; iki menüden açılan
 * aynı ekranın çıktısı farklı olmasın.
 *
 * Dönem satırı `yalnizVarsa` ile isteniyor: liste ve kart ekranlarında
 * adres çubuğunda dönem yok, oraya varsayılan bir aralık basmak yanıltırdı.
 */
export default async function PersonelDuzeni({ children }: { children: React.ReactNode }) {
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
