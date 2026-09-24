import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ODEME_SEKLI_ADI, tahsilatGetir, TUR_ADI } from "@/app/(panel)/tahsilat/veri"
import {
  BaskiAlan,
  BaskiAltBilgi,
  BaskiSayfasi,
  BelgeBasligi,
  FirmaBasligi,
} from "@/components/baski/baski-sablonu"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { para, sayi, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { tutariYaziyaCevir } from "@/lib/yaziyla"

export const metadata: Metadata = { title: "Tahsilat / Ödeme Makbuzu" }
export const dynamic = "force-dynamic"

/**
 * TAHSİLAT / ÖDEME MAKBUZU (12.9) — oto serviste para elden alınıp verilirken
 * müşteriye imzalı kâğıt bırakılır. `/tahsilat/[id]` ekranında yalnız "Yazdır"
 * düğmesi vardı, şablonu yoktu (DEMO-HAZIRLIK §5 🟡-4). Hesap Dökümü'yle aynı
 * baskı altyapısı (11.6) — yeni bir şey kurulmadı, `Tahsilat` modelinde tüm
 * alanlar zaten mevcut.
 */
export default async function TahsilatMakbuzu({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const fis = await tahsilatGetir(kayitId)
  if (!fis) notFound()

  // Fişi kesen kullanıcı — Tahsilat modelinde Kullanici'ya Prisma ilişkisi
  // yok (yalnız olusturanId sütunu), ad-soyad ayrı sorguyla çözülüyor
  // (stok hareket dökümündeki desenle aynı).
  const kesen = fis.olusturanId
    ? await prisma.kullanici.findUnique({
        where: { id: fis.olusturanId },
        select: { ad: true, soyad: true },
      })
    : null
  const kesenAdi = kesen ? `${kesen.ad} ${kesen.soyad ?? ""}`.trim() : "—"

  const tutar = sayi(fis.tutar)
  const tahsilat = fis.tur === "TAHSILAT"

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Makbuzu Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi
        baslik={tahsilat ? "Tahsilat Makbuzu" : "Ödeme (Tediye) Makbuzu"}
        altBaslik={fis.fisNo}
      />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Makbuz No" deger={fis.fisNo} />
        <BaskiAlan etiket="Tarih" deger={tarih(fis.tarih)} />
        <BaskiAlan etiket="Cari" deger={`${fis.cari.kod} — ${fis.cari.unvan}`} genis />
        <BaskiAlan etiket="İşlem" deger={TUR_ADI[fis.tur]} />
        <BaskiAlan etiket="Ödeme Şekli" deger={ODEME_SEKLI_ADI[fis.odemeSekli]} />
        <BaskiAlan etiket="Kasa" deger={fis.kasa?.ad} gizleBossa />
        {fis.odemeSekli === "KREDI_KARTI" ? (
          <BaskiAlan
            etiket="Kart / POS"
            deger={[fis.posBanka, fis.posSon4 ? `**** ${fis.posSon4}` : null]
              .filter(Boolean)
              .join(" · ")}
            gizleBossa
          />
        ) : null}
        <BaskiAlan etiket="Açıklama" deger={fis.aciklama} genis gizleBossa />
      </div>

      {/* Tutar bloğu — rakamla + yazıyla. Selpar makbuzunda da "YALNIZ ... İLE"
          satırı var; çekte/senette sahtecilik önlemi olarak standart. */}
      <div className="mt-4 border border-neutral-300 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.6875rem] font-medium uppercase text-neutral-500">
            {tahsilat ? "Tahsil Edilen Tutar" : "Ödenen Tutar"}
          </span>
          <span className="text-[1.25rem] font-bold tabular-nums">{para(tutar)}</span>
        </div>
        <p className="mt-2 border-t border-neutral-300 pt-2 text-[0.8125rem]">
          Yalnız <strong>{tutariYaziyaCevir(tutar)}</strong> ile{" "}
          {tahsilat ? "tahsil edilmiştir." : "ödenmiştir."}
        </p>
      </div>

      <p className="mt-6 text-[0.75rem] text-neutral-600">
        Düzenleyen: <span className="font-medium text-black">{kesenAdi}</span>
      </p>

      <div className="baski-imza mt-8 grid grid-cols-2 gap-12">
        <div className="border-t border-black pt-2 text-center text-[0.75rem] text-neutral-600">
          {tahsilat ? "Ödeyen (Müşteri)" : "Alan"}
          <div className="mt-8" />
          Ad Soyad / İmza
        </div>
        <div className="border-t border-black pt-2 text-center text-[0.75rem] text-neutral-600">
          {tahsilat ? "Tahsil Eden (Firma)" : "Ödeyen (Firma)"}
          <div className="mt-8" />
          Ad Soyad / İmza
        </div>
      </div>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={fis.fisNo} />
    </BaskiSayfasi>
  )
}
