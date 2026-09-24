import { Suspense } from "react"

import { BaskiDonemBandi } from "@/components/rapor/baski-donem-bandi"
import { prisma } from "@/lib/prisma"

/**
 * RAPORLAR — ORTAK BASKI BAŞLIĞI
 *
 * Ekranda hiçbir şey değişmez; bu düzen yalnız KÂĞIT için var.
 * `/cari/mizan` ve `/cari/[id]/ekstre` çıktılarında firma ünvanı ve dönem
 * zaten yazıyordu, Raporlar grubundaki 33 raporda yazmıyordu — kâğıda
 * alınan döküm "kimin, hangi dönem raporu" bilgisini taşımıyordu.
 * Her sayfaya ayrı ayrı kopyalamak yerine düzen katmanına eklendi.
 */
export default async function RaporDuzeni({ children }: { children: React.ReactNode }) {
  const firma = await prisma.firma.findFirst({ select: { unvan: true } })

  return (
    <>
      {firma?.unvan ? (
        <div className="yazdirma-sadece px-4 pt-2 text-[0.9375rem] font-semibold">
          {firma.unvan}
        </div>
      ) : null}
      <Suspense fallback={null}>
        <BaskiDonemBandi />
      </Suspense>
      {children}
    </>
  )
}
