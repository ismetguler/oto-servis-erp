import Image from "next/image"

import { firmaBilgisi } from "@/app/(panel)/ayar/firma/veri"
import { tarihSaat } from "@/lib/bicim"

/**
 * BASKI ŞABLONU — ortak A4 çıktı iskeleti
 *
 * 11.6'dan itibaren her yazdırılabilir belge (Kabul Kartı, Fatura, İrsaliye,
 * Teklif, Sipariş, Barkod/Etiket dışındakiler) bu iskeleti kullanır — tek
 * yerde firma başlığı, tek yerde sayfa altı. `window.print()` kullanılıyor,
 * ayrı bir PDF kütüphanesi YOK (`YazdirDugmesi` deseninin aynısı, bkz.
 * `components/rapor-araclari.tsx`). Ekran görünümü de kâğıt gibi sade
 * tutuldu ki önizleme ile çıktı birbirini tutsun; asıl gizleme/açma işini
 * yine `globals.css`teki `@media print` bloğu (`yazdirma-disi` /
 * `yazdirma-alani`) yapıyor.
 *
 * Kullanım: `<BaskiSayfasi belgeBasligi="Araç Kabul Formu" altBilgi="...">`
 * içine belgeye özel içeriği koy. Firma bilgisi burada TEK yerden
 * (`/ayar/firma`daki `Firma` tablosu) okunuyor, her şablon kendi
 * sorgusunu yazmasın diye.
 */
export async function FirmaBasligi() {
  const firma = await firmaBilgisi()

  return (
    <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
      <div className="flex items-start gap-3">
        {firma?.logoUrl ? (
          <Image
            src={firma.logoUrl}
            alt=""
            width={64}
            height={64}
            className="size-16 object-contain"
            unoptimized
          />
        ) : null}
        <div>
          <p className="text-[1.1rem] font-bold leading-tight">
            {firma?.unvan ?? "Firma unvanı tanımlı değil"}
          </p>
          <p className="max-w-md text-[0.75rem] leading-snug text-neutral-700">
            {[firma?.adres, [firma?.ilce, firma?.il].filter(Boolean).join("/")]
              .filter(Boolean)
              .join(" · ") || null}
          </p>
          <p className="text-[0.75rem] leading-snug text-neutral-700">
            {[
              firma?.telefon ? `Tel: ${firma.telefon}` : null,
              firma?.gsm ? `GSM: ${firma.gsm}` : null,
              firma?.vergiDair && firma?.vergiNo
                ? `${firma.vergiDair} V.D. — ${firma.vergiNo}`
                : firma?.vergiNo,
            ]
              .filter(Boolean)
              .join(" · ") || null}
          </p>
          {firma?.email || firma?.webAdresi ? (
            <p className="text-[0.75rem] leading-snug text-neutral-700">
              {[
                firma?.email ? `E-posta: ${firma.email}` : null,
                firma?.webAdresi ? `Web: ${firma.webAdresi}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Sayfa altı: kimin, ne zaman yazdırdığı. Denetim/dosyalama için — Selpar'da
 * da her döküm alt köşesinde bu bilgi var.
 */
export function BaskiAltBilgi({
  kullaniciAdi,
  belgeNo,
}: {
  kullaniciAdi: string
  belgeNo?: string
}) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-neutral-300 pt-2 text-[0.6875rem] text-neutral-500">
      <span>
        Yazdıran: {kullaniciAdi} · {tarihSaat(new Date())}
      </span>
      <span className="flex items-center gap-3">
        {belgeNo ? <span>{belgeNo}</span> : null}
        <span className="print:hidden">Sayfa 1</span>
        <span className="baski-sayfa-no hidden print:inline" />
      </span>
    </div>
  )
}

/**
 * Belge başlığı — belge adı + varsa belge numarası/tarihi tek satırda.
 */
export function BelgeBasligi({
  baslik,
  altBaslik,
}: {
  baslik: string
  altBaslik?: string
}) {
  return (
    <div className="mt-4 mb-3 flex items-baseline justify-between">
      <h1 className="text-[1rem] font-bold uppercase tracking-wide">{baslik}</h1>
      {altBaslik ? (
        <span className="text-[0.8125rem] text-neutral-700">{altBaslik}</span>
      ) : null}
    </div>
  )
}

/**
 * Etiket: değer çifti — kabul formu, teslim formu gibi çoğu şablonun
 * iki sütunlu "alan adı / değer" bloklarında kullanılıyor.
 */
export function BaskiAlan({
  etiket,
  deger,
  genis = false,
  gizleBossa = false,
}: {
  etiket: string
  deger: React.ReactNode
  genis?: boolean
  /**
   * Boş alanı hiç çizme. Kabul formu gibi çok alanlı çıktılarda yarıdan
   * fazlası "—" olunca kâğıt "doldurulmamış form" gibi duruyordu (12.4b).
   * Elle doldurulacak noktalı satırlar bundan muaf — onlar `BaskiNoktali`.
   */
  gizleBossa?: boolean
}) {
  const bos =
    deger === null ||
    deger === undefined ||
    deger === "" ||
    (Array.isArray(deger) && deger.length === 0)
  if (bos && gizleBossa) return null

  return (
    <div className={genis ? "col-span-2" : undefined}>
      <p className="text-[0.6875rem] font-medium uppercase text-neutral-500">
        {etiket}
      </p>
      <p className="text-[0.8125rem] font-medium text-black">{deger || "—"}</p>
    </div>
  )
}

/**
 * Elle doldurulacak noktalı satır — Selpar'ın kabul formunda lastik diş
 * derinliği ("Sağ Ön ......") ve şarj durumu böyle basılıyor: değer yok,
 * müşteri/danışman kâğıda yazıyor.
 */
export function BaskiNoktali({ etiket }: { etiket: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-[0.8125rem]">
      <span className="text-neutral-600">{etiket}</span>
      <span className="inline-block min-w-[6rem] flex-1 border-b border-dotted border-neutral-500" />
    </span>
  )
}

/**
 * Ekranda önizleme, kâğıtta A4 çıktı olarak davranan dış çerçeve. Yazdırma
 * dışındaki her sayfa `(panel)` yerleşimini kullanıyor; bu şablonlar bilinçli
 * olarak o yerleşimin dışında (kendi `layout.tsx`si var, bkz. klasör),
 * çünkü kâğıda sol menü/üst bar gitmemeli.
 */
export function BaskiSayfasi({ children }: { children: React.ReactNode }) {
  return (
    <div className="baski-belge mx-auto max-w-[210mm] bg-white p-8 text-black print:max-w-none print:p-0">
      {children}
    </div>
  )
}
