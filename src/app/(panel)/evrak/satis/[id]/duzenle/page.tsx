import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { evrakDetayiGetir, satisCarileriGetir } from "../../veri"
import { EvrakFormu } from "@/components/evrak/evrak-formu"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Faturayı Düzenle" }
export const dynamic = "force-dynamic"

export default async function FaturaDuzenle({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("evrak", "duzelt")
  const { id } = await params
  const evrak = await evrakDetayiGetir(Number(id))
  if (!evrak || evrak.silindi || (evrak.tur !== "SATIS" && evrak.tur !== "IADE_SATIS")) notFound()

  const cariler = await satisCarileriGetir()

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-[1rem] font-semibold">{evrak.evrakNo} — Düzenle</h1>
      <div className="panel p-4">
        <EvrakFormu
          cariler={cariler}
          baslangic={{
            id: evrak.id,
            evrakNo: evrak.evrakNo,
            cariId: evrak.cariId,
            tarih: evrak.tarih.toISOString().slice(0, 10),
            vadeTarihi: evrak.vadeTarihi ? evrak.vadeTarihi.toISOString().slice(0, 10) : "",
            aciklama: evrak.aciklama ?? "",
            kaynakEvrakNo: evrak.kaynakEvrakNo ?? "",
            irsaliyeNo: evrak.irsaliyeNo ?? "",
            irsaliyeTarihi: evrak.irsaliyeTarihi ? evrak.irsaliyeTarihi.toISOString().slice(0, 10) : "",
            tasiyiciPlaka: evrak.tasiyiciPlaka ?? "",
            sevkAdresi: evrak.sevkAdresi ?? "",
            tevkifatKodu: evrak.tevkifatKodu ?? "",
            tevkifatOrani: evrak.tevkifatOrani ? evrak.tevkifatOrani.toString() : "",
          }}
          iade={evrak.tur === "IADE_SATIS"}
        />
      </div>
    </div>
  )
}
