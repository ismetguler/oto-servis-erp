import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  BaskiAlan,
  BaskiAltBilgi,
  BaskiSayfasi,
  BelgeBasligi,
  FirmaBasligi,
} from "@/components/baski/baski-sablonu"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { evrakDetayiGetir } from "@/app/(panel)/evrak/satis/veri"
import { firmaBilgisi } from "@/app/(panel)/ayar/firma/veri"
import { tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "İrsaliye" }
export const dynamic = "force-dynamic"

/**
 * İRSALİYE — BAĞIMSIZ (11.8) — sadece sevkiyat kâğıdı, TUTAR/FİYAT YOK.
 * İrsaliyeli Fatura'dan (aynı `Evrak` kaydı) FARKI: fiyat/KDV/toplam sütunu
 * hiç yok, kalemler yalnız ürün/açıklama + miktar + birim; imza alanları
 * eklendi ("mal/hizmet aşağıda belirtilen şekilde teslim edilmiştir").
 * Kaynak veri yine aynı Evrak/EvrakKalem — ayrı bir irsaliye tablosu
 * AÇILMADI (11.8 kararı, bkz. `irsaliyeli-fatura` şablonundaki not).
 */
export default async function IrsaliyeBaskisi({
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

  const firma = await firmaBilgisi()

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="İrsaliyeyi Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi baslik="İrsaliye" altBaslik={evrak.irsaliyeNo ?? evrak.evrakNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="İrsaliye No" deger={evrak.irsaliyeNo ?? evrak.evrakNo} />
        <BaskiAlan
          etiket="İrsaliye Tarihi"
          deger={tarih(evrak.irsaliyeTarihi ?? evrak.tarih)}
        />
        <BaskiAlan etiket="Gönderen" deger={firma?.unvan} genis />
        <BaskiAlan etiket="Alıcı" deger={evrak.cari.unvan} genis />
        <BaskiAlan
          etiket="Alıcı Adresi"
          deger={evrak.sevkAdresi || [evrak.cari.adres, [evrak.cari.ilce, evrak.cari.il].filter(Boolean).join("/")]
            .filter(Boolean)
            .join(" · ")}
          genis
        />
        <BaskiAlan etiket="Taşıyıcı / Plaka" deger={evrak.tasiyiciPlaka} />
      </div>

      <table className="mt-4 w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Ürün / Açıklama</th>
            <th className="py-1 text-right">Miktar</th>
          </tr>
        </thead>
        <tbody>
          {evrak.kalemler.map((k, i) => (
            <tr key={k.id} className="border-b border-neutral-300">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{k.aciklama}</td>
              <td className="py-1 text-right tabular-nums">
                {Number(k.miktar.toString()).toLocaleString("tr-TR")} {k.birim}
              </td>
            </tr>
          ))}
          {evrak.kalemler.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-3 text-center text-neutral-500">
                Kalem eklenmemiş.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <p className="mt-4 text-[0.8125rem]">
        Yukarıda cins ve miktarı yazılı mal/hizmet aşağıda belirtilen şekilde teslim edilmiştir.
      </p>

      <div className="baski-imza mt-8 grid grid-cols-2 gap-8 text-[0.8125rem]">
        <div>
          <p className="mb-8 font-medium">Teslim Eden</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
        <div>
          <p className="mb-8 font-medium">Teslim Alan</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
      </div>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={evrak.irsaliyeNo ?? evrak.evrakNo} />
    </BaskiSayfasi>
  )
}
