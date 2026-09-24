import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { kabulTahsilatlari, kabulTahsilatOzeti, ODEME_SEKLI_ADI, TUR_ADI } from "@/app/(panel)/tahsilat/veri"
import {
  BaskiAlan,
  BaskiAltBilgi,
  BaskiSayfasi,
  BelgeBasligi,
  FirmaBasligi,
} from "@/components/baski/baski-sablonu"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { miktar, para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Hesap Dökümü" }
export const dynamic = "force-dynamic"

/**
 * HESAP DÖKÜMÜ (11.7) — mali özet. Kabul Kartı'ndaki gibi kalem kalem
 * parça/işçilik dökümü YOK; muhasebeci/kasiyer için PARA döküm: genel
 * toplam, karta bağlı TÜM tahsilat/tediye fişleri (`Tahsilat.kabulId`,
 * 6.2'de kuruldu) ve kalan bakiye. Ekrandaki kabul kartının "Tahsilat"
 * kutusuyla aynı veriyi okuyor (`kabulTahsilatOzeti` / `kabulTahsilatlari`
 * — tahsilat modülünün kendi fonksiyonları, burada YENİDEN YAZILMADI).
 */
export default async function HesapDokumuBaskisi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const kabul = await prisma.kabul.findUnique({
    where: { id: kayitId },
    include: {
      cari: { select: { unvan: true, telefon: true, gsm: true } },
      arac: true,
      kalemler: {
        orderBy: { sira: "asc" },
        include: { stok: { select: { kod: true } } },
      },
    },
  })
  if (!kabul || kabul.silindi) notFound()

  const s = (d: unknown) => Number((d as { toString(): string }).toString())
  const KALEM_GRUP = [
    { tur: "PARCA", baslik: "Parçalar" },
    { tur: "ISCILIK", baslik: "İşçilikler" },
    { tur: "DIS_HIZMET", baslik: "Dış Hizmetler" },
  ] as const

  const [ozet, fisler] = await Promise.all([
    kabulTahsilatOzeti(kabul.id),
    kabulTahsilatlari(kabul.id),
  ])

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Dökümü Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi baslik="Hesap Dökümü" altBaslik={kabul.kabulNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Kabul No" deger={kabul.kabulNo} />
        <BaskiAlan etiket="Giriş Tarihi" deger={tarih(kabul.girisTarihi)} />
        <BaskiAlan etiket="Müşteri" deger={kabul.cari.unvan} />
        <BaskiAlan etiket="Telefon" deger={kabul.cari.gsm || kabul.cari.telefon} />
        <BaskiAlan etiket="Plaka" deger={plakaBicim(kabul.arac.plaka)} />
        <BaskiAlan
          etiket="Marka / Model"
          deger={[kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ")}
        />
        <BaskiAlan etiket="Şase No" deger={kabul.arac.saseNo} gizleBossa />
        <BaskiAlan etiket="Rengi" deger={kabul.arac.renk} gizleBossa />
        <BaskiAlan etiket="Model Yılı" deger={kabul.arac.modelYili} gizleBossa />
        <BaskiAlan
          etiket="KM"
          deger={(kabul.girisKm ?? kabul.arac.sonKm)?.toLocaleString("tr-TR")}
          gizleBossa
        />
      </div>

      {/* KALEM DÖKÜMÜ — "ne yapıldı" (12.4b). Parça / işçilik / dış hizmet
          ayrı ara toplamla; Selpar "ARAÇ HESAP DÖKÜMÜ" karşılığı. */}
      {KALEM_GRUP.map((g) => {
        const satirlar = kabul.kalemler.filter((k) => k.tur === g.tur)
        if (satirlar.length === 0) return null
        const grupToplam = satirlar.reduce((t, k) => t + s(k.tutar), 0)
        return (
          <table
            key={g.tur}
            className="mt-4 w-full border-collapse text-[0.75rem]"
          >
            <thead>
              <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
                <th className="py-1 pr-2">Stok No</th>
                <th className="py-1 pr-2">Açıklama</th>
                <th className="py-1 pr-2 text-right">Miktar</th>
                <th className="py-1 pr-2 text-right">Fiyatı</th>
                <th className="py-1 text-right">Tutarı</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((k) => (
                <tr key={k.id} className="border-b border-neutral-300">
                  <td className="py-1 pr-2 font-mono text-[0.6875rem]">
                    {k.stok?.kod ?? ""}
                  </td>
                  <td className="py-1 pr-2">{k.aciklama}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {miktar(k.miktar)} {k.birim}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {para(k.birimFiyat, false)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {para(k.tutar, false)}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-neutral-300 font-medium">
                <td colSpan={4} className="py-1 pr-2 text-right">
                  {g.baslik} Ara Toplamı (KDV Hariç)
                </td>
                <td className="py-1 text-right tabular-nums">
                  {para(grupToplam, false)}
                </td>
              </tr>
            </tbody>
          </table>
        )
      })}

      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="flex-1 border border-neutral-300 p-3 text-[0.75rem] text-neutral-600">
          <p className="mb-8 text-[0.6875rem] font-medium uppercase text-neutral-500">
            Kaşe / İmza
          </p>
        </div>
        <div className="baski-toplam w-72 border border-neutral-300 p-3 text-[0.8125rem]">
          <SatirOzet
            etiket="Parça Toplamı"
            deger={para(kabul.parcaToplam, false)}
          />
          <SatirOzet
            etiket="İşçilik Toplamı"
            deger={para(kabul.iscilikToplam, false)}
          />
          <SatirOzet
            etiket="Ara Toplam (KDV Hariç)"
            deger={para(kabul.araToplam, false)}
          />
          <SatirOzet etiket="KDV Tutarı" deger={para(kabul.kdvToplam, false)} />
          <SatirOzet
            etiket="GENEL TUTAR"
            deger={para(kabul.genelToplam)}
            vurgulu
          />
        </div>
      </div>

      <div className="baski-toplam mt-6 ml-auto w-72 border border-neutral-300 p-3 text-[0.8125rem]">
        <SatirOzet etiket="Kart Toplamı (KDV Dahil)" deger={para(ozet.genelToplam)} />
        <SatirOzet etiket="Tahsil Edilen" deger={para(ozet.tahsilEdilen)} />
        <SatirOzet
          etiket="Kalan Bakiye"
          deger={para(ozet.kalan)}
          vurgulu
        />
      </div>

      <table className="mt-4 w-full border-collapse text-[0.75rem]">
        <thead>
          <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
            <th className="py-1 pr-2">Fiş No</th>
            <th className="py-1 pr-2">Tarih</th>
            <th className="py-1 pr-2">Tür</th>
            <th className="py-1 pr-2">Ödeme Şekli</th>
            <th className="py-1 pr-2">Kasa</th>
            <th className="py-1 pr-2">Açıklama</th>
            <th className="py-1 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {fisler.map((f) => (
            <tr key={f.id} className="border-b border-neutral-300">
              <td className="py-1 pr-2">{f.fisNo}</td>
              <td className="py-1 pr-2">{tarih(f.tarih)}</td>
              <td className="py-1 pr-2">{TUR_ADI[f.tur]}</td>
              <td className="py-1 pr-2">{ODEME_SEKLI_ADI[f.odemeSekli]}</td>
              <td className="py-1 pr-2">{f.kasaAd ?? ""}</td>
              <td className="py-1 pr-2">{f.aciklama ?? ""}</td>
              <td className="py-1 text-right tabular-nums">
                {f.tur === "TEDIYE" ? "-" : ""}
                {para(f.tutar, false)}
              </td>
            </tr>
          ))}
          {fisler.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-3 text-center text-neutral-500">
                Bu karta bağlı tahsilat/ödeme fişi yok.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={kabul.kabulNo} />
    </BaskiSayfasi>
  )
}

function SatirOzet({
  etiket,
  deger,
  vurgulu,
}: {
  etiket: string
  deger: string
  vurgulu?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between py-0.5 ${
        vurgulu ? "mt-1 border-t border-black pt-1.5 font-bold" : ""
      }`}
    >
      <span className={vurgulu ? "" : "text-neutral-600"}>{etiket}</span>
      <span className="tabular-nums">{deger}</span>
    </div>
  )
}
