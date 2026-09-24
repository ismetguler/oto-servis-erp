"use client"

import { useActionState, useId, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Save, X } from "lucide-react"
import { useTanimDonusu } from "@/lib/kullan-tanim-donusu"
import { TanimEkleTusu } from "@/components/ui/tanim-ekle-tusu"

import { cariKaydet, type CariFormDurumu } from "@/app/(panel)/cari/actions"
import {
  CARI_TIP_ADLARI,
  CARI_TUR_ADLARI,
} from "@/app/(panel)/cari/sema"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { ListeVeyaYaz } from "@/components/liste-veya-yaz"
import { SekmeSeridi } from "@/components/ui/sekme-seridi"
import { TelefonGirdi } from "@/components/ui/telefon-girdi"
import { cn } from "@/lib/utils"

/**
 * CARİ KARTI FORMU
 *
 * Radix tabanlı Select yerine düz `<select>` kullanılıyor: form verisi
 * doğrudan FormData ile server action'a gidiyor, araya state yönetimi
 * girmiyor. JavaScript yüklenmeden de çalışır — servis ofisindeki zayıf
 * bağlantıda kayıt kaybolmasın diye bilinçli tercih.
 */

/** Sunucudan gelen mevcut kayıt. Yeni kayıtta undefined. */
export type CariBaslangic = {
  id: number
  kod: string
  unvan: string
  turu: string
  tipi: string
  vergiNo: string | null
  vergiDair: string | null
  yetkili: string | null
  yetkiliTelefon: string | null
  telefon: string | null
  gsm: string | null
  email: string | null
  adres: string | null
  il: string | null
  ilce: string | null
  banka: string | null
  bankaSube: string | null
  hesapNo: string | null
  ibanNo: string | null
  paraBirimi: string
  hesapLimiti: string
  riskLimiti: string
  vadeGun: number
  acilisBakiye: string
  acilisTuru: string
  ozelKod: string | null
  plasiyerId: number | null
  musteriSinifi: string | null
  notu: string | null
  /** Personel alanları — tarihler `yyyy-aa-gg` metni olarak gelir (date girdisi). */
  gorevi: string | null
  iseGirisTarihi: string | null
  istenCikisTarihi: string | null
  dogumTarihi: string | null
  sgkNo: string | null
  maas: string
  karaListe: boolean
  karaListeNedeni: string | null
  aktif: boolean
}

/** Plasiyer listesi: turu = PERSONEL olan cariler (Selpar ile aynı mantık). */
export type Plasiyer = { id: number; unvan: string }

const SEKMELER = [
  { anahtar: "genel", ad: "Genel Bilgiler" },
  { anahtar: "iletisim", ad: "İletişim / Adres" },
  // Yalnızca türü PERSONEL olan kartta görünür: müşteri kartında maaş/işe
  // giriş alanı istemiyoruz, ama personel de cari tablosunda durduğu için
  // ayrı bir form yazmak yerine sekme koşullu gösteriliyor.
  { anahtar: "personel", ad: "Personel Bilgileri", yalnizPersonel: true },
  { anahtar: "diger", ad: "Banka / Diğer" },
] as const

type SekmeAnahtari = (typeof SEKMELER)[number]["anahtar"]

export function CariFormu({
  baslangic,
  plasiyerler,
  musteriSiniflari = [],
  varsayilanTur = "MUSTERI",
  donus,
  ilkSekme,
}: {
  baslangic?: CariBaslangic
  plasiyerler: Plasiyer[]
  /** Ayarlar > Listeler ve Tanımlar > Müşteri Sınıfı türünden. */
  musteriSiniflari?: string[]
  /** Yeni kayıtta seçili gelecek tür — personel ekranı "PERSONEL" geçiyor. */
  varsayilanTur?: string
  /** Araç kabulden "+ Yeni Cari" ile gelindiyse kayıt sonrası oraya dön. */
  donus?: string
  /** Cari kartındaki bölüm "Düzenle" tuşlarından gelindiğinde açılacak sekme. */
  ilkSekme?: string
}) {
  const [durum, gonder, bekliyor] = useActionState<CariFormDurumu, FormData>(
    cariKaydet,
    {}
  )
  const [sekme, setSekme] = useState<SekmeAnahtari>(
    SEKMELER.find((s) => s.anahtar === ilkSekme)?.anahtar ?? "genel"
  )
  // Tür seçimi state'te tutuluyor çünkü "Personel Bilgileri" sekmesinin
  // görünürlüğü buna bağlı; kullanıcı türü değiştirir değiştirmez sekme
  // açılıp kapanmalı, kaydetmeyi beklememeli.
  const [turu, setTuru] = useState(baslangic?.turu ?? varsayilanTur)
  const personelMi = turu === "PERSONEL"
  const musteriSinifiDonus = useTanimDonusu("musteriSinifi")

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  const gorunenSekmeler = SEKMELER.filter((s) => personelMi || !("yalnizPersonel" in s))
  const sekmeIndeksi = gorunenSekmeler.findIndex((s) => s.anahtar === sekme)
  const sonSekmedeyiz = sekmeIndeksi === gorunenSekmeler.length - 1
  function ileriGit() {
    if (!sonSekmedeyiz) setSekme(gorunenSekmeler[sekmeIndeksi + 1].anahtar)
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}
      {donus ? <input type="hidden" name="donus" value={donus} /> : null}

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <SekmeSeridi
        sekmeler={gorunenSekmeler}
        etkin={sekme}
        degistir={setSekme}
      />

      <div className="p-4">
        {/* Sekmeler gizlenirken DOM'dan silinmiyor (`hidden`): aksi hâlde
            görünmeyen sekmedeki alanlar FormData'ya hiç girmez ve kaydederken
            sessizce boşalırdı. */}
        <Bolum acik={sekme === "genel"}>
          <Alan ad="kod" etiket="Cari Kodu" hata={hata("kod")} ipucu="Boş bırakılırsa otomatik üretilir">
            <Girdi name="kod" defaultValue={baslangic?.kod} placeholder="otomatik" />
          </Alan>

          <Alan ad="unvan" etiket="Ünvan / Ad Soyad" zorunlu hata={hata("unvan")} genis>
            <Girdi name="unvan" defaultValue={baslangic?.unvan} required autoFocus />
          </Alan>

          <Alan ad="turu" etiket="Cari Türü" zorunlu hata={hata("turu")}>
            <Secim
              name="turu"
              value={turu}
              onChange={(olay) => {
                setTuru(olay.target.value)
                // Personelden başka türe geçilince açık kalan personel
                // sekmesi ekranı boş gösterirdi; genel bilgilere dönülüyor.
                if (olay.target.value !== "PERSONEL" && sekme === "personel")
                  setSekme("genel")
              }}
            >
              {Object.entries(CARI_TUR_ADLARI).map(([deger, ad]) => (
                <option key={deger} value={deger}>
                  {ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="tipi" etiket="Tipi" zorunlu hata={hata("tipi")} ipucu="Ön değer: Şahıs">
            <Secim name="tipi" defaultValue={baslangic?.tipi ?? "SAHIS"}>
              {Object.entries(CARI_TIP_ADLARI).map(([deger, ad]) => (
                <option key={deger} value={deger}>
                  {ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="vergiNo"
            etiket="VKN / TCKN"
            hata={hata("vergiNo")}
            ipucu="Şirket 10, şahıs 11 rakam"
          >
            <Girdi
              name="vergiNo"
              defaultValue={baslangic?.vergiNo ?? ""}
              inputMode="numeric"
              maxLength={11}
            />
          </Alan>

          <Alan ad="vergiDair" etiket="Vergi Dairesi" hata={hata("vergiDair")}>
            <Girdi
              name="vergiDair"
              defaultValue={baslangic?.vergiDair ?? ""}
              placeholder="Örn: Kadıköy"
            />
          </Alan>

          <Alan ad="ozelKod" etiket="Özel Kod" hata={hata("ozelKod")}>
            <Girdi
              name="ozelKod"
              defaultValue={baslangic?.ozelKod ?? ""}
              placeholder="Örn: muhasebe programı kodu"
            />
          </Alan>

          <Alan
            ad="musteriSinifi"
            etiket="Müşteri Sınıfı"
            hata={hata("musteriSinifi")}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=MUSTERI_SINIFI"
                alan="musteriSinifi"
                baslik="Müşteri Sınıfı"
              />
            }
          >
            <ListeVeyaYaz
              key={musteriSinifiDonus ?? "sabit"}
              name="musteriSinifi"
              secenekler={musteriSiniflari}
              defaultValue={musteriSinifiDonus ?? baslangic?.musteriSinifi ?? ""}
              placeholder="Örn: A / bayi / perakende"
              maxLength={60}
            />
          </Alan>

          <div className="col-span-full flex flex-wrap items-center gap-6 pt-1">
            <Onay name="aktif" etiket="Aktif" defaultChecked={baslangic?.aktif ?? true} />
          </div>

          {/* Kara liste bu formdan DEĞİŞTİRİLMİYOR. Sebebi: her değişikliğin
              nedeni, tarihi ve kimin yaptığı kayda geçmek zorunda — cari
              kaydetmenin yan etkisi olarak değişirse geçmiş tutulamıyor.
              İşlem cari kartındaki "Kara Listeye Al / Çıkar" düğmesinde. */}
          {baslangic?.karaListe ? (
            <div className="col-span-full rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
              <span className="font-semibold">Bu cari kara listede.</span>{" "}
              {baslangic.karaListeNedeni ?? "Neden belirtilmemiş."} — çıkarmak için
              cari kartındaki “Kara Listeden Çıkar” düğmesini kullanın.
            </div>
          ) : null}
        </Bolum>

        <Bolum acik={sekme === "iletisim"}>
          <Alan ad="yetkili" etiket="Yetkili Kişi" hata={hata("yetkili")}>
            <Girdi
              name="yetkili"
              defaultValue={baslangic?.yetkili ?? ""}
              placeholder="Örn: Ahmet Yılmaz (satın alma)"
            />
          </Alan>

          <Alan ad="yetkiliTelefon" etiket="Yetkili Telefonu" hata={hata("yetkiliTelefon")}>
            <TelefonGirdi name="yetkiliTelefon" defaultValue={baslangic?.yetkiliTelefon} />
          </Alan>

          <Alan ad="telefon" etiket="Telefon" hata={hata("telefon")}>
            <TelefonGirdi name="telefon" defaultValue={baslangic?.telefon} />
          </Alan>

          <Alan ad="gsm" etiket="Cep Telefonu" hata={hata("gsm")}>
            <TelefonGirdi name="gsm" defaultValue={baslangic?.gsm} />
          </Alan>

          <Alan ad="email" etiket="E-Posta" hata={hata("email")}>
            <Girdi name="email" type="email" defaultValue={baslangic?.email ?? ""} />
          </Alan>

          <Alan
            ad="plasiyerId"
            etiket="Sorumlu Personel"
            hata={hata("plasiyerId")}
            ipucu="Bu cariyle ilgilenen personel"
          >
            <Secim
              name="plasiyerId"
              defaultValue={baslangic?.plasiyerId?.toString() ?? ""}
            >
              <option value="">— seçilmedi —</option>
              {plasiyerler.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.unvan}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="il" etiket="İl" hata={hata("il")}>
            <Girdi name="il" defaultValue={baslangic?.il ?? ""} placeholder="Örn: İstanbul" />
          </Alan>

          <Alan ad="ilce" etiket="İlçe" hata={hata("ilce")}>
            <Girdi name="ilce" defaultValue={baslangic?.ilce ?? ""} placeholder="Örn: Kadıköy" />
          </Alan>

          <Alan ad="adres" etiket="Adres" hata={hata("adres")} genis>
            <Metin
              name="adres"
              defaultValue={baslangic?.adres ?? ""}
              rows={3}
              placeholder="Örn: Atatürk Cad. No:12 Kat:3, Kadıköy / İstanbul"
            />
          </Alan>
        </Bolum>

        {/* Personel sekmesi yalnızca türü PERSONEL iken DOM'a giriyor: aksi
            hâlde müşteri kartı kaydedilirken maaş/komisyon alanları da
            FormData'ya girer ve boş değerlerle kartı kirletirdi. */}
        {personelMi ? (
          <Bolum acik={sekme === "personel"}>
            <Alan ad="gorevi" etiket="Görevi" hata={hata("gorevi")} ipucu="Usta, kaportacı, danışman…">
              <Girdi name="gorevi" defaultValue={baslangic?.gorevi ?? ""} />
            </Alan>

            <Alan ad="iseGirisTarihi" etiket="İşe Giriş Tarihi" hata={hata("iseGirisTarihi")}>
              <Girdi
                name="iseGirisTarihi"
                type="date"
                defaultValue={baslangic?.iseGirisTarihi ?? ""}
              />
            </Alan>

            <Alan
              ad="istenCikisTarihi"
              etiket="İşten Çıkış Tarihi"
              hata={hata("istenCikisTarihi")}
              ipucu="Doldurulursa kart pasife alınmalı"
            >
              <Girdi
                name="istenCikisTarihi"
                type="date"
                defaultValue={baslangic?.istenCikisTarihi ?? ""}
              />
            </Alan>

            <Alan ad="dogumTarihi" etiket="Doğum Tarihi" hata={hata("dogumTarihi")}>
              <Girdi
                name="dogumTarihi"
                type="date"
                defaultValue={baslangic?.dogumTarihi ?? ""}
              />
            </Alan>

            <Alan ad="sgkNo" etiket="SGK No" hata={hata("sgkNo")}>
              <Girdi name="sgkNo" defaultValue={baslangic?.sgkNo ?? ""} />
            </Alan>

            <Alan ad="maas" etiket="Maaş (₺)" hata={hata("maas")}>
              <Girdi
                name="maas"
                defaultValue={baslangic?.maas ?? "0"}
                inputMode="decimal"
                className="text-right"
              />
            </Alan>

            <div className="col-span-full text-[0.75rem] text-muted-foreground">
              Personelin ödeme/kesinti hareketleri normal cari hareketi olarak
              işlenir; kartın bakiyesi ve ekstresi müşterilerdeki ile aynı
              şekilde çalışır.
            </div>
          </Bolum>
        ) : null}

        <Bolum acik={sekme === "diger"}>
          <Alan ad="vadeGun" etiket="Vade (gün)" hata={hata("vadeGun")}>
            <Girdi
              name="vadeGun"
              defaultValue={(baslangic?.vadeGun ?? 0).toString()}
              inputMode="numeric"
              className="text-right"
            />
          </Alan>

          <Alan ad="hesapLimiti" etiket="Hesap Limiti (₺)" hata={hata("hesapLimiti")}>
            <Girdi
              name="hesapLimiti"
              defaultValue={baslangic?.hesapLimiti ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="riskLimiti" etiket="Risk Limiti (₺)" hata={hata("riskLimiti")}>
            <Girdi
              name="riskLimiti"
              defaultValue={baslangic?.riskLimiti ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan
            ad="paraBirimi"
            etiket="Para Birimi"
            hata={hata("paraBirimi")}
            ipucu="Ön değer: TRY (Türk Lirası)"
          >
            <Secim name="paraBirimi" defaultValue={baslangic?.paraBirimi ?? "TRY"}>
              <option value="TRY">TRY — Türk Lirası</option>
              <option value="USD">USD — Dolar</option>
              <option value="EUR">EUR — Euro</option>
            </Secim>
          </Alan>

          <Alan ad="banka" etiket="Banka" hata={hata("banka")}>
            <Girdi
              name="banka"
              defaultValue={baslangic?.banka ?? ""}
              placeholder="Örn: Ziraat Bankası"
            />
          </Alan>

          <Alan ad="bankaSube" etiket="Şube" hata={hata("bankaSube")}>
            <Girdi
              name="bankaSube"
              defaultValue={baslangic?.bankaSube ?? ""}
              placeholder="Örn: Kadıköy Şubesi"
            />
          </Alan>

          <Alan ad="hesapNo" etiket="Hesap No" hata={hata("hesapNo")}>
            <Girdi name="hesapNo" defaultValue={baslangic?.hesapNo ?? ""} />
          </Alan>

          <Alan ad="ibanNo" etiket="IBAN" hata={hata("ibanNo")} genis>
            <Girdi
              name="ibanNo"
              defaultValue={baslangic?.ibanNo ?? ""}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className="font-mono"
            />
          </Alan>

          <Alan ad="notu" etiket="Not" hata={hata("notu")} genis>
            <Metin
              name="notu"
              defaultValue={baslangic?.notu ?? ""}
              rows={4}
              placeholder="Örn: sözleşmeli filo müşterisi, ödemeler EFT ile alınır"
            />
          </Alan>

          <div className="col-span-full mt-2 border-t border-border pt-3">
            <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Açılış Bakiyesi
            </p>
            <p className="mb-3 max-w-2xl text-[0.75rem] text-muted-foreground">
              Sisteme geçmeden önceki devir borç/alacak. Buraya yazılan tutar
              carinin ekstresine ilk satır olarak düşer; sonradan
              değiştirilirse o satır da güncellenir.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Alan ad="acilisBakiye" etiket="Tutar (₺)" hata={hata("acilisBakiye")}>
                <Girdi
                  name="acilisBakiye"
                  defaultValue={baslangic?.acilisBakiye ?? "0"}
                  inputMode="decimal"
                  className="text-right"
                />
              </Alan>
              <Alan ad="acilisTuru" etiket="Yönü" hata={hata("acilisTuru")}>
                <Secim name="acilisTuru" defaultValue={baslangic?.acilisTuru ?? "BORC"}>
                  <option value="BORC">Borçlu bakiye (tahsil edilecek)</option>
                  <option value="ALACAK">Alacaklı bakiye (cariye ödenecek)</option>
                </Secim>
              </Alan>
            </div>
          </div>
        </Bolum>
      </div>

      {/* Kaydet çubuğu sayfanın altına yapışık: uzun formda kullanıcı
          kaydetmek için en başa dönmek zorunda kalmasın. */}
      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Button variant="outline" size="sm" asChild>
          <Link
            href={
              baslangic
                ? `${personelMi ? "/personel" : "/cari"}/${baslangic.id}`
                : personelMi
                  ? "/personel"
                  : "/cari"
            }
          >
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        <Button
          type="submit"
          size="sm"
          variant={sonSekmedeyiz ? "default" : "outline"}
          disabled={bekliyor}
        >
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        {sonSekmedeyiz ? null : (
          <Button type="button" size="sm" onClick={ileriGit}>
            İleri
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- */
/*  Küçük form parçaları — tek dosyada, çünkü sadece burada kullanılıyor  */
/* ---------------------------------------------------------------- */

function Bolum({ acik, children }: { acik: boolean; children: React.ReactNode }) {
  return (
    <div
      hidden={!acik}
      className="[&>*]:min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {children}
    </div>
  )
}

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  ipucu,
  genis,
  yanTus,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  /** Etiketin sağında duran küçük eylem (ör. "+ Yeni"). */
  yanTus?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
          {etiket}
        </label>
        {yanTus}
      </div>
      {children}
      {hata ? (
        <p className="text-[0.75rem] text-tehlike">{hata}</p>
      ) : (
        <>
          {zorunlu ? (
            <p className="text-[0.6875rem] text-muted-foreground">Zorunlu — boş bırakılamaz</p>
          ) : null}
          {ipucu ? (
            <p className="text-[0.6875rem] text-muted-foreground">{ipucu}</p>
          ) : null}
        </>
      )}
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

function Metin({
  name,
  className,
  ...kalan
}: React.ComponentProps<"textarea"> & { name: string }) {
  return (
    <textarea
      id={name}
      name={name}
      className={cn(ALAN_SINIFI, "h-auto resize-y py-1.5", className)}
      {...kalan}
    />
  )
}

function Onay({
  name,
  etiket,
  checked,
  onChange,
  defaultChecked,
}: {
  name: string
  etiket: string
  checked?: boolean
  onChange?: (deger: boolean) => void
  defaultChecked?: boolean
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-[0.8125rem]">
      <input
        id={id}
        name={name}
        type="checkbox"
        className="size-4 accent-primary"
        {...(onChange
          ? { checked, onChange: (e) => onChange(e.target.checked) }
          : { defaultChecked })}
      />
      {etiket}
    </label>
  )
}
