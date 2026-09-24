import type { Metadata } from "next"

import { siparisCarileriGetir } from "../veri"
import { VerilenFormu } from "@/components/siparis/verilen-formu"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Sipariş" }
export const dynamic = "force-dynamic"

/** Yeni verilen sipariş. Sipariş no otomatik üretilir (kaydedince). */
export default async function YeniVerilenSiparis() {
  await yetkiliOturum("siparis", "ekle")
  const cariler = await siparisCarileriGetir()

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-[1rem] font-semibold">Yeni Verilen Sipariş</h1>
      <div className="panel p-4">
        <VerilenFormu cariler={cariler} />
      </div>
    </div>
  )
}
