import type { Metadata } from "next"

import { alisCarileriGetir } from "../veri"
import { AlisFormu } from "@/components/evrak/alis-formu"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Alış Faturası" }
export const dynamic = "force-dynamic"

/** Yeni alış faturası. Fatura no elle girilir (satıştaki karar burada da geçerli). */
export default async function YeniAlisFaturasi() {
  await yetkiliOturum("evrak", "ekle")
  const cariler = await alisCarileriGetir()

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-[1rem] font-semibold">Yeni Alış Faturası</h1>
      <div className="panel p-4">
        <AlisFormu cariler={cariler} />
      </div>
    </div>
  )
}
