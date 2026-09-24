"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Plus, Save, X } from "lucide-react"

import { aracKaydet, type AracFormDurumu } from "@/app/(panel)/arac/actions"
import { AramaliSecim } from "@/components/aramali-secim"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { useTanimDonusu } from "@/lib/kullan-tanim-donusu"
import { SekmeSeridi } from "@/components/ui/sekme-seridi"
import { TanimEkleTusu } from "@/components/ui/tanim-ekle-tusu"
import { cn } from "@/lib/utils"

/**
 * ARAÇ KARTI FORMU
 *
 * Cari formuyla aynı desen: düz `<select>`/`<input>`, FormData doğrudan
 * server action'a gider, sekmeler `hidden` ile gizlenir (DOM'dan silinmez —
 * silinseydi görünmeyen sekmedeki alanlar kaydederken sessizce boşalırdı).
 */

export type AracBaslangic = {
  id: number
  plaka: string
  saseNo: string | null
  cariId: number | null
  aracTuru: string | null
  marka: string | null
  model: string | null
  modelYili: number | null
  renk: string | null
  yakitTuru: string | null
  vitesTuru: string | null
  kasaTipi: string | null
  motorHacmi: string | null
  sonKm: number | null
  projesi: string | null
  aracVersiyon: string | null
  ruhsatTarihi: string | null
  ruhsatSeriNo: string | null
  ruhsatQr: string | null
  trafikSigBaslama: string | null
  trafikSigBitis: string | null
  kaskoBaslama: string | null
  kaskoBitis: string | null
  garantiBaslangic: string | null
  garantiBitis: string | null
  muayeneBitis: string | null
  akuBaslama: string | null
  akuBitis: string | null
  akuMarka: string | null
  lpgTankSonTarih: string | null
  lpgTankMarka: string | null
  sonrakiBakimTarih: string | null
  sonrakiBakimKm: number | null
  trigerDegisimKm: number | null
  trigerDegisimTarih: string | null
  aracIdSi: string | null
  moKodu: string | null
  poKodu: string | null
  notlar: string | null
  aktif: boolean
}

export type Tanim = { id: number; ad: string }
export type SahipCari = { id: number; kod: string; unvan: string }

const SEKMELER = [
  { anahtar: "genel", ad: "Genel / Sahip" },
  { anahtar: "teknik", ad: "Teknik Bilgiler" },
  { anahtar: "ruhsat", ad: "Ruhsat" },
  { anahtar: "takip", ad: "Garanti / Sigorta / Bakım" },
] as const

type SekmeAnahtari = (typeof SEKMELER)[number]["anahtar"]

export function AracFormu({
  baslangic,
  dropdownlar,
  katalog,
  sahipCariler,
  varsayilanCariId,
  donus,
}: {
  baslangic?: AracBaslangic
  dropdownlar: {
    markalar: Tanim[]
    renkler: Tanim[]
    yakitTurleri: Tanim[]
    vitesTurleri: Tanim[]
    kasaTipleri: Tanim[]
    aracTurleri: Tanim[]
  }
  sahipCariler: SahipCari[]
  /** Araç marka/model kataloğu (SA-5). marka → model bağı buradan. */
  katalog: { markalar: string[]; modelHaritasi: Record<string, string[]> }
  /** "/cari/[id]/duzenle-arac" gibi bağlamlardan gelen ön seçili sahip. */
  varsayilanCariId?: number
  /** Araç kabulden "+ Yeni Araç" ile gelindiyse kayıt sonrası oraya dön. */
  donus?: string
}) {
  const [durum, gonder, bekliyor] = useActionState<AracFormDurumu, FormData>(
    aracKaydet,
    {}
  )
  const [sekme, setSekme] = useState<SekmeAnahtari>("genel")
  const [marka, setMarka] = useState(useTanimDonusu("marka") ?? baslangic?.marka ?? "")
  // Model, markaya bağlı: marka değişince model temizlenir (yanlış marka-model
  // eşleşmesi kalmasın). Bu yüzden kontrollü alan.
  const [model, setModel] = useState(baslangic?.model ?? "")

  // Araç Türü / Renk / Yakıt / Vites / Kasa Tipi: listede aranan yoksa
  // "+ Yeni" ile /ayar/tanim'e gidilir, eklenince buraya dönülür.
  const [aracTuru, setAracTuru] = useState(
    useTanimDonusu("aracTuru") ?? baslangic?.aracTuru ?? ""
  )
  const [renk, setRenk] = useState(useTanimDonusu("renk") ?? baslangic?.renk ?? "")
  const [yakitTuru, setYakitTuru] = useState(
    useTanimDonusu("yakitTuru") ?? baslangic?.yakitTuru ?? ""
  )
  const [vitesTuru, setVitesTuru] = useState(
    useTanimDonusu("vitesTuru") ?? baslangic?.vitesTuru ?? ""
  )
  const [kasaTipi, setKasaTipi] = useState(
    useTanimDonusu("kasaTipi") ?? baslangic?.kasaTipi ?? ""
  )

  // Marka seçenekleri: katalog + Tanım(ARAC_MARKA) + kayıtlı değer.
  // Aynı marka hem "Ford" hem "FORD" gelebiliyor (katalog düzgün yazım,
  // Tanım tablosu büyük harf) — büyük/küçük harf duyarsız tekilleştir,
  // düzgün yazımı (tamamı büyük harf OLMAYAN) tercih et.
  const markaSecenekleri = (() => {
    const secili = new Map<string, string>()
    const aday = [
      ...katalog.markalar,
      ...dropdownlar.markalar.map((t) => t.ad),
      ...(baslangic?.marka ? [baslangic.marka] : []),
    ]
    const sadelestir = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/ı/g, "i")
    for (const ad of aday) {
      const anahtar = sadelestir(ad)
      const oncekiVar = secili.get(anahtar)
      const oncekiCirkin = oncekiVar && oncekiVar === oncekiVar.toUpperCase()
      if (!oncekiVar || (oncekiCirkin && ad !== ad.toUpperCase())) {
        secili.set(anahtar, ad)
      }
    }
    return [...secili.values()].sort((a, b) => a.localeCompare(b, "tr"))
  })()
  const modelSecenekleri = katalog.modelHaritasi[marka] ?? []

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  const sekmeIndeksi = SEKMELER.findIndex((s) => s.anahtar === sekme)
  const sonSekmedeyiz = sekmeIndeksi === SEKMELER.length - 1
  function ileriGit() {
    if (!sonSekmedeyiz) setSekme(SEKMELER[sekmeIndeksi + 1].anahtar)
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}
      {donus ? <input type="hidden" name="donus" value={donus} /> : null}

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
          {/* SA-3.2: mükerrer plaka — çakışan aracın kartına doğrudan git. */}
          {durum.cakisanAracId ? (
            <>
              {" "}
              <Link
                href={`/arac/${durum.cakisanAracId}`}
                className="font-medium underline underline-offset-2"
              >
                Kartı aç →
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <SekmeSeridi
        sekmeler={SEKMELER}
        etkin={sekme}
        degistir={setSekme}
      />

      <div className="p-4">
        <Bolum acik={sekme === "genel"}>
          <Alan ad="plaka" etiket="Plaka" zorunlu hata={hata("plaka")}>
            <Girdi
              name="plaka"
              defaultValue={baslangic?.plaka}
              placeholder="38ABC123"
              required
              autoFocus
              className="font-mono uppercase"
            />
          </Alan>

          <Alan
            ad="cariId"
            etiket="Araç Sahibi (Cari)"
            hata={hata("cariId")}
            genis
            yanTus={
              <YeniKayitTusu
                yol={`/cari/yeni?donus=aracYeni`}
                etiket="Yeni Cari"
                baslik="Araç sahibi listede yok — yeni cari kartı aç"
              />
            }
          >
<AramaliSecim
              name="cariId"
              defaultValue={(baslangic?.cariId ?? varsayilanCariId ?? "").toString()}
              bosEtiket="— seçilmedi —"
              placeholder="Ünvan veya cari kodu yazın…"
              secenekler={sahipCariler.map((c) => ({ value: String(c.id), etiket: c.unvan, aciklama: c.kod }))}
            />
          </Alan>

          <Alan
            ad="aracTuru"
            etiket="Araç Türü"
            hata={hata("aracTuru")}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=ARAC_TURU"
                alan="aracTuru"
                baslik="Araç Türü"
              />
            }
          >
            <Secim name="aracTuru" value={aracTuru} onChange={(e) => setAracTuru(e.target.value)}>
              <option value="">— seçilmedi —</option>
              {dropdownlar.aracTurleri.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="projesi" etiket="Proje" hata={hata("projesi")}>
            <Girdi
              name="projesi"
              defaultValue={baslangic?.projesi ?? ""}
              placeholder="Örn: filo bakım anlaşması adı"
            />
          </Alan>

          <div className="col-span-full pt-1">
            <Onay name="aktif" etiket="Aktif" defaultChecked={baslangic?.aktif ?? true} />
          </div>
        </Bolum>

        <Bolum acik={sekme === "teknik"}>
          <Alan
            ad="marka"
            etiket="Marka"
            hata={hata("marka")}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=ARAC_MARKA"
                alan="marka"
                baslik="Araç Markası"
              />
            }
          >
            <Secim
              name="marka"
              value={marka}
              onChange={(e) => {
                setMarka(e.target.value)
                setModel("")
              }}
            >
              <option value="">— seçilmedi —</option>
              {markaSecenekleri.map((ad) => (
                <option key={ad} value={ad}>
                  {ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="model"
            etiket="Model"
            hata={hata("model")}
            ipucu={marka ? "Listeden seçin ya da elle yazın" : "Önce marka seçin"}
          >
            {/* Telefonda <datalist> açılmıyor — listeden seçim native <select>
                ile yapılıyor, altındaki kutu serbest yazım için duruyor. */}
            {modelSecenekleri.length > 0 && (
              <Secim
                name="_modelListeSec"
                aria-label="Model listesinden seç"
                value={modelSecenekleri.includes(model) ? model : ""}
                onChange={(e) => e.target.value && setModel(e.target.value)}
                className="mb-1.5"
              >
                <option value="">— listeden seç —</option>
                {modelSecenekleri.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Secim>
            )}
            <Girdi
              name="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Örn: Corolla"
            />
          </Alan>

          <Alan ad="modelYili" etiket="Model Yılı" hata={hata("modelYili")}>
            <Girdi
              name="modelYili"
              defaultValue={baslangic?.modelYili?.toString() ?? ""}
              inputMode="numeric"
              maxLength={4}
              className="text-right"
            />
          </Alan>

          <Alan
            ad="renk"
            etiket="Renk"
            hata={hata("renk")}
            yanTus={
              <TanimEkleTusu hedefYol="/ayar/tanim?tur=ARAC_RENK" alan="renk" baslik="Renk" />
            }
          >
            <Secim name="renk" value={renk} onChange={(e) => setRenk(e.target.value)}>
              <option value="">— seçilmedi —</option>
              {dropdownlar.renkler.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="yakitTuru"
            etiket="Yakıt Türü"
            hata={hata("yakitTuru")}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=YAKIT_TURU"
                alan="yakitTuru"
                baslik="Yakıt Türü"
              />
            }
          >
            <Secim name="yakitTuru" value={yakitTuru} onChange={(e) => setYakitTuru(e.target.value)}>
              <option value="">— seçilmedi —</option>
              {dropdownlar.yakitTurleri.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="vitesTuru"
            etiket="Vites Türü"
            hata={hata("vitesTuru")}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=VITES_TURU"
                alan="vitesTuru"
                baslik="Vites Türü"
              />
            }
          >
            <Secim name="vitesTuru" value={vitesTuru} onChange={(e) => setVitesTuru(e.target.value)}>
              <option value="">— seçilmedi —</option>
              {dropdownlar.vitesTurleri.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="kasaTipi"
            etiket="Kasa Tipi"
            hata={hata("kasaTipi")}
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=KASA_TIPI"
                alan="kasaTipi"
                baslik="Kasa Tipi"
              />
            }
          >
            <Secim name="kasaTipi" value={kasaTipi} onChange={(e) => setKasaTipi(e.target.value)}>
              <option value="">— seçilmedi —</option>
              {dropdownlar.kasaTipleri.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="motorHacmi" etiket="Motor Hacmi" hata={hata("motorHacmi")}>
            <Girdi
              name="motorHacmi"
              defaultValue={baslangic?.motorHacmi ?? ""}
              placeholder="Örn: 1.6"
            />
          </Alan>

          <Alan ad="sonKm" etiket="Son KM" hata={hata("sonKm")}>
            <Girdi
              name="sonKm"
              defaultValue={baslangic?.sonKm?.toString() ?? ""}
              inputMode="numeric"
              className="text-right"
            />
          </Alan>

          <Alan ad="saseNo" etiket="Şase No" hata={hata("saseNo")}>
            <Girdi name="saseNo" defaultValue={baslangic?.saseNo ?? ""} className="font-mono" />
          </Alan>

          <Alan ad="aracVersiyon" etiket="Araç Versiyonu" hata={hata("aracVersiyon")}>
            <Girdi
              name="aracVersiyon"
              defaultValue={baslangic?.aracVersiyon ?? ""}
              placeholder="Örn: 1.5 TDCi Titanium"
            />
          </Alan>
          {/* SA-4.1: "Motor Çalışma Süresi" alanı kaldırıldı (kabul formundan
              da). DB kolonu şemada duruyor, migration yok. */}
        </Bolum>

        <Bolum acik={sekme === "ruhsat"}>
          <Alan ad="ruhsatTarihi" etiket="Ruhsat Tarihi" hata={hata("ruhsatTarihi")}>
            <Girdi name="ruhsatTarihi" type="date" defaultValue={baslangic?.ruhsatTarihi ?? ""} />
          </Alan>

          <Alan ad="ruhsatSeriNo" etiket="Ruhsat Seri No" hata={hata("ruhsatSeriNo")}>
            <Girdi
              name="ruhsatSeriNo"
              defaultValue={baslangic?.ruhsatSeriNo ?? ""}
              className="font-mono"
              placeholder="Örn: AA123456"
            />
          </Alan>

          <Alan
            ad="ruhsatQr"
            etiket="Ruhsat QR Verisi"
            hata={hata("ruhsatQr")}
            ipucu="QR ile okunan ham ruhsat metni (opsiyonel)"
            genis
          >
            <Metin name="ruhsatQr" defaultValue={baslangic?.ruhsatQr ?? ""} rows={2} />
          </Alan>

          <div className="col-span-full mt-2 border-t border-border pt-3">
            <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Dış Sistem Referans Kodları
            </p>
            <div className="[&>*]:min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Alan ad="aracIdSi" etiket="Araç ID" hata={hata("aracIdSi")}>
                <Girdi name="aracIdSi" defaultValue={baslangic?.aracIdSi ?? ""} className="font-mono" />
              </Alan>
              <Alan ad="moKodu" etiket="MO Kodu" hata={hata("moKodu")}>
                <Girdi name="moKodu" defaultValue={baslangic?.moKodu ?? ""} className="font-mono" />
              </Alan>
              <Alan ad="poKodu" etiket="PO Kodu" hata={hata("poKodu")}>
                <Girdi name="poKodu" defaultValue={baslangic?.poKodu ?? ""} className="font-mono" />
              </Alan>
            </div>
          </div>
        </Bolum>

        <Bolum acik={sekme === "takip"}>
          <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TarihCifti
              baslik="Trafik Sigortası"
              basAd="trafikSigBaslama"
              bitAd="trafikSigBitis"
              bas={baslangic?.trafikSigBaslama}
              bit={baslangic?.trafikSigBitis}
              hataBas={hata("trafikSigBaslama")}
              hataBit={hata("trafikSigBitis")}
            />
            <TarihCifti
              baslik="Kasko"
              basAd="kaskoBaslama"
              bitAd="kaskoBitis"
              bas={baslangic?.kaskoBaslama}
              bit={baslangic?.kaskoBitis}
              hataBas={hata("kaskoBaslama")}
              hataBit={hata("kaskoBitis")}
            />
            <TarihCifti
              baslik="Garanti"
              basAd="garantiBaslangic"
              bitAd="garantiBitis"
              bas={baslangic?.garantiBaslangic}
              bit={baslangic?.garantiBitis}
              hataBas={hata("garantiBaslangic")}
              hataBit={hata("garantiBitis")}
            />
            <TarihCifti
              baslik="Akü Garantisi"
              basAd="akuBaslama"
              bitAd="akuBitis"
              bas={baslangic?.akuBaslama}
              bit={baslangic?.akuBitis}
              hataBas={hata("akuBaslama")}
              hataBit={hata("akuBitis")}
              ekAlan={
                <Alan ad="akuMarka" etiket="Akü Markası" hata={hata("akuMarka")}>
                  <Girdi
                    name="akuMarka"
                    defaultValue={baslangic?.akuMarka ?? ""}
                    placeholder="Örn: Mutlu, Varta, İnci"
                  />
                </Alan>
              }
            />
          </div>

          <div className="[&>*]:min-w-0 col-span-full mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border-t border-border pt-3">
            <Alan ad="muayeneBitis" etiket="Muayene Bitiş" hata={hata("muayeneBitis")}>
              <Girdi name="muayeneBitis" type="date" defaultValue={baslangic?.muayeneBitis ?? ""} />
            </Alan>

            <Alan ad="lpgTankSonTarih" etiket="LPG Tank Son Tarihi" hata={hata("lpgTankSonTarih")}>
              <Girdi
                name="lpgTankSonTarih"
                type="date"
                defaultValue={baslangic?.lpgTankSonTarih ?? ""}
              />
            </Alan>

            <Alan ad="lpgTankMarka" etiket="LPG Tank Markası" hata={hata("lpgTankMarka")}>
              <Girdi
                name="lpgTankMarka"
                defaultValue={baslangic?.lpgTankMarka ?? ""}
                placeholder="Örn: BRC, Atiker"
              />
            </Alan>
          </div>

          <div className="col-span-full mt-3 border-t border-border pt-3">
            <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Periyodik Bakım Takibi
            </p>
            <div className="[&>*]:min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Alan ad="sonrakiBakimTarih" etiket="Sonraki Bakım Tarihi" hata={hata("sonrakiBakimTarih")}>
                <Girdi
                  name="sonrakiBakimTarih"
                  type="date"
                  defaultValue={baslangic?.sonrakiBakimTarih ?? ""}
                />
              </Alan>
              <Alan ad="sonrakiBakimKm" etiket="Sonraki Bakım KM" hata={hata("sonrakiBakimKm")}>
                <Girdi
                  name="sonrakiBakimKm"
                  defaultValue={baslangic?.sonrakiBakimKm?.toString() ?? ""}
                  inputMode="numeric"
                  className="text-right"
                />
              </Alan>
              <Alan ad="trigerDegisimKm" etiket="Triger Değişim KM" hata={hata("trigerDegisimKm")}>
                <Girdi
                  name="trigerDegisimKm"
                  defaultValue={baslangic?.trigerDegisimKm?.toString() ?? ""}
                  inputMode="numeric"
                  className="text-right"
                />
              </Alan>
              <Alan ad="trigerDegisimTarih" etiket="Triger Değişim Tarihi" hata={hata("trigerDegisimTarih")}>
                <Girdi
                  name="trigerDegisimTarih"
                  type="date"
                  defaultValue={baslangic?.trigerDegisimTarih ?? ""}
                />
              </Alan>
            </div>
          </div>

          <div className="col-span-full mt-3 border-t border-border pt-3">
            <Alan ad="notlar" etiket="Araç Notları" hata={hata("notlar")} genis>
              <Metin
                name="notlar"
                defaultValue={baslangic?.notlar ?? ""}
                rows={4}
                placeholder="Örn: sürekli aynı şoför kullanıyor, arka lastikler yeni"
              />
            </Alan>
          </div>
        </Bolum>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Button variant="outline" size="sm" asChild>
          <Link href={baslangic ? `/arac/${baslangic.id}` : "/arac"}>
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

function TarihCifti({
  baslik,
  basAd,
  bitAd,
  bas,
  bit,
  hataBas,
  hataBit,
  ekAlan,
}: {
  baslik: string
  basAd: string
  bitAd: string
  bas?: string | null
  bit?: string | null
  hataBas?: string
  hataBit?: string
  ekAlan?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 text-[0.75rem] font-semibold text-muted-foreground">{baslik}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Alan ad={basAd} etiket="Başlangıç" hata={hataBas}>
          <Girdi name={basAd} type="date" defaultValue={bas ?? ""} />
        </Alan>
        <Alan ad={bitAd} etiket="Bitiş" hata={hataBit}>
          <Girdi name={bitAd} type="date" defaultValue={bit ?? ""} />
        </Alan>
      </div>
      {ekAlan ? <div className="mt-2">{ekAlan}</div> : null}
    </div>
  )
}

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
  /** Etiketin sağında duran küçük eylem (ör. "+ Yeni Cari"). */
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

/**
 * "+ Yeni Cari" — araç sahibi listede yoksa kaçış kapısı (kabul formundaki
 * aynı desen). Cari kartı ekranına gider, kayıt bitince `?donus=aracYeni`
 * sayesinde buraya döner ve yeni açılan cari sahip olarak seçili gelir
 * (bkz. lib/donus.ts). Bu formda doldurulanlar kaydedilmediği için
 * ayrılmadan önce kullanıcı uyarılıyor.
 */
function YeniKayitTusu({
  yol,
  etiket,
  baslik,
}: {
  yol: string
  etiket: string
  baslik: string
}) {
  return (
    <Link
      href={yol}
      title={baslik}
      onClick={(olay) => {
        if (
          !window.confirm(
            `${etiket} ekranına gidilecek. Bu formda doldurduklarınız kaybolur — devam edilsin mi?`
          )
        ) {
          olay.preventDefault()
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5 text-[0.6875rem] font-medium text-primary transition-colors hover:bg-accent hover:underline"
    >
      <Plus className="size-3" aria-hidden />
      {etiket}
    </Link>
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
