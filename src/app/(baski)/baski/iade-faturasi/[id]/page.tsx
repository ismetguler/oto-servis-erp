import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BaskiSayfasi } from "@/components/baski/baski-sablonu"
import { FaturaGovdesi } from "@/components/baski/fatura-govdesi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { evrakDetayiGetir } from "@/app/(panel)/evrak/satis/veri"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "İade Faturası" }
export const dynamic = "force-dynamic"

/**
 * İADE FATURASI (11.8) — Servis Fatura ile aynı düzen + "Kaynak Evrak No"
 * belirgin gösterilir (hangi orijinal faturaya istinaden kesildiği, serbest
 * metin — bkz. `Evrak.kaynakEvrakNo`, canlı bir ilişki DEĞİL). Tutarlar
 * `Evrak`/`EvrakKalem`'deki KAYITLI değer neyse öyle basılır — ekstra ters
 * çevirme yok, işaret zaten kaydın kendi mantığında (bkz. 10.8 BA-BS raporu:
 * IADE_SATIS/IADE_ALIS kendi yönünden netlenir).
 */
export default async function IadeFaturasiBaskisi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("evrak", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const evrak = await evrakDetayiGetir(kayitId)
  if (!evrak || evrak.silindi) notFound()

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="İade Faturasını Yazdır" />
      </div>
      <FaturaGovdesi
        evrak={evrak}
        baslik={`İade Faturası${evrak.tur === "IADE_ALIS" ? " (Alış)" : ""}`}
        kullaniciAdi={kullanici.tamAd}
        gosterIadeRef
      />
    </BaskiSayfasi>
  )
}
