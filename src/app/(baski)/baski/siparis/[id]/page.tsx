import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BaskiSayfasi } from "@/components/baski/baski-sablonu"
import { BelgeGovdesi } from "@/components/baski/belge-govdesi"
import { SIPARIS_DURUM_ADI } from "@/components/siparis/durum-rozeti"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Sipariş Formu" }
export const dynamic = "force-dynamic"

/**
 * SİPARİŞ FORMU (11.9) — Alınan ve Verilen sipariş için TEK şablon.
 *
 * 9.6'daki "bilinçli kod tekrarı" deseni BURADA UYGULANMADI, gerekçesi:
 * orada tekrarlanan şey iş MANTIĞIYDI (alınan sipariş satış fiyatı önerir,
 * verilen alış fiyatı; ileride ayrışabilirler). Burada ise basılan şey aynı
 * `Siparis`/`SiparisKalem` kaydı — okuma yardımcısı `siparisDetayiGetir`
 * bile 9.6'da ortaklaştırılmıştı. İki kâğıt arasındaki fark yalnız iki
 * kelime: başlık ("ALINAN"/"VERİLEN") ve karşı tarafın etiketi
 * ("Müşteri"/"Tedarikçi"). Tek route, `tip` alanından okunuyor.
 *
 * Faturadan (11.8) ayırt edici noktası kalem tablosundaki `sevkMiktar`:
 * "Sevk" ve "Kalan" sütunları — sipariş bir SÖZ belgesi, ne kadarının
 * teslim edildiği kâğıtta görünmeli (`gosterSevk`).
 */
export default async function SiparisBaskisi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("siparis", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const siparis = await prisma.siparis.findUnique({
    where: { id: kayitId },
    include: {
      cari: {
        select: {
          unvan: true,
          vergiNo: true,
          vergiDair: true,
          adres: true,
          il: true,
          ilce: true,
          telefon: true,
          gsm: true,
          yetkili: true,
        },
      },
      kalemler: { orderBy: { sira: "asc" } },
    },
  })
  if (!siparis || siparis.silindi) notFound()

  const alinan = siparis.tip === "ALINAN"

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Siparişi Yazdır" />
      </div>

      <BelgeGovdesi
        baslik={alinan ? "Alınan Sipariş Formu" : "Verilen Sipariş Formu"}
        belgeNo={siparis.siparisNo}
        durumAdi={SIPARIS_DURUM_ADI[siparis.durum]}
        ustAlanlar={[
          { etiket: "Sipariş Tarihi", deger: tarih(siparis.tarih) },
          {
            etiket: "Teslim Tarihi",
            deger: siparis.teslimTarihi ? tarih(siparis.teslimTarihi) : null,
          },
        ]}
        cariEtiketi={alinan ? "Müşteri / Ünvan" : "Tedarikçi / Ünvan"}
        cari={siparis.cari}
        kalemler={siparis.kalemler}
        aciklama={siparis.aciklama}
        araToplam={siparis.araToplam}
        kdvToplam={siparis.kdvToplam}
        genelToplam={siparis.genelToplam}
        gosterSevk
        altNot={
          alinan
            ? "Yukarıdaki kalemler sipariş olarak kaydedilmiştir; sevk edilen miktarlar faturaya dönüştürüldükçe güncellenir."
            : "Yukarıdaki kalemlerin belirtilen teslim tarihine kadar sevk edilmesi rica olunur."
        }
        kullaniciAdi={kullanici.tamAd}
      />
    </BaskiSayfasi>
  )
}
