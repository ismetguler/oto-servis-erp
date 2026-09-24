import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BaskiSayfasi } from "@/components/baski/baski-sablonu"
import { FaturaGovdesi } from "@/components/baski/fatura-govdesi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { evrakDetayiGetir } from "@/app/(panel)/evrak/satis/veri"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Tevkifatlı Fatura" }
export const dynamic = "force-dynamic"

/**
 * TEVKİFATLI FATURA (11.8) — Servis Fatura + KDV satırının altında tevkifat
 * oranı/kodu ve tevkifat sonrası "Ödenecek Tutar" ayrıca gösterilir.
 * `Evrak.tevkifatKodu`/`tevkifatOrani` elle girilen alanlar (gerçek e-Fatura
 * tevkifat kodu listesi/entegrasyonu kapsam dışı — 6.3'teki Sanal POS
 * placeholder deseniyle aynı mantık). Oran boşsa (0) blok yine gösterilir,
 * yalnız kesinti 0 çıkar — form serviste hazır tutulup elle doldurulabilsin.
 */
export default async function TevkifatliFaturaBaskisi({
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
        baslik="Tevkifatlı Fatura"
        kullaniciAdi={kullanici.tamAd}
        gosterTevkifat
      />
    </BaskiSayfasi>
  )
}
