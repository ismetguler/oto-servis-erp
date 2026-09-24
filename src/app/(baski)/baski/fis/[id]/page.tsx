import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BaskiAltBilgi } from "@/components/baski/baski-sablonu"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { evrakDetayiGetir } from "@/app/(panel)/evrak/satis/veri"
import { firmaBilgisi } from "@/app/(panel)/ayar/firma/veri"
import { ODEME_SEKLI_ADI } from "@/app/(panel)/tahsilat/veri"
import { para, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Fiş" }
export const dynamic = "force-dynamic"

/**
 * FİŞ (11.8) — Hızlı Satış'tan (9.3) çıkan kısa/dar formatlı çıktı. Diğer beş
 * şablonun aksine `BaskiSayfasi`nin A4 çerçevesini KULLANMIYOR: termal fiş
 * genişliğine yakın (80mm ≈ 302px @96dpi) dar bir sütun, kendi print
 * genişliğini tanımlıyor (`print:max-w-none` YOK — ekranda da kâğıtta da
 * dar kalsın istendi). `FirmaBasligi`/`BelgeBasligi` gibi A4'e göre
 * boyutlanmış ortak bileşenler burada da UYMADIĞI için kendi başlığı var;
 * yalnız sayfa altı imzası (`BaskiAltBilgi`) ortak bileşenden.
 */
export default async function FisBaskisi({
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
  const tahsilatlar = await prisma.tahsilat.findMany({
    where: { evrakId: kayitId, silindi: false },
    orderBy: { tarih: "asc" },
  })
  const odemeSekilleri = [...new Set(tahsilatlar.map((t) => ODEME_SEKLI_ADI[t.odemeSekli]))]
  const kdvDahilMi = evrak.kalemler.some((k) => Number(k.kdvOrani.toString()) > 0)

  return (
    <div className="mx-auto w-[80mm] max-w-full bg-white p-3 text-[0.75rem] text-black">
      <div className="yazdirma-disi mb-3 flex justify-end">
        <YazdirDugmesi etiket="Fişi Yazdır" />
      </div>

      <div className="text-center">
        <p className="font-bold">{firma?.unvan ?? "Firma unvanı tanımlı değil"}</p>
        {firma?.adres ? <p className="text-[0.6875rem] text-neutral-700">{firma.adres}</p> : null}
        {firma?.telefon || firma?.gsm ? (
          <p className="text-[0.6875rem] text-neutral-700">{firma.gsm || firma.telefon}</p>
        ) : null}
        {firma?.vergiNo ? (
          <p className="text-[0.6875rem] text-neutral-700">
            {[firma.vergiDair, firma.vergiNo].filter(Boolean).join(" V.D. — ")}
          </p>
        ) : null}
      </div>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <p>Fiş No: {evrak.evrakNo}</p>
      <p>Tarih: {tarihSaat(evrak.tarih)}</p>
      <p>Müşteri: {evrak.cari.unvan}</p>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      {evrak.kalemler.map((k) => (
        <div key={k.id} className="mb-1 flex justify-between gap-2">
          <span className="flex-1">
            {k.aciklama}
            <span className="text-neutral-500">
              {" "}
              × {Number(k.miktar.toString()).toLocaleString("tr-TR")}
            </span>
          </span>
          <span className="tabular-nums">{para(k.toplam, false)}</span>
        </div>
      ))}
      {evrak.kalemler.length === 0 ? (
        <p className="text-center text-neutral-500">Kalem eklenmemiş.</p>
      ) : null}

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <div className="flex justify-between">
        <span>Ara Toplam</span>
        <span className="tabular-nums">{para(evrak.araToplam)}</span>
      </div>
      <div className="flex justify-between">
        <span>KDV ({kdvDahilMi ? "Dahil" : "Hariç"})</span>
        <span className="tabular-nums">{para(evrak.kdvToplam)}</span>
      </div>
      <div className="mt-1 flex justify-between border-t border-black pt-1 font-bold">
        <span>TOPLAM</span>
        <span className="tabular-nums">{para(evrak.genelToplam)}</span>
      </div>

      <div className="my-2 border-t border-dashed border-neutral-400" />

      <p>Ödeme Şekli: {odemeSekilleri.length > 0 ? odemeSekilleri.join(" + ") : "—"}</p>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={evrak.evrakNo} />
    </div>
  )
}
