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
import { para, plaka as plakaBicim, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Teslim Formu" }
export const dynamic = "force-dynamic"

/**
 * TESLİM FORMU (11.7) — araç MÜŞTERİYE geri verilirken imzalatılan kâğıt.
 * 11.6'daki Kabul Formu'nun (araç TESLİM ALINIRKEN imzalanan) tam tersi
 * yönde: `Kabul.teslimTarihi/teslimNotu/teslimAlacak/teslimAlacakGsm`
 * alanları kullanılıyor, imza deseni AYNI ama metin "aracı teslim ALDIM"
 * yönünde. Teslim edilmemiş bir kart için de açılabilir (henüz teslim
 * tarihi yoksa alan boş "—" görünür), form serviste hazır tutulup elle
 * doldurulabilsin diye ENGELLENMEDİ.
 */
export default async function TeslimFormuBaskisi({
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
    },
  })
  if (!kabul || kabul.silindi) notFound()

  const garantiliVar =
    kabul.garantiVerenId !== null || Number(kabul.garantiTutar.toString()) > 0

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Formu Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi baslik="Araç Teslim Formu" altBaslik={kabul.kabulNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Teslim Tarihi" deger={tarihSaat(kabul.teslimTarihi)} />
        <BaskiAlan etiket="Müşteri" deger={kabul.cari.unvan} />
        <BaskiAlan etiket="Plaka" deger={plakaBicim(kabul.arac.plaka)} />
        <BaskiAlan
          etiket="Marka / Model"
          deger={[kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ")}
        />
        {/* SA-4.1: kabul formunda ayrı "teslim alacak kişi/GSM" alanı yok;
            teslim alan araç sahibi kabul ediliyor, boşsa elle yazılır. */}
        <BaskiAlan etiket="Teslim Alacak Kişi" deger={kabul.teslimAlacak || kabul.cari.unvan} />
        <BaskiAlan etiket="Telefon" deger={kabul.teslimAlacakGsm || kabul.cari.gsm || kabul.cari.telefon} />
        <BaskiAlan etiket="Araç Son Km" deger={kabul.arac.sonKm?.toLocaleString("tr-TR")} />
        <BaskiAlan etiket="Genel Toplam" deger={para(kabul.genelToplam)} />
      </div>

      <div className="mt-4 border border-neutral-300 p-4">
        <BaskiAlan
          etiket="Yapılan İşlerin Özeti"
          deger={kabul.yapilanIsler || kabul.sikayet}
          genis
        />
      </div>

      {garantiliVar ? (
        <div className="mt-4 border border-neutral-300 p-4">
          <BaskiAlan
            etiket="Garanti Kapsamı"
            deger={[
              kabul.garantiDosyaNo ? `Dosya No: ${kabul.garantiDosyaNo}` : null,
              kabul.garantiNotu,
            ]
              .filter(Boolean)
              .join(" — ") || "Bu karttaki garantili işçilik/parça satırları garanti kapsamındadır."}
            genis
          />
        </div>
      ) : null}

      {kabul.teslimNotu ? (
        <div className="mt-4 border border-neutral-300 p-4">
          <BaskiAlan etiket="Teslim Notu" deger={kabul.teslimNotu} genis />
        </div>
      ) : null}

      <p className="mt-6 text-[0.75rem] leading-relaxed text-neutral-700">
        Yukarıda bilgileri belirtilen aracımı, yapılan işlemleri kontrol ederek
        eksiksiz ve hasarsız şekilde teslim ALDIM. Aracın mevcut kilometresi ve
        üzerinde yapılan işlemler tarafımca uygun bulunmuştur.
      </p>

      <div className="baski-imza mt-10 grid grid-cols-2 gap-8">
        <div className="border-t border-black pt-1 text-center text-[0.75rem]">
          Teslim Eden (Servis Yetkilisi)
          <br />
          Ad Soyad / İmza
        </div>
        <div className="border-t border-black pt-1 text-center text-[0.75rem]">
          Teslim Alan (Müşteri)
          <br />
          Ad Soyad / İmza
        </div>
      </div>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={kabul.kabulNo} />
    </BaskiSayfasi>
  )
}
