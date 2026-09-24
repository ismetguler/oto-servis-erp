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
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Kabul Kartı" }
export const dynamic = "force-dynamic"

const KALEM_TUR_ADI: Record<string, string> = {
  PARCA: "Parça",
  ISCILIK: "İşçilik",
  DIS_HIZMET: "Dış Hizmet",
}

/**
 * KABUL KARTI (11.7) — iş emrinin kendisinin çıktısı. Serviste aracın
 * yanında/dosyada tutulan kâğıt: firma başlığı + kart bilgisi + araç/
 * müşteri + TÜM parça/işçilik kalemleri + toplamlar. Ekrandaki
 * `/servis/kabul/[id]` kartıyla KARIŞTIRILMASIN — o ekranda menü/filtre
 * de var, bu sadece kâğıda basılacak sade döküm (11.6'daki ortak
 * `baski-sablonu`yı kullanıyor, ekran kartının kendisi DEĞİL).
 */
export default async function KabulKartiBaskisi({
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
      cari: { select: { unvan: true, yetkili: true, telefon: true, gsm: true, adres: true } },
      arac: true,
      formen: { select: { ad: true, soyad: true } },
      kalemler: {
        orderBy: { sira: "asc" },
        include: { personel: { select: { unvan: true } } },
      },
    },
  })
  if (!kabul || kabul.silindi) notFound()

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Kartı Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi baslik="Kabul Kartı" altBaslik={kabul.kabulNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Kabul No" deger={kabul.kabulNo} />
        <BaskiAlan etiket="Özel Kabul No" deger={kabul.kabulOzelNo} />
        <BaskiAlan etiket="Giriş Tarihi" deger={tarih(kabul.girisTarihi)} />
        <BaskiAlan etiket="Tahmini Teslim" deger={tarih(kabul.tahminiTeslimTarihi)} />
        <BaskiAlan etiket="Müşteri" deger={kabul.cari.unvan} />
        <BaskiAlan etiket="Telefon" deger={kabul.cari.gsm || kabul.cari.telefon} />
        <BaskiAlan etiket="Plaka" deger={plakaBicim(kabul.arac.plaka)} />
        <BaskiAlan
          etiket="Marka / Model"
          deger={[kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ")}
        />
        <BaskiAlan etiket="Şasi No" deger={kabul.arac.saseNo} />
        <BaskiAlan etiket="Giriş Km" deger={kabul.girisKm?.toLocaleString("tr-TR")} />
        <BaskiAlan
          etiket="Formen / Usta"
          deger={kabul.formen ? [kabul.formen.ad, kabul.formen.soyad].filter(Boolean).join(" ") : null}
        />
        <BaskiAlan etiket="İstek Türü" deger={kabul.istekTuru} />
      </div>

      <div className="mt-4 border border-neutral-300 p-4">
        <BaskiAlan etiket="Müşteri Şikâyeti" deger={kabul.sikayet} genis />
      </div>

      {kabul.yapilanIsler ? (
        <div className="mt-4 border border-neutral-300 p-4">
          <BaskiAlan etiket="Yapılan İşler" deger={kabul.yapilanIsler} genis />
        </div>
      ) : null}

      <table className="mt-4 w-full border-collapse text-[0.75rem]">
        <thead>
          <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Tür</th>
            <th className="py-1 pr-2">Açıklama</th>
            <th className="py-1 pr-2">Usta</th>
            <th className="py-1 pr-2 text-right">Miktar</th>
            <th className="py-1 pr-2 text-right">B. Fiyat</th>
            <th className="py-1 pr-2 text-right">KDV %</th>
            <th className="py-1 text-right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {kabul.kalemler.map((k, i) => (
            <tr key={k.id} className="border-b border-neutral-300">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{KALEM_TUR_ADI[k.tur] ?? k.tur}</td>
              <td className="py-1 pr-2">
                {k.aciklama}
                {k.garantili ? " (Garanti)" : ""}
              </td>
              <td className="py-1 pr-2">{k.personel?.unvan ?? ""}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {Number(k.miktar.toString()).toLocaleString("tr-TR")} {k.birim}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{para(k.birimFiyat, false)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {Number(k.kdvOrani.toString())}
              </td>
              <td className="py-1 text-right tabular-nums">{para(k.toplam, false)}</td>
            </tr>
          ))}
          {kabul.kalemler.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-3 text-center text-neutral-500">
                Karta henüz kalem eklenmemiş.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="baski-toplam mt-3 ml-auto w-64 border border-neutral-300 p-3 text-[0.8125rem]">
        <SatirOzet etiket="Parça Toplamı" deger={para(kabul.parcaToplam)} />
        <SatirOzet etiket="İşçilik Toplamı" deger={para(kabul.iscilikToplam)} />
        <SatirOzet etiket="Ara Toplam" deger={para(kabul.araToplam)} />
        <SatirOzet etiket="KDV" deger={para(kabul.kdvToplam)} />
        <SatirOzet
          etiket="Genel Toplam"
          deger={para(kabul.genelToplam)}
          vurgulu
        />
      </div>

      {kabul.aracNotlari || kabul.cariNotu ? (
        <div className="mt-4 grid grid-cols-2 gap-4 border border-neutral-300 p-4">
          {kabul.aracNotlari ? <BaskiAlan etiket="Araç Notları" deger={kabul.aracNotlari} /> : null}
          {kabul.cariNotu ? <BaskiAlan etiket="Cari Notu" deger={kabul.cariNotu} /> : null}
        </div>
      ) : null}

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
