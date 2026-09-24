import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BarkodSvg } from "@/components/stok/barkod-svg"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { evrakDetayiGetir } from "@/app/(panel)/evrak/satis/veri"
import { firmaBilgisi } from "@/app/(panel)/ayar/firma/veri"
import { tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Kargo Etiketi" }
export const dynamic = "force-dynamic"

const ADETLER = [1, 2, 4]

/**
 * KARGO ETİKETİ (11.9) — koliye yapıştırılan sevkiyat etiketi.
 *
 * Bağımsız İrsaliye şablonuyla (11.8) KARIŞTIRILMAMALI: o A4 bir sevk
 * KÂĞIDI (kalem dökümü + imza alanları, kutunun içine konur), bu ise
 * kutunun DIŞINA yapışan küçük etiket — kalem dökümü yok, yalnız gönderen /
 * alıcı / adres / irsaliye no + barkod.
 *
 * Kaynağı yine `Evrak`: satış evrakının `sevkAdresi`/`irsaliyeNo` alanları
 * 11.8'de zaten eklenmişti, ayrı bir "kargo" tablosu AÇILMADI. Adres olarak
 * evrakın `sevkAdresi` varsa o, yoksa carinin kayıtlı adresi basılıyor
 * (İrsaliye şablonundaki sıralamanın aynısı). Barkod değeri irsaliye no
 * (yoksa evrak no) — kargo takibi bu numaradan yapılıyor. Barkod çizgisi
 * 8.7'deki `jsbarcode` (`BarkodSvg`), ikinci bir kütüphane eklenmedi.
 */
export default async function KargoEtiketBaskisi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ adet?: string }>
}) {
  await yetkiliOturum("evrak", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const evrak = await evrakDetayiGetir(kayitId)
  if (!evrak || evrak.silindi) notFound()

  const firma = await firmaBilgisi()

  const p = await searchParams
  const istenenAdet = Number(p.adet)
  const adet = ADETLER.includes(istenenAdet) ? istenenAdet : 1

  const takipNo = evrak.irsaliyeNo || evrak.evrakNo
  const barkodDegeri = takipNo.replace(/\s+/g, "").toUpperCase()
  const aliciAdres =
    evrak.sevkAdresi ||
    [evrak.cari.adres, [evrak.cari.ilce, evrak.cari.il].filter(Boolean).join("/")]
      .filter(Boolean)
      .join(" · ")

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-black print:max-w-none print:p-0">
      <div className="yazdirma-disi mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[0.8125rem]">
          <span className="text-neutral-600">Adet:</span>
          {ADETLER.map((a) => (
            <Link
              key={a}
              href={`/baski/kargo-etiket/${evrak.id}?adet=${a}`}
              className={`rounded-sm border px-2 py-0.5 ${
                a === adet ? "border-black font-semibold" : "border-neutral-300 text-neutral-600"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
        <YazdirDugmesi etiket="Etiketi Yazdır" />
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: adet }, (_, i) => (
          <div
            key={i}
            className="w-[100mm] max-w-full break-inside-avoid border-2 border-black p-3 text-[0.75rem]"
          >
            <div className="border-b border-neutral-400 pb-2">
              <p className="text-[0.625rem] font-medium uppercase text-neutral-500">Gönderen</p>
              <p className="font-semibold">{firma?.unvan ?? "Firma unvanı tanımlı değil"}</p>
              <p className="leading-snug text-neutral-700">
                {[firma?.adres, [firma?.ilce, firma?.il].filter(Boolean).join("/")]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              {firma?.telefon || firma?.gsm ? (
                <p className="text-neutral-700">Tel: {firma.gsm || firma.telefon}</p>
              ) : null}
            </div>

            <div className="border-b border-neutral-400 py-2">
              <p className="text-[0.625rem] font-medium uppercase text-neutral-500">Alıcı</p>
              <p className="text-[0.875rem] font-bold leading-snug">{evrak.cari.unvan}</p>
              <p className="leading-snug">{aliciAdres || "—"}</p>
              {evrak.cari.yetkili ? <p>Yetkili: {evrak.cari.yetkili}</p> : null}
              {evrak.cari.gsm || evrak.cari.telefon ? (
                <p>Tel: {evrak.cari.gsm || evrak.cari.telefon}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 py-2 text-[0.6875rem]">
              <span>
                İrsaliye No: <strong className="font-mono">{takipNo}</strong>
              </span>
              <span>{tarih(evrak.irsaliyeTarihi ?? evrak.tarih)}</span>
            </div>
            {evrak.tasiyiciPlaka ? (
              <p className="pb-2 text-[0.6875rem]">Taşıyıcı / Plaka: {evrak.tasiyiciPlaka}</p>
            ) : null}

            <div className="flex flex-col items-center border-t border-neutral-400 pt-2">
              <BarkodSvg deger={barkodDegeri} yukseklik={40} />
              <span className="font-mono text-[0.7rem] tracking-wider">{barkodDegeri}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
