import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { siparisDetayiGetir, siparisCarileriGetir } from "../../veri"
import { VerilenFormu } from "@/components/siparis/verilen-formu"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Siparişi Düzenle" }
export const dynamic = "force-dynamic"

export default async function VerilenSiparisDuzenle({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("siparis", "duzelt")
  const { id } = await params
  const siparis = await siparisDetayiGetir(Number(id))
  if (!siparis || siparis.silindi || siparis.tip !== "VERILEN") notFound()

  const cariler = await siparisCarileriGetir()

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-[1rem] font-semibold">{siparis.siparisNo} — Düzenle</h1>
      <div className="panel p-4">
        <VerilenFormu
          cariler={cariler}
          baslangic={{
            id: siparis.id,
            cariId: siparis.cariId,
            tarih: siparis.tarih.toISOString().slice(0, 10),
            teslimTarihi: siparis.teslimTarihi ? siparis.teslimTarihi.toISOString().slice(0, 10) : "",
            aciklama: siparis.aciklama ?? "",
          }}
        />
      </div>
    </div>
  )
}
