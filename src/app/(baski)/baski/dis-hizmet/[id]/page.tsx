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

export const metadata: Metadata = { title: "Dış Hizmet Formu" }
export const dynamic = "force-dynamic"

/**
 * DIŞ HİZMET FORMU (11.9) — bir kabul kartındaki `KabulKalem` satırlarından
 * YALNIZ `tur = DIS_HIZMET` olanların dökümü. 11.7'deki Kabul Kartı'ndan
 * FARKI tam olarak bu: o TÜM kalemleri (parça + işçilik + dış hizmet)
 * basıyor, bu yalnız dışarıya yaptırılan işleri.
 *
 * Kaynağı 10.5 Dış Hizmet Raporu'yla aynı (`KabulKalem.tur = DIS_HIZMET`);
 * o rapor tarih aralığındaki TÜM kartları listeler, bu tek kartın kâğıdı.
 * Dış hizmet sağlayıcısının KATALOĞU YOK — hizmeti kimin yaptığı serbest
 * metin `aciklama` alanında yaşıyor, o yüzden burada da ayrı bir "sağlayıcı"
 * sütunu değil, açıklamanın kendisi basılıyor. Kâğıdın altında sağlayıcının
 * elle dolduracağı teslim/onay imza alanı var — form dışarıya bu hâliyle
 * gidiyor.
 */
export default async function DisHizmetBaskisi({
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
      cari: { select: { unvan: true, yetkili: true, telefon: true, gsm: true } },
      arac: {
        select: { plaka: true, marka: true, model: true, modelYili: true, saseNo: true },
      },
      formen: { select: { ad: true, soyad: true } },
      kalemler: {
        where: { tur: "DIS_HIZMET" },
        orderBy: { sira: "asc" },
      },
    },
  })
  if (!kabul || kabul.silindi) notFound()

  // Kalemler zaten DIS_HIZMET ile filtrelendi — toplam da yalnız bu
  // satırların toplamı, kartın `genelToplam`ı DEĞİL (o parça/işçiliği de
  // içeriyor, bu kâğıtta yanıltıcı olurdu).
  const disHizmetToplam = kabul.kalemler.reduce(
    (acc, k) => acc + Number(k.toplam.toString()),
    0
  )

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Formu Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi baslik="Dış Hizmet Formu" altBaslik={kabul.kabulNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Kabul No" deger={kabul.kabulNo} />
        <BaskiAlan etiket="Giriş Tarihi" deger={tarih(kabul.girisTarihi)} />
        <BaskiAlan etiket="Plaka" deger={plakaBicim(kabul.arac.plaka)} />
        <BaskiAlan
          etiket="Marka / Model"
          deger={
            [kabul.arac.marka, kabul.arac.model, kabul.arac.modelYili]
              .filter(Boolean)
              .join(" ") || null
          }
        />
        <BaskiAlan etiket="Şase No" deger={kabul.arac.saseNo} />
        <BaskiAlan
          etiket="Sorumlu Usta"
          deger={
            kabul.formen ? `${kabul.formen.ad} ${kabul.formen.soyad}`.trim() : null
          }
        />
        <BaskiAlan etiket="Müşteri" deger={kabul.cari.unvan} genis />
        <BaskiAlan etiket="Yetkili" deger={kabul.cari.yetkili} />
        <BaskiAlan etiket="Telefon" deger={kabul.cari.gsm || kabul.cari.telefon} />
      </div>

      <table className="mt-4 w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Dış Hizmet Açıklaması / Sağlayıcı</th>
            <th className="py-1 pr-2 text-right">Miktar</th>
            <th className="py-1 pr-2 text-right">B. Fiyat</th>
            <th className="py-1 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {kabul.kalemler.map((k, i) => (
            <tr key={k.id} className="border-b border-neutral-300">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{k.aciklama}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {Number(k.miktar.toString()).toLocaleString("tr-TR")} {k.birim}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{para(k.birimFiyat, false)}</td>
              <td className="py-1 text-right tabular-nums">{para(k.toplam, false)}</td>
            </tr>
          ))}
          {kabul.kalemler.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-3 text-center text-neutral-500">
                Bu kabul kartında dış hizmet satırı yok.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="baski-toplam mt-3 ml-auto w-72 border border-neutral-300 p-3 text-[0.8125rem]">
        <div className="flex items-center justify-between font-bold">
          <span>Dış Hizmet Toplamı</span>
          <span className="tabular-nums">{para(disHizmetToplam)}</span>
        </div>
      </div>

      {kabul.sikayet ? (
        <div className="mt-4 border border-neutral-300 p-3 text-[0.75rem]">
          <p className="mb-1 text-[0.6875rem] font-medium uppercase text-neutral-500">
            Müşteri Şikâyeti
          </p>
          <p className="whitespace-pre-line">{kabul.sikayet}</p>
        </div>
      ) : null}

      <p className="mt-4 text-[0.75rem] text-neutral-700">
        Yukarıda belirtilen işler dışarıdan hizmet olarak yaptırılmıştır. Aracın
        tesliminde/iadesinde bu form iki tarafça imzalanır.
      </p>

      <div className="baski-imza mt-8 grid grid-cols-2 gap-8 text-[0.8125rem]">
        <div>
          <p className="mb-8 font-medium">Hizmeti Veren (Firma / Yetkili)</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
        <div>
          <p className="mb-8 font-medium">Teslim Alan</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
      </div>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={kabul.kabulNo} />
    </BaskiSayfasi>
  )
}
