"use client"

import { useActionState, useState } from "react"
import { Loader2, Save } from "lucide-react"

import { firmaKaydet, type FirmaFormDurumu } from "@/app/(panel)/ayar/firma/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { TelefonGirdi } from "@/components/ui/telefon-girdi"
import { cn } from "@/lib/utils"

export type FirmaBaslangic = {
  unvan: string
  vergiNo: string | null
  vergiDair: string | null
  adres: string | null
  il: string | null
  ilce: string | null
  telefon: string | null
  gsm: string | null
  email: string | null
  webAdresi: string | null
  logoUrl: string | null
  logo: string | null
  bankaAdi: string | null
  ibanNo: string | null
  varsayilanKdv: string
  paraBirimi: string
}

const BOS_FORM: FirmaBaslangic = {
  unvan: "",
  vergiNo: null,
  vergiDair: null,
  adres: null,
  il: null,
  ilce: null,
  telefon: null,
  gsm: null,
  email: null,
  webAdresi: null,
  logoUrl: null,
  logo: null,
  bankaAdi: null,
  ibanNo: null,
  varsayilanKdv: "20",
  paraBirimi: "TRY",
}

/**
 * Kayıt yoksa (ilk açılış) `baslangic` `null` gelir, form `BOS_FORM` ile
 * boş gösterilir — kaydedince `id:1` ile create/upsert olur, sayfa
 * tekrar açıldığında artık dolu gelir.
 */
export function FirmaFormu({ baslangic }: { baslangic: FirmaBaslangic | null }) {
  const b = baslangic ?? BOS_FORM
  const [durum, gonder, bekliyor] = useActionState<FirmaFormDurumu, FormData>(firmaKaydet, {})
  // Logo önizlemesi anlık yazıldıkça güncellensin diye state'te de tutuluyor.
  const [logoUrl, setLogoUrl] = useState(b.logoUrl ?? "")
  // Yüklenen logo (base64 data URI). Menü + giriş ekranı bunu kullanır.
  const [logo, setLogo] = useState(b.logo ?? "")
  const [logoHatasi, setLogoHatasi] = useState<string | null>(null)
  const [baskiLogoHatasi, setBaskiLogoHatasi] = useState<string | null>(null)

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  /**
   * Seçilen görseli tarayıcıda `enBoy` px'e küçültüp `image/webp` data URI
   * döndürür — sunucuya küçük bir metin gidiyor, DB'de metin sütununda
   * duruyor. (Dosya yükleme servisi yok; Vercel'de kalıcı disk yok.)
   */
  async function gorseliKucult(dosya: File, enBoy: number): Promise<string> {
    const nesneUrl = URL.createObjectURL(dosya)
    try {
      const img = new Image()
      img.src = nesneUrl
      await img.decode()
      const oran = Math.min(1, enBoy / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * oran))
      const h = Math.max(1, Math.round(img.height * oran))
      const tuval = document.createElement("canvas")
      tuval.width = w
      tuval.height = h
      const ctx = tuval.getContext("2d")
      if (!ctx) throw new Error("ctx yok")
      ctx.drawImage(img, 0, 0, w, h)
      return tuval.toDataURL("image/webp", 0.9)
    } finally {
      URL.revokeObjectURL(nesneUrl)
    }
  }

  /** Menü + giriş ekranı logosu (küçük, 160px). */
  async function logoSec(dosya: File | null) {
    setLogoHatasi(null)
    if (!dosya) return
    if (!dosya.type.startsWith("image/")) {
      setLogoHatasi("Lütfen bir resim dosyası seçin.")
      return
    }
    try {
      setLogo(await gorseliKucult(dosya, 160))
    } catch {
      setLogoHatasi("Görsel okunamadı — başka bir dosya deneyin.")
    }
  }

  /** Baskı (fatura/rapor başlığı) logosu — biraz daha büyük (320px). */
  async function baskiLogoSec(dosya: File | null) {
    setBaskiLogoHatasi(null)
    if (!dosya) return
    if (!dosya.type.startsWith("image/")) {
      setBaskiLogoHatasi("Lütfen bir resim dosyası seçin.")
      return
    }
    try {
      setLogoUrl(await gorseliKucult(dosya, 320))
    } catch {
      setBaskiLogoHatasi("Görsel okunamadı — başka bir dosya deneyin.")
    }
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}
      {durum.basarili ? (
        <div className="mx-4 mt-4 rounded-md border border-basari/30 bg-basari-yumusak px-3 py-2 text-[0.8125rem] text-basari">
          {durum.basarili}
        </div>
      ) : null}

      <div className="[&>*]:min-w-0 grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_auto]">
        <div className="[&>*]:min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Alan ad="unvan" etiket="Ünvan" zorunlu hata={hata("unvan")} className="sm:col-span-2 lg:col-span-3">
            <Girdi name="unvan" defaultValue={b.unvan} required autoFocus />
          </Alan>

          <Alan ad="vergiNo" etiket="Vergi No" hata={hata("vergiNo")}>
            <Girdi name="vergiNo" defaultValue={b.vergiNo ?? ""} inputMode="numeric" />
          </Alan>

          <Alan ad="vergiDair" etiket="Vergi Dairesi" hata={hata("vergiDair")}>
            <Girdi name="vergiDair" defaultValue={b.vergiDair ?? ""} />
          </Alan>

          <Alan ad="telefon" etiket="Telefon" hata={hata("telefon")}>
            <TelefonGirdi name="telefon" defaultValue={b.telefon} />
          </Alan>

          <Alan ad="gsm" etiket="GSM" hata={hata("gsm")}>
            <TelefonGirdi name="gsm" defaultValue={b.gsm} />
          </Alan>

          <Alan ad="email" etiket="E-Posta" hata={hata("email")}>
            <Girdi name="email" type="email" defaultValue={b.email ?? ""} />
          </Alan>

          <Alan ad="webAdresi" etiket="Web Adresi" hata={hata("webAdresi")}>
            <Girdi name="webAdresi" defaultValue={b.webAdresi ?? ""} placeholder="https://..." />
          </Alan>

          <Alan ad="il" etiket="İl" hata={hata("il")}>
            <Girdi name="il" defaultValue={b.il ?? ""} />
          </Alan>

          <Alan ad="ilce" etiket="İlçe" hata={hata("ilce")}>
            <Girdi name="ilce" defaultValue={b.ilce ?? ""} />
          </Alan>

          <Alan ad="adres" etiket="Adres" hata={hata("adres")} className="sm:col-span-2 lg:col-span-3">
            <textarea
              id="adres"
              name="adres"
              defaultValue={b.adres ?? ""}
              rows={2}
              className={cn(ALAN_SINIFI, "h-auto resize-none py-1.5")}
            />
          </Alan>

          <Alan ad="bankaAdi" etiket="Banka Adı" hata={hata("bankaAdi")}
            ipucu="Fatura altında ödeme bilgisi olarak gösterilir"
          >
            <Girdi name="bankaAdi" defaultValue={b.bankaAdi ?? ""} />
          </Alan>

          <Alan ad="ibanNo" etiket="IBAN" hata={hata("ibanNo")}>
            <Girdi name="ibanNo" defaultValue={b.ibanNo ?? ""} placeholder="TR.." />
          </Alan>

          <Alan ad="varsayilanKdv" etiket="Varsayılan KDV Oranı (%)" zorunlu hata={hata("varsayilanKdv")}
            ipucu="Yeni kayıt formlarına ön değer olarak gelir"
          >
            <Girdi name="varsayilanKdv" defaultValue={b.varsayilanKdv} inputMode="decimal" required />
          </Alan>

          <Alan ad="paraBirimi" etiket="Para Birimi" zorunlu hata={hata("paraBirimi")}>
            <Secim name="paraBirimi" defaultValue={b.paraBirimi}>
              <option value="TRY">TRY — Türk Lirası</option>
              <option value="USD">USD — Amerikan Doları</option>
              <option value="EUR">EUR — Euro</option>
            </Secim>
          </Alan>

          <Alan
            ad="logoUrlDosya"
            etiket="Baskı Logosu (fatura / rapor başlığı)"
            hata={baskiLogoHatasi ?? hata("logoUrl")}
            ipucu="Bir resim yükleyin ya da dışarıda barındırılan bir logo linki yapıştırın"
            className="sm:col-span-2 lg:col-span-3"
          >
            <input type="hidden" name="logoUrl" value={logoUrl} />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="logoUrlDosya"
                  type="file"
                  accept="image/*"
                  onChange={(olay) => {
                    void baskiLogoSec(olay.target.files?.[0] ?? null)
                    olay.target.value = ""
                  }}
                  className="text-[0.8125rem] file:mr-2 file:rounded-sm file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-[0.8125rem]"
                />
                {logoUrl ? (
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="rounded-sm border border-input px-2 py-1 text-[0.75rem] text-tehlike hover:bg-tehlike/10"
                  >
                    Logoyu kaldır
                  </button>
                ) : null}
              </div>
              {!logoUrl.startsWith("data:") ? (
                <input
                  aria-label="Logo bağlantısı"
                  value={logoUrl}
                  onChange={(olay) => setLogoUrl(olay.target.value)}
                  placeholder="https://..."
                  className={ALAN_SINIFI}
                />
              ) : (
                <p className="text-[0.6875rem] text-muted-foreground">Yüklenen görsel kullanılıyor.</p>
              )}
            </div>
          </Alan>

          <Alan
            ad="logoDosya"
            etiket="Logo Yükle (sol menü ve giriş ekranı)"
            hata={logoHatasi ?? hata("logo")}
            ipucu="Telefon/bilgisayardan bir resim seçin — otomatik küçültülür"
            className="sm:col-span-2 lg:col-span-3"
          >
            <input type="hidden" name="logo" value={logo} />
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="logoDosya"
                type="file"
                accept="image/*"
                onChange={(olay) => {
                  void logoSec(olay.target.files?.[0] ?? null)
                  olay.target.value = ""
                }}
                className="text-[0.8125rem] file:mr-2 file:rounded-sm file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-[0.8125rem]"
              />
              {logo ? (
                <button
                  type="button"
                  onClick={() => setLogo("")}
                  className="rounded-sm border border-input px-2 py-1 text-[0.75rem] text-tehlike hover:bg-tehlike/10"
                >
                  Logoyu kaldır
                </button>
              ) : null}
            </div>
          </Alan>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-input p-4">
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[0.6875rem] font-medium text-muted-foreground">
              Menü / Giriş Logosu
            </p>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- base64 data URI
              <img
                src={logo}
                alt="Yüklenen logo önizleme"
                className="max-h-20 max-w-40 rounded-sm object-contain"
              />
            ) : (
              <p className="text-[0.75rem] text-muted-foreground">
                Yüklenmedi — yerleşik işaret kullanılır
              </p>
            )}
          </div>

          <div className="h-px w-full bg-border" />

          <p className="text-[0.6875rem] font-medium text-muted-foreground">Baskı Logosu</p>
          {logoUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element -- dışarıdan barındırılan serbest URL, next/image optimizasyonu gerekmiyor
            <img
              src={logoUrl.trim()}
              alt="Firma logosu önizleme"
              className="max-h-24 max-w-40 rounded-sm object-contain"
              onError={(olay) => {
                olay.currentTarget.style.display = "none"
              }}
              onLoad={(olay) => {
                olay.currentTarget.style.display = ""
              }}
            />
          ) : (
            <p className="text-[0.75rem] text-muted-foreground">Link girilmedi</p>
          )}
        </div>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  ipucu,
  className,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", className)}>
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
      {children}
      {hata ? (
        <p className="text-[0.75rem] text-tehlike">{hata}</p>
      ) : ipucu ? (
        <p className="text-[0.6875rem] text-muted-foreground">{ipucu}</p>
      ) : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

function Girdi({
  name,
  className,
  ...kalan
}: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

function Secim({
  name,
  className,
  ...kalan
}: React.ComponentProps<"select"> & { name: string }) {
  return <select id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}
