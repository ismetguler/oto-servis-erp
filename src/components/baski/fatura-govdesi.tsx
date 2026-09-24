import { BaskiAlan, BaskiAltBilgi, BelgeBasligi, FirmaBasligi } from "./baski-sablonu"
import { firmaBilgisi } from "@/app/(panel)/ayar/firma/veri"
import type { Prisma } from "@/generated/prisma/client"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { tutariYaziyaCevir } from "@/lib/yaziyla"

/**
 * FATURA GÖVDESİ (adım 11.8) — Servis Fatura · İrsaliyeli Fatura · İade
 * Faturası · Tevkifatlı Fatura'nın ORTAK gövdesi. Dördü de aynı `Evrak`/
 * `EvrakKalem` verisinden besleniyor, farkları sadece hangi ek bloğun
 * gösterildiği (irsaliye/tevkifat/iade referansı) — bu yüzden kod tekrarı
 * yerine tek bileşen, her sayfa kendi `baslik`ini ve `goster*` bayraklarını
 * veriyor. İrsaliye (bağımsız, fiyatsız) ve Fiş bu bileşeni KULLANMAZ —
 * onların düzeni kökten farklı (bkz. kendi `page.tsx`leri).
 */
export async function FaturaGovdesi({
  evrak,
  baslik,
  kullaniciAdi,
  gosterIrsaliye = false,
  gosterTevkifat = false,
  gosterIadeRef = false,
  gosterArac = false,
}: {
  evrak: {
    evrakNo: string
    tarih: Date
    vadeTarihi: Date | null
    tur: string
    kabulId?: number | null
    kabul?: {
      kabulNo: string
      girisTarihi: Date
      girisKm: number | null
      arac: {
        plaka: string
        saseNo: string | null
        marka: string | null
        model: string | null
        modelYili: number | null
        renk: string | null
        sonKm: number | null
      }
    } | null
    irsaliyeNo: string | null
    irsaliyeTarihi: Date | null
    tasiyiciPlaka: string | null
    sevkAdresi: string | null
    tevkifatKodu: string | null
    tevkifatOrani: Prisma.Decimal | null
    kaynakEvrakNo: string | null
    araToplam: Prisma.Decimal
    kdvToplam: Prisma.Decimal
    genelToplam: Prisma.Decimal
    cari: {
      unvan: string
      vergiNo: string | null
      vergiDair: string | null
      adres: string | null
      il: string | null
      ilce: string | null
      telefon: string | null
      gsm: string | null
      yetkili: string | null
    }
    kalemler: {
      id: number
      aciklama: string
      miktar: Prisma.Decimal
      birim: string
      birimFiyat: Prisma.Decimal
      kdvOrani: Prisma.Decimal
      toplam: Prisma.Decimal
    }[]
  }
  baslik: string
  kullaniciAdi: string
  gosterIrsaliye?: boolean
  gosterTevkifat?: boolean
  gosterIadeRef?: boolean
  /** Servis faturası (12.4b): evrak bir kabule bağlıysa araç bloğu bassın. */
  gosterArac?: boolean
}) {
  const firma = await firmaBilgisi()

  const genelToplam = Number(evrak.genelToplam.toString())
  const tevkifatOrani = evrak.tevkifatOrani ? Number(evrak.tevkifatOrani.toString()) : 0
  // Tevkifatta KDV'nin yalnız "sorumlu sıfatıyla beyan edilmeyen" kısmı
  // alıcıdan tahsil edilir — kesilen kısım (tevkifatOrani%'i) düşülüp
  // "Ödenecek Tutar" ayrıca gösteriliyor (11.8 kararı, gerçek e-Fatura
  // tevkifat kodu listesi entegre değil, kod/oran elle giriliyor).
  const kdvToplam = Number(evrak.kdvToplam.toString())
  const tevkifatTutari = (kdvToplam * tevkifatOrani) / 100
  const odenecekTutar = genelToplam - tevkifatTutari

  return (
    <>
      <FirmaBasligi />
      <BelgeBasligi baslik={baslik} altBaslik={evrak.evrakNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Fatura No" deger={evrak.evrakNo} />
        <BaskiAlan etiket="Tarih" deger={tarih(evrak.tarih)} />
        <BaskiAlan etiket="Vade Tarihi" deger={evrak.vadeTarihi ? tarih(evrak.vadeTarihi) : null} />
        {gosterIadeRef ? (
          <BaskiAlan etiket="Kaynak Evrak No" deger={evrak.kaynakEvrakNo} />
        ) : null}
        <BaskiAlan etiket="Müşteri / Ünvan" deger={evrak.cari.unvan} genis />
        <BaskiAlan etiket="Vergi No / TCKN" deger={evrak.cari.vergiNo} />
        <BaskiAlan etiket="Vergi Dairesi" deger={evrak.cari.vergiDair} />
        <BaskiAlan
          etiket="Adres"
          deger={[evrak.cari.adres, [evrak.cari.ilce, evrak.cari.il].filter(Boolean).join("/")]
            .filter(Boolean)
            .join(" · ")}
          genis
        />
        <BaskiAlan etiket="Telefon" deger={evrak.cari.gsm || evrak.cari.telefon} />
        <BaskiAlan etiket="Yetkili" deger={evrak.cari.yetkili} />
      </div>

      {gosterArac && evrak.kabul ? (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4 md:grid-cols-4">
          <BaskiAlan etiket="Plaka" deger={plakaBicim(evrak.kabul.arac.plaka)} />
          <BaskiAlan etiket="Şase No" deger={evrak.kabul.arac.saseNo} gizleBossa />
          <BaskiAlan
            etiket="Marka / Model"
            deger={[evrak.kabul.arac.marka, evrak.kabul.arac.model]
              .filter(Boolean)
              .join(" ")}
          />
          <BaskiAlan etiket="Model Yılı" deger={evrak.kabul.arac.modelYili} gizleBossa />
          <BaskiAlan etiket="Renk" deger={evrak.kabul.arac.renk} gizleBossa />
          <BaskiAlan
            etiket="KM"
            deger={(evrak.kabul.girisKm ?? evrak.kabul.arac.sonKm)?.toLocaleString(
              "tr-TR"
            )}
            gizleBossa
          />
          <BaskiAlan etiket="Kabul No" deger={evrak.kabul.kabulNo} />
          <BaskiAlan
            etiket="Kabul Tarihi"
            deger={tarih(evrak.kabul.girisTarihi)}
          />
        </div>
      ) : null}

      {gosterIrsaliye ? (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
          <BaskiAlan etiket="İrsaliye No" deger={evrak.irsaliyeNo} />
          <BaskiAlan etiket="İrsaliye Tarihi" deger={evrak.irsaliyeTarihi ? tarih(evrak.irsaliyeTarihi) : null} />
          <BaskiAlan etiket="Taşıyıcı / Plaka" deger={evrak.tasiyiciPlaka} />
          <BaskiAlan etiket="Sevk Adresi" deger={evrak.sevkAdresi} genis />
        </div>
      ) : null}

      <table className="mt-4 w-full border-collapse text-[0.75rem]">
        <thead>
          <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Ürün / Hizmet</th>
            <th className="py-1 pr-2 text-right">Miktar</th>
            <th className="py-1 pr-2 text-right">B. Fiyat</th>
            <th className="py-1 pr-2 text-right">KDV %</th>
            <th className="py-1 text-right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {evrak.kalemler.map((k, i) => (
            <tr key={k.id} className="border-b border-neutral-300">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{k.aciklama}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {Number(k.miktar.toString()).toLocaleString("tr-TR")} {k.birim}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{para(k.birimFiyat, false)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{Number(k.kdvOrani.toString())}</td>
              <td className="py-1 text-right tabular-nums">{para(k.toplam, false)}</td>
            </tr>
          ))}
          {evrak.kalemler.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-3 text-center text-neutral-500">
                Faturaya henüz kalem eklenmemiş.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="hidden flex-1 border border-neutral-300 p-3 text-[0.75rem] text-neutral-600 print:block sm:block">
          <p className="mb-10 text-[0.6875rem] font-medium uppercase text-neutral-500">
            Kaşe / İmza
          </p>
        </div>
        <div className="baski-toplam w-72 border border-neutral-300 p-3 text-[0.8125rem]">
        <SatirOzet etiket="Ara Toplam" deger={para(evrak.araToplam)} />
        <SatirOzet etiket="KDV" deger={para(evrak.kdvToplam)} />
        <SatirOzet etiket="Genel Toplam" deger={para(evrak.genelToplam)} vurgulu={!gosterTevkifat} />
        {gosterTevkifat ? (
          <>
            <SatirOzet
              etiket={`Tevkifat${evrak.tevkifatKodu ? ` (${evrak.tevkifatKodu})` : ""} — %${tevkifatOrani}`}
              deger={`- ${para(tevkifatTutari)}`}
            />
            <SatirOzet etiket="Ödenecek Tutar" deger={para(odenecekTutar)} vurgulu />
          </>
        ) : null}
        </div>
      </div>

      <p className="mt-2 text-[0.75rem]">
        Yazı ile:{" "}
        <strong>{tutariYaziyaCevir(gosterTevkifat ? odenecekTutar : genelToplam)}</strong>
        {gosterTevkifat ? " (ödenecek tutar)" : ""}
      </p>

      {firma?.bankaAdi || firma?.ibanNo ? (
        <div className="mt-4 border border-neutral-300 p-3 text-[0.75rem]">
          <p className="mb-1 text-[0.6875rem] font-medium uppercase text-neutral-500">
            Ödeme Bilgisi
          </p>
          <p>{[firma.bankaAdi, firma.ibanNo].filter(Boolean).join(" — ")}</p>
        </div>
      ) : null}

      <BaskiAltBilgi kullaniciAdi={kullaniciAdi} belgeNo={evrak.evrakNo} />
    </>
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
