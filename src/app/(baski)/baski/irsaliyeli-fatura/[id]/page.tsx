import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BaskiSayfasi } from "@/components/baski/baski-sablonu"
import { FaturaGovdesi } from "@/components/baski/fatura-govdesi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { evrakDetayiGetir } from "@/app/(panel)/evrak/satis/veri"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "İrsaliyeli Fatura" }
export const dynamic = "force-dynamic"

/**
 * İRSALİYELİ FATURA (11.8) — Servis Fatura ile AYNI kalem/tutar dökümü,
 * üstüne irsaliye bilgileri (no/tarih/taşıyıcı-plaka/sevk adresi) eklenir.
 * Ayrı bir evrak/tablo AÇILMADI — Selpar'da da bu ikisi tek belge, `Evrak`
 * üstündeki irsaliye alanları (adım 11.8 migration) doluysa anlamlı olur;
 * boşsa alanlar "—" görünür, şablon ENGELLENMEZ (elle doldurulup basılabilsin).
 */
export default async function IrsaliyeliFaturaBaskisi({
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
        baslik="İrsaliyeli Fatura"
        kullaniciAdi={kullanici.tamAd}
        gosterIrsaliye
      />
    </BaskiSayfasi>
  )
}
