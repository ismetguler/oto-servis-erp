import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  DONANIM_SATIRLARI,
  ISCILIK_SATIRLARI,
} from "@/app/(panel)/servis/ekspertiz/sema"
import { ekspertizGetir } from "@/app/(panel)/servis/ekspertiz/veri"
import {
  BaskiAltBilgi,
  BaskiSayfasi,
  BelgeBasligi,
  FirmaBasligi,
} from "@/components/baski/baski-sablonu"
import { AracSemasi, type PanelSecimi } from "@/components/ekspertiz/arac-semasi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { miktar, para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Eksper Sureti" }
export const dynamic = "force-dynamic"

/**
 * EKSPER SURETİ — matbu bloknotun A4 karşılığı.
 *
 * Yerleşim kâğıttaki sırayı birebir izliyor (üst blok + VAR/YOK çeklisti →
 * parça tablosu → işçilik kırılımı → onay imzaları), ALTINA Selim abinin
 * istediği boya/değişen şeması eklendi. Kâğıda alışkın kişi çıktıda
 * kaybolmasın diye hiçbir blok yerinden oynatılmadı.
 *
 * Parça tablosu en az 12 satır basıyor: kâğıt gibi, kalan satırlar boş ve
 * çizgili kalsın ki serviste elle eklenebilsin.
 */
export default async function EkspertizBaskisi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const k = await ekspertizGetir(kayitId)
  if (!k) notFound()

  const EN_AZ_SATIR = 12
  const bosSatirAdedi = Math.max(0, EN_AZ_SATIR - k.kalemler.length)

  return (
    <BaskiSayfasi>
      <div className="yazdirma-disi mb-4 flex justify-end">
        <YazdirDugmesi etiket="Formu Yazdır" />
      </div>

      <FirmaBasligi />
      <BelgeBasligi
        baslik="Eksper Sureti"
        altBaslik={`${k.ekspertizNo}${k.matbuNo ? ` · Matbu No: ${k.matbuNo}` : ""}`}
      />

      {/* --- ÜST BLOK: sol tarafta dosya bilgileri, sağda donanım çeklisti --- */}
      <div className="flex gap-3">
        <div className="flex-1 border border-neutral-400">
          <table className="w-full text-[0.75rem]">
            <tbody>
              <UstSatir etiket="Sayın" deger={k.cari.unvan} genis />
              <UstSatir
                etiket="Tel"
                deger={[k.cari.gsm, k.cari.telefon].filter(Boolean).join(" / ")}
                genis
              />
              <UstCift
                solEtiket="Şöför T.C."
                solDeger={k.soforTc}
                sagEtiket="Km"
                sagDeger={k.km?.toLocaleString("tr-TR")}
              />
              <UstCift
                solEtiket="T.C. Kimlik No"
                solDeger={k.tcKimlikNo}
                sagEtiket="Başlangıç Tarihi"
                sagDeger={tarih(k.baslangicTarihi)}
              />
              <UstCift
                solEtiket="Plaka"
                solDeger={plakaBicim(k.arac.plaka)}
                sagEtiket="Teslim Tarihi"
                sagDeger={k.teslimTarihi ? tarih(k.teslimTarihi) : ""}
              />
              <UstCift
                solEtiket="Poliçe No"
                solDeger={k.policeNo}
                sagEtiket="Eksper"
                sagDeger={k.eksperAdi}
              />
              <UstCift
                solEtiket="Dosya No"
                solDeger={k.dosyaNo}
                sagEtiket="Sigorta"
                sagDeger={k.sigortaAdi}
              />
              <UstCift
                solEtiket="Modeli"
                solDeger={[k.arac.model, k.arac.modelYili].filter(Boolean).join(" ")}
                sagEtiket="H.D. No"
                sagDeger={k.hdNo}
              />
              <UstCift
                solEtiket="Markası"
                solDeger={k.arac.marka}
                sagEtiket="Karşı Araç Tel"
                sagDeger={k.karsiAracTel}
              />
              <UstCift
                solEtiket="Şasi No"
                solDeger={k.arac.saseNo}
                sagEtiket="Karşı Araç T.C."
                sagDeger={k.karsiAracTc}
              />
            </tbody>
          </table>
        </div>

        {/* Donanım çeklisti — kâğıttaki VAR / YOK kutucukları */}
        <div className="w-44 shrink-0 border border-neutral-400">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-1 border-b border-neutral-400 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase">
            <span />
            <span className="w-7 text-center">Var</span>
            <span className="w-7 text-center">Yok</span>
          </div>
          {DONANIM_SATIRLARI.map((s) => {
            const deger = k[s.ad]
            return (
              <div
                key={s.ad}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-1 px-1.5 py-[0.1rem] text-[0.6875rem]"
              >
                <span className="font-medium">{s.etiket}</span>
                <Kutucuk isaretli={deger === true} />
                <Kutucuk isaretli={deger === false} />
              </div>
            )
          })}
        </div>
      </div>

      {/* --- PARÇA TABLOSU --- */}
      <table className="mt-3 w-full border-collapse border border-neutral-400 text-[0.75rem]">
        <thead>
          <tr className="border-b border-neutral-400 text-[0.6875rem] font-bold uppercase">
            <th className="w-14 border-r border-neutral-400 px-1 py-1">Adet</th>
            <th className="border-r border-neutral-400 px-1 py-1 text-left">Parça İsmi</th>
            <th className="w-16 border-r border-neutral-400 px-1 py-1">Miktar</th>
            <th className="w-24 border-r border-neutral-400 px-1 py-1">Birim Fiyat</th>
            <th className="w-24 px-1 py-1">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {k.kalemler.map((kalem) => (
            <tr key={kalem.id} className="border-b border-neutral-300">
              <td className="border-r border-neutral-300 px-1 py-[0.2rem] text-center tabular-nums">
                {miktar(kalem.miktar)}
              </td>
              <td className="border-r border-neutral-300 px-1 py-[0.2rem]">
                {kalem.aciklama}
              </td>
              <td className="border-r border-neutral-300 px-1 py-[0.2rem] text-center">
                {kalem.birim}
              </td>
              <td className="border-r border-neutral-300 px-1 py-[0.2rem] text-right tabular-nums">
                {para(kalem.birimFiyat, false)}
              </td>
              <td className="px-1 py-[0.2rem] text-right tabular-nums">
                {para(kalem.toplam, false)}
              </td>
            </tr>
          ))}
          {/* Kâğıt gibi: kalan satırlar boş ve çizgili kalsın, serviste elle
              parça eklenebilsin. */}
          {Array.from({ length: bosSatirAdedi }).map((_, i) => (
            <tr key={`bos-${i}`} className="border-b border-neutral-300">
              <td className="border-r border-neutral-300 px-1 py-[0.35rem]">&nbsp;</td>
              <td className="border-r border-neutral-300 px-1 py-[0.35rem]" />
              <td className="border-r border-neutral-300 px-1 py-[0.35rem]" />
              <td className="border-r border-neutral-300 px-1 py-[0.35rem]" />
              <td className="px-1 py-[0.35rem]" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-400 text-[0.75rem] font-medium">
            <td colSpan={4} className="border-r border-neutral-400 px-1 py-1 text-right">
              Parça Toplamı
            </td>
            <td className="px-1 py-1 text-right tabular-nums">
              {para(k.parcaToplam, false)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-2 text-center text-[0.75rem] font-bold uppercase">
        Bu ekspertiz bir ön tahmindir, kesin sonuç onarım neticesi belli olacaktır.
      </p>

      {/* --- İŞÇİLİK KIRILIMI --- */}
      <div className="mt-2 grid grid-cols-2 gap-x-8 border border-neutral-400 p-2 text-[0.75rem]">
        {ISCILIK_SATIRLARI.map((s) => (
          <div
            key={s.ad}
            className="flex items-baseline justify-between gap-2 border-b border-dotted border-neutral-400 py-[0.1rem]"
          >
            <span>{s.etiket}</span>
            <span className="tabular-nums">
              {k[s.ad] > 0 ? para(k[s.ad], false) : ""}
            </span>
          </div>
        ))}
      </div>

      {/* --- TOPLAMLAR --- */}
      <div className="mt-2 flex justify-end">
        <table className="text-[0.8125rem]">
          <tbody>
            <ToplamSatiri etiket="Parça Toplamı" deger={k.parcaToplam} />
            <ToplamSatiri etiket="İşçilik Toplamı" deger={k.iscilikToplam} />
            <ToplamSatiri etiket="Ara Toplam" deger={k.araToplam} />
            <ToplamSatiri etiket="KDV" deger={k.kdvToplam} />
            <ToplamSatiri etiket="Genel Toplam" deger={k.genelToplam} kalin />
          </tbody>
        </table>
      </div>

      {/* --- BOYA / DEĞİŞEN ŞEMASI (kâğıtta yok, Selim abinin isteği) --- */}
      <div className="baski-imza mt-4 border border-neutral-400 p-2">
        <p className="mb-1 text-[0.6875rem] font-bold uppercase">
          Boyalı veya Değişen Parça
        </p>
        <AracSemasi baslangic={k.panelSecimi as PanelSecimi} saltOkunur />
      </div>

      {k.notlar ? (
        <div className="mt-2 border border-neutral-400 p-2 text-[0.75rem]">
          <span className="font-bold uppercase">Notlar: </span>
          <span className="whitespace-pre-wrap">{k.notlar}</span>
        </div>
      ) : null}

      <div className="baski-imza mt-8 grid grid-cols-2 gap-8">
        <div className="border-t border-black pt-1 text-center text-[0.75rem]">
          Servis Onayı
          <br />
          Ad Soyad / İmza
        </div>
        <div className="border-t border-black pt-1 text-center text-[0.75rem]">
          Müşteri Onayı
          <br />
          Ad Soyad / İmza
        </div>
      </div>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={k.ekspertizNo} />
    </BaskiSayfasi>
  )
}

/** Üst bloğun tek sütuna yayılan satırı (Sayın, Tel). */
function UstSatir({
  etiket,
  deger,
  genis,
}: {
  etiket: string
  deger?: string | null
  genis?: boolean
}) {
  return (
    <tr className="border-b border-neutral-300">
      <td className="w-28 px-1.5 py-[0.15rem] align-baseline text-neutral-600">
        {etiket}
      </td>
      <td className="px-1.5 py-[0.15rem] font-medium" colSpan={genis ? 3 : 1}>
        {deger || ""}
      </td>
    </tr>
  )
}

/** Üst bloğun iki sütunlu satırı — kâğıtta sol ve sağ sütun yan yana. */
function UstCift({
  solEtiket,
  solDeger,
  sagEtiket,
  sagDeger,
}: {
  solEtiket: string
  solDeger?: string | null
  sagEtiket: string
  sagDeger?: string | null
}) {
  return (
    <tr className="border-b border-neutral-300">
      <td className="w-28 px-1.5 py-[0.15rem] align-baseline text-neutral-600">
        {solEtiket}
      </td>
      <td className="px-1.5 py-[0.15rem] font-medium">{solDeger || ""}</td>
      <td className="w-28 border-l border-neutral-300 px-1.5 py-[0.15rem] align-baseline text-neutral-600">
        {sagEtiket}
      </td>
      <td className="px-1.5 py-[0.15rem] font-medium">{sagDeger || ""}</td>
    </tr>
  )
}

/** VAR / YOK kutucuğu — işaretliyse içine çarpı basılır. */
function Kutucuk({ isaretli }: { isaretli: boolean }) {
  return (
    <span className="mx-auto grid size-[0.85rem] place-items-center border border-neutral-700 text-[0.6rem] leading-none font-bold">
      {isaretli ? "X" : ""}
    </span>
  )
}

function ToplamSatiri({
  etiket,
  deger,
  kalin,
}: {
  etiket: string
  deger: number
  kalin?: boolean
}) {
  return (
    <tr className={kalin ? "font-bold" : undefined}>
      <td className="py-[0.1rem] pr-6 text-right text-neutral-700">{etiket}</td>
      <td className="py-[0.1rem] text-right tabular-nums">{para(deger)}</td>
    </tr>
  )
}
