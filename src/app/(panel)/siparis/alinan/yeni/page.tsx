import type { Metadata } from "next"

import { siparisCarileriGetir } from "../veri"
import { SiparisFormu } from "@/components/siparis/siparis-formu"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Sipariş" }
export const dynamic = "force-dynamic"

/** Yeni alınan sipariş. Sipariş no otomatik üretilir (kaydedince). */
export default async function YeniSiparis() {
  await yetkiliOturum("siparis", "ekle")
  const cariler = await siparisCarileriGetir()

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-[1rem] font-semibold">Yeni Alınan Sipariş</h1>
      <div className="panel p-4">
        <SiparisFormu cariler={cariler} />
      </div>
    </div>
  )
}
