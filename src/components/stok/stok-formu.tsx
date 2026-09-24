"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Save, X } from "lucide-react"

import { stokKaydet, type StokFormDurumu } from "@/app/(panel)/stok/actions"
import {
  PARA_BIRIMI_ADLARI,
  URUN_TIPI_ADLARI,
  URUN_TIPI_SECENEKLERI,
  urunTipiNormalize,
} from "@/app/(panel)/stok/sema"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { useTanimDonusu } from "@/lib/kullan-tanim-donusu"
import { ListeVeyaYaz } from "@/components/liste-veya-yaz"
import { SekmeSeridi } from "@/components/ui/sekme-seridi"
import { TanimEkleTusu } from "@/components/ui/tanim-ekle-tusu"
import { cn } from "@/lib/utils"

/**
 * STOK KARTI FORMU
 *
 * Cari kartındaki desenin aynısı: düz `<select>`/`<input>`, sekmeler DOM'dan
 * silinmiyor (`hidden`) — aksi hâlde görünmeyen sekmedeki alanlar
 * FormData'ya hiç girmez ve kaydederken sessizce boşalırdı.
 */

export type StokBaslangic = {
  id: number
  kod: string
  ad: string
  barkod: string | null
  tipi: string | null
  uretici: string | null
  ureticiKodu: string | null
  orijinalKodu: string | null
  muadilNo: string | null
  ozelNo: string | null
  grupKodu: string | null
  urunGrubu: string | null
  gtipNo: string | null
  uygunMarka: string | null
  uygunModel: string | null
  uygunYilBas: number | null
  uygunYilBit: number | null
  birim: string
  acilisMiktar: string
  minSeviye: string
  maxSeviye: string
  depoId: number | null
  rafYeri: string | null
  alisFiyat: string
  satisFiyat: string
  ortalamaMaliyet: string
  kdvOrani: string
  paraBirimi: string
  desen: string | null
  mevsim: string | null
  hizYuk: string | null
  yakitDirenci: string | null
  gurultuSeviyesi: string | null
  gurultuSinifi: string | null
  resimUrl: string | null
  teknikBilgi: string | null
  aciklama: string | null
  aktif: boolean
}

export type DepoSecenek = { id: number; kod: string; ad: string }

const SEKMELER = [
  { anahtar: "genel", ad: "Genel Bilgiler" },
  { anahtar: "stok", ad: "Stok / Depo" },
  { anahtar: "fiyat", ad: "Fiyat" },
  { anahtar: "arac", ad: "Araç Uygunluğu" },
  { anahtar: "lastik", ad: "Lastik Bilgileri" },
  { anahtar: "diger", ad: "Diğer" },
] as const

type SekmeAnahtari = (typeof SEKMELER)[number]["anahtar"]

/**
 * Ürün tipine göre GÖRÜNEN sekmeler (SA-5 / madde 20). Gizlenen sekmelerin
 * `Bolum`'ları DOM'da kalır (`hidden`), alanları ön değerleriyle yine
 * FormData'ya girer — böylece tip değiştirip kaydetmek sessizce alan
 * boşaltmaz (HAFIZA 47).
 *   HIZMET → stok/depo ve lastik yok (hizmetin stoğu tutulmaz)
 *   ARAC   → lastik yok (araca özel parçada lastik alanları anlamsız)
 */
const TIPE_GORE_SEKMELER: Record<string, readonly SekmeAnahtari[]> = {
  PARCA: ["genel", "stok", "fiyat", "lastik", "diger"],
  HIZMET: ["genel", "fiyat", "diger"],
  ARAC: ["genel", "stok", "fiyat", "arac", "diger"],
}

const AY = new Date().getFullYear() + 1
const YILLAR = Array.from({ length: AY - 1950 + 1 }, (_, i) => AY - i)

export function StokFormu({
  baslangic,
  depolar,
  katalog,
  ureticiSecenekleri = [],
  urunGrubuSecenekleri = [],
}: {
  baslangic?: StokBaslangic
  depolar: DepoSecenek[]
  katalog: { markalar: string[]; modelHaritasi: Record<string, string[]> }
  /** Ayarlar > Listeler ve Tanımlar > Üretici / Ürün Grubu türlerinden. */
  ureticiSecenekleri?: string[]
  urunGrubuSecenekleri?: string[]
}) {
  const [durum, gonder, bekliyor] = useActionState<StokFormDurumu, FormData>(
    stokKaydet,
    {}
  )
  const [tip, setTip] = useState(urunTipiNormalize(baslangic?.tipi))
  const [sekme, setSekme] = useState<SekmeAnahtari>("genel")
  const [uygunMarka, setUygunMarka] = useState(baslangic?.uygunMarka ?? "")

  // "+ Yeni" ile Üretici/Ürün Grubu tanımı ekleyip dönüldüğünde
  // ListeVeyaYaz'ı (kendi içinde uncontrolled) yeni değerle yeniden
  // kurmak için `key` olarak kullanılıyor.
  const ureticiDonus = useTanimDonusu("uretici")
  const urunGrubuDonus = useTanimDonusu("urunGrubu")

  // Seçili markanın modelleri; katalogda olmayan (elle girilmiş eski) bir
  // model varsa listeye eklenir ki düzenlemede kaybolmasın.
  const uygunModeller = (() => {
    const liste = [...(katalog.modelHaritasi[uygunMarka] ?? [])]
    const mevcut = baslangic?.uygunModel
    if (mevcut && uygunMarka === baslangic?.uygunMarka && !liste.includes(mevcut)) {
      liste.unshift(mevcut)
    }
    return liste
  })()

  const gorunenSekmeler = SEKMELER.filter((s) =>
    TIPE_GORE_SEKMELER[tip].includes(s.anahtar)
  )
  const hizmet = tip === "HIZMET"

  // Tip değişince seçili sekme gizlenmiş olabilir — o an genel gösterilir
  // (state'i efekt içinde zorlamıyoruz, sadece türetiyoruz).
  const etkinSekme: SekmeAnahtari = TIPE_GORE_SEKMELER[tip].includes(sekme)
    ? sekme
    : "genel"

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  const sekmeIndeksi = gorunenSekmeler.findIndex((s) => s.anahtar === etkinSekme)
  const sonSekmedeyiz = sekmeIndeksi === gorunenSekmeler.length - 1
  function ileriGit() {
    if (!sonSekmedeyiz) setSekme(gorunenSekmeler[sekmeIndeksi + 1].anahtar)
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <SekmeSeridi
        sekmeler={gorunenSekmeler}
        etkin={etkinSekme}
        degistir={setSekme}
      />

      <div className="p-4">
        <Bolum acik={etkinSekme === "genel"}>
          <Alan ad="kod" etiket="Stok Kodu" hata={hata("kod")} ipucu="Boş bırakılırsa otomatik üretilir">
            <Girdi name="kod" defaultValue={baslangic?.kod} placeholder="otomatik" />
          </Alan>

          <Alan ad="ad" etiket="Ürün Adı" zorunlu hata={hata("ad")} genis>
            <Girdi name="ad" defaultValue={baslangic?.ad} required autoFocus />
          </Alan>

          <Alan ad="barkod" etiket="Barkod" hata={hata("barkod")} gizli={hizmet}>
            <Girdi name="barkod" defaultValue={baslangic?.barkod ?? ""} />
          </Alan>

          <Alan
            ad="tipi"
            etiket="Ürün Tipi"
            hata={hata("tipi")}
            ipucu={
              hizmet
                ? "Hizmetin stoğu tutulmaz — depo/miktar alanları gizlenir"
                : tip === "ARAC"
                  ? "Belirli bir araca özel parça — marka/model uygunluğu girilir"
                  : "Seçime göre form alanları değişir"
            }
          >
            <Secim
              name="tipi"
              value={tip}
              onChange={(e) => setTip(urunTipiNormalize(e.target.value))}
            >
              {URUN_TIPI_SECENEKLERI.map((t) => (
                <option key={t} value={t}>
                  {URUN_TIPI_ADLARI[t]}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="uretici"
            etiket="Marka / Üretici"
            hata={hata("uretici")}
            gizli={hizmet}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=URETICI"
                alan="uretici"
                baslik="Üretici"
              />
            }
          >
            <ListeVeyaYaz
              key={ureticiDonus ?? "sabit"}
              name="uretici"
              secenekler={ureticiSecenekleri}
              defaultValue={ureticiDonus ?? baslangic?.uretici ?? ""}
              placeholder="Örn: Bosch, Mann, Valeo"
              maxLength={100}
            />
          </Alan>

          <Alan ad="ureticiKodu" etiket="Üretici Kodu" hata={hata("ureticiKodu")} gizli={hizmet}>
            <Girdi
              name="ureticiKodu"
              defaultValue={baslangic?.ureticiKodu ?? ""}
              placeholder="Örn: 0 986 452 041"
            />
          </Alan>

          <Alan ad="orijinalKodu" etiket="Orijinal (OEM) Kodu" hata={hata("orijinalKodu")} gizli={hizmet}>
            <Girdi
              name="orijinalKodu"
              defaultValue={baslangic?.orijinalKodu ?? ""}
              placeholder="Örn: 04E115561H"
            />
          </Alan>

          <Alan ad="muadilNo" etiket="Muadil Kodları" hata={hata("muadilNo")} ipucu="Birden fazlaysa virgülle ayırın" gizli={hizmet}>
            <Girdi
              name="muadilNo"
              defaultValue={baslangic?.muadilNo ?? ""}
              placeholder="Örn: W712/75, OC90"
            />
          </Alan>

          <Alan ad="ozelNo" etiket="Özel No" hata={hata("ozelNo")} gizli={hizmet}>
            <Girdi
              name="ozelNo"
              defaultValue={baslangic?.ozelNo ?? ""}
              placeholder="Örn: kendi etiket/stok numaranız"
            />
          </Alan>

          <Alan ad="grupKodu" etiket="Grup Kodu" hata={hata("grupKodu")} gizli={hizmet}>
            <Girdi
              name="grupKodu"
              defaultValue={baslangic?.grupKodu ?? ""}
              placeholder="Örn: FILTRE, FREN, YAG"
            />
          </Alan>

          <Alan
            ad="urunGrubu"
            etiket="Ürün Grubu"
            hata={hata("urunGrubu")}
            gizli={hizmet}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=URUN_GRUBU"
                alan="urunGrubu"
                baslik="Ürün Grubu"
              />
            }
          >
            <ListeVeyaYaz
              key={urunGrubuDonus ?? "sabit"}
              name="urunGrubu"
              secenekler={urunGrubuSecenekleri}
              defaultValue={urunGrubuDonus ?? baslangic?.urunGrubu ?? ""}
              placeholder="Örn: Yağ filtresi"
              maxLength={100}
            />
          </Alan>

          <Alan ad="gtipNo" etiket="GTİP No" hata={hata("gtipNo")} gizli={hizmet}>
            <Girdi name="gtipNo" defaultValue={baslangic?.gtipNo ?? ""} />
          </Alan>

          <div className="col-span-full flex flex-wrap items-center gap-6 pt-1">
            <Onay name="aktif" etiket="Aktif" defaultChecked={baslangic?.aktif ?? true} />
          </div>
        </Bolum>

        <Bolum acik={etkinSekme === "stok"}>
          <Alan ad="birim" etiket="Birim" hata={hata("birim")} ipucu="Ön değer: ADET">
            <Girdi name="birim" defaultValue={baslangic?.birim ?? "ADET"} />
          </Alan>

          <Alan
            ad="acilisMiktar"
            etiket="Açılış Miktarı"
            hata={hata("acilisMiktar")}
            ipucu="Sisteme geçmeden önceki mevcut miktar"
          >
            <Girdi
              name="acilisMiktar"
              defaultValue={baslangic?.acilisMiktar ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="minSeviye" etiket="Minimum Seviye" hata={hata("minSeviye")}>
            <Girdi
              name="minSeviye"
              defaultValue={baslangic?.minSeviye ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="maxSeviye" etiket="Maksimum Seviye" hata={hata("maxSeviye")}>
            <Girdi
              name="maxSeviye"
              defaultValue={baslangic?.maxSeviye ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="depoId" etiket="Depo" hata={hata("depoId")}>
            <Secim name="depoId" defaultValue={baslangic?.depoId?.toString() ?? ""}>
              <option value="">— seçilmedi —</option>
              {depolar.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="rafYeri" etiket="Raf / Konum" hata={hata("rafYeri")}>
            <Girdi
              name="rafYeri"
              defaultValue={baslangic?.rafYeri ?? ""}
              placeholder="Örn: A-3, Raf 12"
            />
          </Alan>
        </Bolum>

        <Bolum acik={etkinSekme === "fiyat"}>
          <Alan ad="alisFiyat" etiket="Alış Fiyatı" hata={hata("alisFiyat")} gizli={hizmet}>
            <Girdi
              name="alisFiyat"
              defaultValue={baslangic?.alisFiyat ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="satisFiyat" etiket="Satış Fiyatı" hata={hata("satisFiyat")}>
            <Girdi
              name="satisFiyat"
              defaultValue={baslangic?.satisFiyat ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="ortalamaMaliyet" etiket="Ortalama Maliyet" hata={hata("ortalamaMaliyet")} gizli={hizmet}>
            <Girdi
              name="ortalamaMaliyet"
              defaultValue={baslangic?.ortalamaMaliyet ?? "0"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="kdvOrani" etiket="KDV Oranı (%)" hata={hata("kdvOrani")} ipucu="Ön değer: %20">
            <Girdi
              name="kdvOrani"
              defaultValue={baslangic?.kdvOrani ?? "20"}
              inputMode="decimal"
              className="text-right"
            />
          </Alan>

          <Alan ad="paraBirimi" etiket="Para Birimi" hata={hata("paraBirimi")} ipucu="Ön değer: TRY">
            <Secim name="paraBirimi" defaultValue={baslangic?.paraBirimi ?? "TRY"}>
              {Object.entries(PARA_BIRIMI_ADLARI).map(([deger, ad]) => (
                <option key={deger} value={deger}>
                  {ad}
                </option>
              ))}
            </Secim>
          </Alan>
        </Bolum>

        <Bolum acik={etkinSekme === "arac"}>
          <div className="col-span-full text-[0.75rem] text-muted-foreground">
            Bu parça belirli bir araca özel. Marka ve modeli listeden seçin;
            uygun olduğu model yılı aralığını girebilirsiniz (isteğe bağlı).
          </div>

          <Alan ad="uygunMarka" etiket="Marka" hata={hata("uygunMarka")}>
            <Secim
              name="uygunMarka"
              value={uygunMarka}
              onChange={(e) => setUygunMarka(e.target.value)}
            >
              <option value="">— seçilmedi —</option>
              {katalog.markalar.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="uygunModel" etiket="Model" hata={hata("uygunModel")}>
            <Secim
              name="uygunModel"
              defaultValue={
                uygunMarka === baslangic?.uygunMarka ? (baslangic?.uygunModel ?? "") : ""
              }
              key={uygunMarka}
              disabled={!uygunMarka}
            >
              <option value="">
                {uygunMarka ? "— seçilmedi —" : "önce marka seçin"}
              </option>
              {uygunModeller.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="uygunYilBas" etiket="Model Yılı — Baştan" hata={hata("uygunYilBas")}>
            <Secim name="uygunYilBas" defaultValue={baslangic?.uygunYilBas?.toString() ?? ""}>
              <option value="">—</option>
              {YILLAR.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="uygunYilBit" etiket="Model Yılı — Sona" hata={hata("uygunYilBit")}>
            <Secim name="uygunYilBit" defaultValue={baslangic?.uygunYilBit?.toString() ?? ""}>
              <option value="">—</option>
              {YILLAR.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Secim>
          </Alan>
        </Bolum>

        <Bolum acik={etkinSekme === "lastik"}>
          <div className="col-span-full text-[0.75rem] text-muted-foreground">
            Yalnızca lastik satan bayiler için — diğer ürünlerde boş bırakılabilir.
          </div>

          <Alan ad="desen" etiket="Desen" hata={hata("desen")}>
            <Girdi
              name="desen"
              defaultValue={baslangic?.desen ?? ""}
              placeholder="Örn: Primacy 4"
            />
          </Alan>

          <Alan ad="mevsim" etiket="Mevsim" hata={hata("mevsim")}>
            <Girdi name="mevsim" defaultValue={baslangic?.mevsim ?? ""} placeholder="Yaz / Kış / 4 Mevsim" />
          </Alan>

          <Alan ad="hizYuk" etiket="Hız / Yük Endeksi" hata={hata("hizYuk")}>
            <Girdi
              name="hizYuk"
              defaultValue={baslangic?.hizYuk ?? ""}
              placeholder="Örn: 91V"
            />
          </Alan>

          <Alan ad="yakitDirenci" etiket="Yakıt Direnci" hata={hata("yakitDirenci")}>
            <Girdi name="yakitDirenci" defaultValue={baslangic?.yakitDirenci ?? ""} placeholder="A-G" />
          </Alan>

          <Alan ad="gurultuSeviyesi" etiket="Gürültü Seviyesi (dB)" hata={hata("gurultuSeviyesi")}>
            <Girdi
              name="gurultuSeviyesi"
              defaultValue={baslangic?.gurultuSeviyesi ?? ""}
              placeholder="Örn: 71"
            />
          </Alan>

          <Alan ad="gurultuSinifi" etiket="Gürültü Sınıfı" hata={hata("gurultuSinifi")}>
            <Girdi
              name="gurultuSinifi"
              defaultValue={baslangic?.gurultuSinifi ?? ""}
              placeholder="Örn: B"
            />
          </Alan>
        </Bolum>

        <Bolum acik={etkinSekme === "diger"}>
          <Alan ad="resimUrl" etiket="Resim Bağlantısı" hata={hata("resimUrl")} genis>
            <Girdi
              name="resimUrl"
              defaultValue={baslangic?.resimUrl ?? ""}
              placeholder="Örn: https://... .jpg"
            />
          </Alan>

          <Alan ad="teknikBilgi" etiket="Teknik Bilgi" hata={hata("teknikBilgi")} genis>
            <Metin
              name="teknikBilgi"
              defaultValue={baslangic?.teknikBilgi ?? ""}
              rows={3}
              placeholder="Örn: 10W-40, tam sentetik, 5 lt"
            />
          </Alan>

          <Alan ad="aciklama" etiket="Açıklama" hata={hata("aciklama")} genis>
            <Metin
              name="aciklama"
              defaultValue={baslangic?.aciklama ?? ""}
              rows={3}
              placeholder="Örn: raf ömrü 2 yıl, orijinal muadili"
            />
          </Alan>
        </Bolum>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Button variant="outline" size="sm" asChild>
          <Link href={baslangic ? `/stok/${baslangic.id}` : "/stok"}>
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
  gizli,
  yanTus,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  /** true ise alan görünmez ama DOM'da kalır — inputlar FormData'ya yine girer. */
  gizli?: boolean
  /** Etiketin sağında duran küçük eylem (ör. "+ Yeni"). */
  yanTus?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div hidden={gizli} className={cn("form-alani", genis && "sm:col-span-2")}>
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
  defaultChecked,
}: {
  name: string
  etiket: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-[0.8125rem]">
      <input
        name={name}
        type="checkbox"
        className="size-4 accent-primary"
        defaultChecked={defaultChecked}
      />
      {etiket}
    </label>
  )
}
