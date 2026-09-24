import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  BaskiAlan,
  BaskiAltBilgi,
  BaskiNoktali,
  BaskiSayfasi,
  BelgeBasligi,
  FirmaBasligi,
} from "@/components/baski/baski-sablonu"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Araç Kabul Formu" }
export const dynamic = "force-dynamic"

/**
 * ARAÇ KABUL FORMU (11.6) — 11.6'nın ilk gerçek şablonu.
 *
 * Kabul kartı (`/servis/kabul/[id]`) bu şablondan FARKLI: kart iş emrinin
 * kendisi (parça/işçilik kalemleri, tutar), bu form ise araç TESLİM
 * ALINIRKEN müşteriye imzalatılan kâğıt — SELPAR-ANALIZ.md'de "Araç Kabul
 * Etme Formu" olarak ayrı sayılıyor (11.7'deki "Kabul Kartı" dökümünden
 * ayrı). Bu yüzden kalem/tutar dökümü YOK; şikayet, araç durumu, bırakılan
 * eşya ve imza alanları var.
 */
export default async function AracKabulFormu({
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
      cari: {
        select: { unvan: true, yetkili: true, telefon: true, gsm: true, vergiNo: true },
      },
      arac: true,
      formen: { select: { ad: true, soyad: true } },
    },
  })
  if (!kabul || kabul.silindi) notFound()

  const danisman = kabul.formen
    ? [kabul.formen.ad, kabul.formen.soyad].filter(Boolean).join(" ")
    : null

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Formu Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi baslik="Araç Kabul Formu" altBaslik={kabul.kabulNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Giriş Tarihi" deger={tarih(kabul.girisTarihi)} />
        <BaskiAlan
          etiket="Tahmini Teslim Tarihi"
          deger={tarih(kabul.tahminiTeslimTarihi)}
        />
        <BaskiAlan etiket="Müşteri" deger={kabul.cari.unvan} />
        <BaskiAlan
          etiket="Telefon"
          deger={kabul.cari.gsm || kabul.cari.telefon}
        />
        <BaskiAlan etiket="VKN / TCKN" deger={kabul.cari.vergiNo} gizleBossa />
        <BaskiAlan etiket="Plaka" deger={plakaBicim(kabul.arac.plaka)} />
        <BaskiAlan
          etiket="Marka / Model"
          deger={[kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ")}
        />
        <BaskiAlan etiket="Şasi No" deger={kabul.arac.saseNo} gizleBossa />
        <BaskiAlan etiket="Model Yılı" deger={kabul.arac.modelYili} gizleBossa />
        <BaskiAlan etiket="Renk" deger={kabul.arac.renk} gizleBossa />
        <BaskiAlan etiket="Giriş Km" deger={kabul.girisKm?.toLocaleString("tr-TR")} gizleBossa />
        {/* SA-4.1: Yakıt Durumu / Araç Nerede / Aracı Getiren / Getiren Telefon
            satırları kaldırıldı. "Getiren" artık ayrı tutulmuyor — aracı getiren
            araç sahibi kabul ediliyor, üstteki "Müşteri" satırı zaten onu gösteriyor. */}
        <BaskiAlan
          etiket="Tahmini Tutar"
          deger={Number(kabul.tahminiTutar) > 0 ? para(kabul.tahminiTutar) : null}
          gizleBossa
        />
        <BaskiAlan etiket="Servis Danışmanı" deger={danisman} gizleBossa />
      </div>

      {/* ELLE DOLDURULACAK — Selpar KDOKUM'unda lastik diş derinliği 4 köşe
          ve şarj durumu böyle basılıyor (12.4b). */}
      <div className="mt-4 border border-neutral-300 p-4">
        <p className="mb-2 text-[0.6875rem] font-medium uppercase text-neutral-500">
          Araç Teslim Durumu (elle doldurulur)
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <BaskiNoktali etiket="Lastik Diş — Sağ Ön" />
          <BaskiNoktali etiket="Sol Ön" />
          <BaskiNoktali etiket="Sağ Arka" />
          <BaskiNoktali etiket="Sol Arka" />
          <BaskiNoktali etiket="Şarj Durumu" />
        </div>
      </div>

      <div className="mt-4 border border-neutral-300 p-4">
        <BaskiAlan etiket="Müşteri Şikayeti" deger={kabul.sikayet} genis />
      </div>

      <div className="mt-4 border border-neutral-300 p-4">
        <BaskiAlan
          etiket="Araçta Bırakılan Özel Eşya"
          deger={kabul.ozelEsya}
          genis
        />
      </div>

      {kabul.aracNotlari ? (
        <div className="mt-4 border border-neutral-300 p-4">
          <BaskiAlan etiket="Araç Notları" deger={kabul.aracNotlari} genis />
        </div>
      ) : null}

      <div className="mt-6 text-[0.6875rem] leading-relaxed text-neutral-700">
        <p className="mb-1 font-semibold uppercase text-neutral-600">
          Servis İş Kabul Şartları
        </p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            Aracın onarımı için gerekli görülen orijinal veya eşdeğer yedek
            parça ve malzemelerin kullanılmasına onay veriyorum.
          </li>
          <li>
            Onarımın kontrolü amacıyla aracın servis personeli tarafından test
            sürüşüne çıkarılmasına izin veriyorum.
          </li>
          <li>
            Aracın servise getirilmesi ve teslim alınması sırasında oluşabilecek
            yol ve trafik risklerinin araç sahibine ait olduğunu kabul ediyorum.
          </li>
          <li>
            Değişen eski parçalar özel olarak talep etmediğim sürece serviste
            bırakılır ve imha edilir; iadesini istemem hâlinde teslim sırasında
            yazılı olarak bildiririm.
          </li>
          <li>
            Onarım sırasında aracın gizli kusuru ortaya çıkarsa veya maliyet
            verilen tahmini aşarsa iş durdurulur; devam etmekten vazgeçmem
            hâlinde o ana kadar yapılan işçilik ve sökülen parça bedelini öderim.
          </li>
          <li>
            Araç üzerinde bulunan aksesuar, teyp, navigasyon, stepne, kriko gibi
            ekipmanın mevcut hâliyle teslim alındığını; sökülmesi gereken
            durumlarda onayımın alınacağını kabul ediyorum.
          </li>
          <li>
            Araçta beyan ettiğim özel eşya dışında bir eşya bırakmadım; teslim
            edilmeyen/bildirilmeyen eşyadan servis sorumlu tutulamaz.
          </li>
          <li>
            Onarım bedeli araç teslim alınırken peşin ödenir; aksi
            kararlaştırılmadıkça çek/senet ile ödeme kabul edilmez.
          </li>
          <li>
            Onarım bedeli ödenmediği sürece servisin araç üzerinde hapis (rehin)
            hakkı bulunduğunu ve borç ödenene kadar aracın teslim
            edilmeyebileceğini kabul ediyorum.
          </li>
          <li>
            Kabul sırasında verilen fiyat ve süre bilgisi tahminîdir; kesin tutar
            işin tamamlanmasıyla belli olur.
          </li>
          <li>
            Bu formu imzalamakla yukarıdaki tüm şartları okuduğumu ve kabul
            ettiğimi beyan ederim.
          </li>
        </ol>
      </div>

      <div className="baski-imza mt-10 grid grid-cols-2 gap-8">
        <div className="border-t border-black pt-1 text-center text-[0.75rem]">
          Aracı Teslim Eden (Müşteri)
          <br />
          Ad Soyad / İmza
        </div>
        <div className="border-t border-black pt-1 text-center text-[0.75rem]">
          Teslim Alan (Servis Yetkilisi)
          <br />
          Ad Soyad / İmza
        </div>
      </div>

      <BaskiAltBilgi
        kullaniciAdi={kullanici.tamAd}
        belgeNo={kabul.kabulNo}
      />
    </BaskiSayfasi>
  )
}
