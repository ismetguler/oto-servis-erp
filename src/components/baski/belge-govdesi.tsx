import { BaskiAlan, BaskiAltBilgi, BelgeBasligi, FirmaBasligi } from "./baski-sablonu"
import { firmaBilgisi } from "@/app/(panel)/ayar/firma/veri"
import type { Prisma } from "@/generated/prisma/client"
import { para } from "@/lib/bicim"

/**
 * BELGE GÖVDESİ (adım 11.9) — Teklif Formu ile Sipariş Formu'nun ORTAK
 * gövdesi. İkisi de fatura ailesine (11.8 `FaturaGovdesi`) çok benzer bir
 * düzen istiyor ama AYNI veriden beslenmiyor: `FaturaGovdesi` doğrudan
 * `Evrak` tipine bağlı (irsaliye/tevkifat/iade alanları onun imzasında),
 * `Teklif`/`Siparis` ise o alanların hiçbirine sahip değil. Bu yüzden
 * `FaturaGovdesi`ye üçüncü/dördüncü bir "kaynak türü" bayrağı eklemek
 * yerine — o bileşen fatura ailesine ait BIRAKILIP — teklif/sipariş için
 * ayrı ama yine TEK bir gövde yazıldı.
 *
 * Teklif ile Sipariş arasındaki tek yapısal fark `gosterSevk`: siparişte
 * kalem satırında "Sevk" ve "Kalan" sütunları da basılır (`sevkMiktar`,
 * siparişi faturadan ayıran alan). Teklifte böyle bir kavram yok.
 */
export type BelgeKalemi = {
  id: number
  aciklama: string
  miktar: Prisma.Decimal
  birim: string
  birimFiyat: Prisma.Decimal
  kdvOrani: Prisma.Decimal
  toplam: Prisma.Decimal
  sevkMiktar?: Prisma.Decimal
}

export type BelgeCarisi = {
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

export async function BelgeGovdesi({
  baslik,
  belgeNo,
  durumAdi,
  ustAlanlar,
  cariEtiketi,
  cari,
  kalemler,
  aciklama,
  araToplam,
  kdvToplam,
  genelToplam,
  gosterSevk = false,
  altNot,
  kullaniciAdi,
}: {
  baslik: string
  belgeNo: string
  durumAdi: string
  /** Belgeye özel üst blok alanları (teklif: geçerlilik, sipariş: teslim tarihi). */
  ustAlanlar: { etiket: string; deger: React.ReactNode }[]
  cariEtiketi: string
  cari: BelgeCarisi
  kalemler: BelgeKalemi[]
  aciklama: string | null
  araToplam: Prisma.Decimal
  kdvToplam: Prisma.Decimal
  genelToplam: Prisma.Decimal
  gosterSevk?: boolean
  altNot?: string
  kullaniciAdi: string
}) {
  const firma = await firmaBilgisi()
  const sutunSayisi = gosterSevk ? 8 : 6

  return (
    <>
      <FirmaBasligi />
      <BelgeBasligi baslik={baslik} altBaslik={belgeNo} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4">
        <BaskiAlan etiket="Belge No" deger={belgeNo} />
        <BaskiAlan etiket="Durum" deger={durumAdi} />
        {ustAlanlar.map((a) => (
          <BaskiAlan key={a.etiket} etiket={a.etiket} deger={a.deger} />
        ))}
        <BaskiAlan etiket={cariEtiketi} deger={cari.unvan} genis />
        <BaskiAlan etiket="Vergi No / TCKN" deger={cari.vergiNo} />
        <BaskiAlan etiket="Vergi Dairesi" deger={cari.vergiDair} />
        <BaskiAlan
          etiket="Adres"
          deger={[cari.adres, [cari.ilce, cari.il].filter(Boolean).join("/")]
            .filter(Boolean)
            .join(" · ")}
          genis
        />
        <BaskiAlan etiket="Telefon" deger={cari.gsm || cari.telefon} />
        <BaskiAlan etiket="Yetkili" deger={cari.yetkili} />
      </div>

      <table className="mt-4 w-full border-collapse text-[0.75rem]">
        <thead>
          <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Ürün / Hizmet</th>
            <th className="py-1 pr-2 text-right">Miktar</th>
            {gosterSevk ? (
              <>
                <th className="py-1 pr-2 text-right">Sevk</th>
                <th className="py-1 pr-2 text-right">Kalan</th>
              </>
            ) : null}
            <th className="py-1 pr-2 text-right">B. Fiyat</th>
            <th className="py-1 pr-2 text-right">KDV %</th>
            <th className="py-1 text-right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {kalemler.map((k, i) => {
            const miktar = Number(k.miktar.toString())
            const sevk = k.sevkMiktar ? Number(k.sevkMiktar.toString()) : 0
            return (
              <tr key={k.id} className="border-b border-neutral-300">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2">{k.aciklama}</td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {miktar.toLocaleString("tr-TR")} {k.birim}
                </td>
                {gosterSevk ? (
                  <>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {sevk.toLocaleString("tr-TR")}
                    </td>
                    <td className="py-1 pr-2 text-right font-medium tabular-nums">
                      {(miktar - sevk).toLocaleString("tr-TR")}
                    </td>
                  </>
                ) : null}
                <td className="py-1 pr-2 text-right tabular-nums">{para(k.birimFiyat, false)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {Number(k.kdvOrani.toString())}
                </td>
                <td className="py-1 text-right tabular-nums">{para(k.toplam, false)}</td>
              </tr>
            )
          })}
          {kalemler.length === 0 ? (
            <tr>
              <td colSpan={sutunSayisi} className="py-3 text-center text-neutral-500">
                Belgeye henüz kalem eklenmemiş.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="baski-toplam mt-3 ml-auto w-72 border border-neutral-300 p-3 text-[0.8125rem]">
        <BelgeOzetSatiri etiket="Ara Toplam" deger={para(araToplam)} />
        <BelgeOzetSatiri etiket="KDV" deger={para(kdvToplam)} />
        <BelgeOzetSatiri etiket="Genel Toplam" deger={para(genelToplam)} vurgulu />
      </div>

      {aciklama ? (
        <div className="mt-4 border border-neutral-300 p-3 text-[0.75rem]">
          <p className="mb-1 text-[0.6875rem] font-medium uppercase text-neutral-500">Açıklama</p>
          <p className="whitespace-pre-line">{aciklama}</p>
        </div>
      ) : null}

      {altNot ? <p className="mt-4 text-[0.75rem] text-neutral-700">{altNot}</p> : null}

      {firma?.bankaAdi || firma?.ibanNo ? (
        <div className="mt-4 border border-neutral-300 p-3 text-[0.75rem]">
          <p className="mb-1 text-[0.6875rem] font-medium uppercase text-neutral-500">
            Ödeme Bilgisi
          </p>
          <p>{[firma.bankaAdi, firma.ibanNo].filter(Boolean).join(" — ")}</p>
        </div>
      ) : null}

      <div className="baski-imza mt-8 grid grid-cols-2 gap-8 text-[0.8125rem]">
        <div>
          <p className="mb-8 font-medium">Düzenleyen</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
        <div>
          <p className="mb-8 font-medium">Onaylayan</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
      </div>

      <BaskiAltBilgi kullaniciAdi={kullaniciAdi} belgeNo={belgeNo} />
    </>
  )
}

function BelgeOzetSatiri({
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
