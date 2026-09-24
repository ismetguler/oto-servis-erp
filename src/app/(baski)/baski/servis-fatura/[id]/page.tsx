import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BaskiSayfasi } from "@/components/baski/baski-sablonu"
import { FaturaGovdesi } from "@/components/baski/fatura-govdesi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { evrakDetayiGetir } from "@/app/(panel)/evrak/satis/veri"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Servis Fatura" }
export const dynamic = "force-dynamic"

const BASLIKLAR: Record<string, string> = {
  SATIS: "Satış Faturası",
  SERVIS: "Servis Faturası",
  PERAKENDE: "Satış Faturası",
  ALIS: "Alış Faturası",
}

/**
 * SERVİS FATURA (11.8) — normal satış/alış faturası çıktısı, `FaturaGovdesi`nin
 * hiçbir ek bloğu (irsaliye/tevkifat/iade referansı) AÇILMADAN kullanıldığı
 * en yalın hali. Başlık evrak türüne göre değişir (Satış/Servis/Alış) ama
 * gövde tek — 4 fatura şablonunun ortak temeli budur.
 *
 * BAŞLIK NEDEN SADECE `tur`'a BAKMIYOR (adım 11.10): kabulden dönüştürülen
 * fatura `EvrakTur.SERVIS` değil `SATIS` olarak kaydediliyor (adım 9.2) —
 * kesinleştirme/iptal/stok mantığı satış faturasınınkiyle birebir aynı
 * olduğu için ayrı bir tür dalı açılmamıştı. Sonuçta bir servis işinin
 * çıktısı "SATIŞ FATURASI" başlığıyla basılıyordu. Ayırt eden asıl bilgi
 * `kabulId`: kabule bağlı fatura, türü ne olursa olsun servis faturasıdır.
 */
export default async function ServisFaturaBaskisi({
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
        <YazdirDugmesi etiket="Faturayı Yazdır" />
      </div>
      <FaturaGovdesi
        evrak={evrak}
        baslik={
          evrak.kabulId ? BASLIKLAR.SERVIS : (BASLIKLAR[evrak.tur] ?? "Fatura")
        }
        kullaniciAdi={kullanici.tamAd}
        gosterArac={!!evrak.kabulId}
      />
    </BaskiSayfasi>
  )
}
