import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BarkodSvg } from "@/components/stok/barkod-svg"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { plaka as plakaBicim } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Araç Barkodu" }
export const dynamic = "force-dynamic"

const ADETLER = [1, 2, 4, 8, 12]

/**
 * ARAÇ BARKODU (11.9) — araca/anahtarlığa/dosyaya yapıştırılan küçük etiket.
 *
 * `Arac` modelinde ayrı bir `barkod` alanı YOK; 8.7'deki "barkodu boş
 * kartlarda kartın KODU barkod olarak basılır" deseni burada da geçerli —
 * barkod değeri PLAKA (boşluksuz, büyük harf). Böylece serviste el
 * okuyucusuyla plaka okutulunca kart bulunabiliyor, şemaya yeni alan
 * eklemeye gerek kalmıyor.
 *
 * Barkod çizgisi 8.7'de kurulan `jsbarcode` ile (`BarkodSvg`) — ikinci bir
 * barkod kütüphanesi eklenmedi. A4 çerçevesi (`BaskiSayfasi`) KULLANILMIYOR:
 * bu bir belge değil etiket, Fiş şablonundaki (11.8) "kendi dar genişliğini
 * tanımlayan sayfa" deseninin aynısı.
 */
export default async function AracBarkodBaskisi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ adet?: string }>
}) {
  await yetkiliOturum("arac", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const arac = await prisma.arac.findUnique({
    where: { id: kayitId },
    select: {
      id: true,
      plaka: true,
      marka: true,
      model: true,
      modelYili: true,
      saseNo: true,
      silindi: true,
      cari: { select: { unvan: true } },
    },
  })
  if (!arac || arac.silindi) notFound()

  const p = await searchParams
  const istenenAdet = Number(p.adet)
  const adet = ADETLER.includes(istenenAdet) ? istenenAdet : 4

  // CODE128 boşluk kabul eder ama okuyucudan dönen değerin veritabanındaki
  // plakayla eşleşmesi için boşluksuz/büyük harf tek biçim kullanılıyor.
  const barkodDegeri = arac.plaka.replace(/\s+/g, "").toUpperCase()

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-black print:max-w-none print:p-0">
      <div className="yazdirma-disi mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[0.8125rem]">
          <span className="text-neutral-600">Adet:</span>
          {ADETLER.map((a) => (
            <Link
              key={a}
              href={`/baski/arac-barkod/${arac.id}?adet=${a}`}
              className={`rounded-sm border px-2 py-0.5 ${
                a === adet ? "border-black font-semibold" : "border-neutral-300 text-neutral-600"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
        <YazdirDugmesi etiket="Barkodu Yazdır" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: adet }, (_, i) => (
          <div
            key={i}
            className="flex break-inside-avoid flex-col items-center gap-1 border border-dashed border-black/30 p-3 text-center"
          >
            <div className="font-mono text-[1rem] font-bold tracking-wider">
              {plakaBicim(arac.plaka)}
            </div>
            <BarkodSvg deger={barkodDegeri} yukseklik={36} />
            <div className="font-mono text-[0.7rem] tracking-wider">{barkodDegeri}</div>
            <div className="text-[0.7rem] leading-tight text-neutral-700">
              {[arac.marka, arac.model, arac.modelYili].filter(Boolean).join(" ") || "—"}
            </div>
            {arac.cari ? (
              <div className="max-w-full truncate text-[0.7rem] leading-tight text-neutral-700">
                {arac.cari.unvan}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
