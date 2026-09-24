import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { verilenFaturayaDonustur } from "../../actions"
import { siparisDetayiGetir } from "@/app/(panel)/siparis/alinan/veri"
import { FaturayaDonusturFormu, type DonusturSatiri } from "@/components/siparis/faturaya-donustur-formu"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Faturaya Dönüştür" }
export const dynamic = "force-dynamic"

export default async function VerilenFaturala({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("siparis", "duzelt")
  const { id } = await params
  const siparis = await siparisDetayiGetir(Number(id))
  if (!siparis || siparis.silindi || siparis.tip !== "VERILEN") notFound()
  if (siparis.durum !== "ONAYLANDI" && siparis.durum !== "KISMI_SEVK") notFound()

  const satirlar: DonusturSatiri[] = siparis.kalemler
    .map((k) => {
      const miktar = Number(k.miktar.toString())
      const sevk = Number(k.sevkMiktar.toString())
      return {
        id: k.id,
        aciklama: k.aciklama,
        birim: k.birim,
        birimFiyat: Number(k.birimFiyat.toString()),
        kdvOrani: Number(k.kdvOrani.toString()),
        kalan: Math.max(0, miktar - sevk),
      }
    })
    .filter((s) => s.kalan > 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-[1rem] font-semibold">Faturaya Dönüştür — {siparis.siparisNo}</h1>
        <p className="text-[0.8125rem] text-muted-foreground">
          {siparis.cari.unvan} ({siparis.cari.kod}) · her satır için teslim alınacak miktarı girin, kalanı
          aşamaz. Kısmi teslim desteklenir.
        </p>
      </div>

      {satirlar.length === 0 ? (
        <p className="panel px-3 py-2 text-[0.8125rem] text-muted-foreground">
          Bu siparişin tüm satırları zaten tamamen teslim alınmış.
        </p>
      ) : (
        <FaturayaDonusturFormu
          siparisId={siparis.id}
          satirlar={satirlar}
          aksiyon={verilenFaturayaDonustur}
          hedefEtiket="Alış Faturası"
          geriYolu={`/siparis/verilen/${siparis.id}`}
        />
      )}
    </div>
  )
}
