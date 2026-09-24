"use client"

import { useActionState, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, ExternalLink, Loader2, Plus, Save, X } from "lucide-react"

import { kabulKaydet, type KabulFormDurumu } from "@/app/(panel)/servis/kabul/actions"
import {
  GARANTI_DURUM_ETIKETI,
  GARANTI_DURUMLARI,
} from "@/app/(panel)/servis/kabul/sema"
import type { KabulAraci, KabulBaslangic, KabulCarisi } from "@/app/(panel)/servis/kabul/veri"
import type { AktifFiloSozlesmesi } from "@/app/(panel)/cari/filo/veri"
import { YapilanIslerGirisi } from "@/components/kabul/yapilan-isler-girisi"
import { AramaliSecim, type AramaliSecenek } from "@/components/aramali-secim"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { useTanimDonusu } from "@/lib/kullan-tanim-donusu"
import { plakaSadelestir } from "@/lib/plaka"
import { SekmeSeridi } from "@/components/ui/sekme-seridi"
import { TanimEkleTusu } from "@/components/ui/tanim-ekle-tusu"
import { cn } from "@/lib/utils"

/**
 * ARAÇ KABUL FORMU — Selpar'daki "KabulKarti" ekranının karşılığı.
 *
 * Selpar'daki 4 bölüm birebir korundu (VERİ-MODELİ.md):
 *   A) Kabul Bilgileri  B) Araç Bilgileri  C) Garanti/Sigorta  D) Müşteri
 *
 * B, C ve D bölümleri seçilen araç/cari kartından OKUNUR şekilde gösterilir.
 * Selpar da bu ekranda o bilgileri düzenlettirmiyor, sadece gösteriyor —
 * aynı veriyi iki ekrandan düzenletmek er geç iki farklı doğru üretir.
 * Kabulde gerçekten değişen alanlar (km, yakıt, triger, motor saati)
 * A bölümünde ve araç kartına geri yazılıyor.
 *
 * Sekmeler `hidden` ile gizlenir, DOM'dan silinmez: silinseydi görünmeyen
 * sekmedeki alanlar kaydederken sessizce boşalırdı.
 */

export type Tanim = { id: number; ad: string }
export type Formen = { id: number; ad: string; soyad: string | null; rol: string }
export type Personel = { id: number; unvan: string }

const SEKMELER = [
  { anahtar: "kabul", ad: "Kabul Bilgileri" },
  { anahtar: "arac", ad: "Araç Bilgileri" },
  { anahtar: "garanti", ad: "Garanti / Sigorta" },
  { anahtar: "musteri", ad: "Müşteri Bilgileri" },
] as const

type SekmeAnahtari = (typeof SEKMELER)[number]["anahtar"]

export function KabulFormu({
  baslangic,
  cariler,
  araclar,
  formenler,
  personeller,
  dropdownlar,
  filoSozlesmeleri = [],
  varsayilanAracId,
  varsayilanCariId,
}: {
  baslangic?: KabulBaslangic
  cariler: KabulCarisi[]
  araclar: KabulAraci[]
  formenler: Formen[]
  personeller: Personel[]
  dropdownlar: {
    kartTurleri: Tanim[]
    istekTurleri: Tanim[]
    bakimSekilleri: Tanim[]
    projeler: Tanim[]
  }
  /** SA-3.3: bugün geçerli tüm aktif filo sözleşmeleri — seçilen cari/plakaya
      göre iskonto/vade önerisi bandı gösterilir. */
  filoSozlesmeleri?: AktifFiloSozlesmesi[]
  /** Araç veya cari kartından "kabul aç" ile gelindiğinde ön seçim. */
  varsayilanAracId?: number
  varsayilanCariId?: number
}) {
  const [durum, gonder, bekliyor] = useActionState<KabulFormDurumu, FormData>(kabulKaydet, {})
  const [sekme, setSekme] = useState<SekmeAnahtari>("kabul")

  const [aracId, setAracId] = useState<number | "">(
    baslangic?.aracId ?? varsayilanAracId ?? ""
  )
  // "Araç kartından kabul aç" (?arac=) ile gelindiğinde cari elle seçilene
  // kadar kara liste / filo sözleşmesi bandları çıkmıyordu. Cari açıkça
  // verilmediyse ön seçili aracın sahibini başlangıçta cari yap (araç
  // değiştirilince zaten `araciSec` aynısını yapıyor).
  const onSecilenAracinCarisi =
    varsayilanAracId != null
      ? (araclar.find((a) => a.id === varsayilanAracId)?.cariId ?? undefined)
      : undefined
  const [cariId, setCariId] = useState<number | "">(
    baslangic?.cariId ?? varsayilanCariId ?? onSecilenAracinCarisi ?? ""
  )

  // Kart Türü / İstek Türü / Bakım Şekli / Proje: tanım listesinde aranan
  // yoksa "+ Yeni" ile /ayar/tanim'e (proje için /servis/proje'ye) gidilir,
  // eklenince buraya dönülür ve yeni değer burada seçili gelir.
  const [kartTuru, setKartTuru] = useState(
    useTanimDonusu("kartTuru") ?? baslangic?.kartTuru ?? ""
  )
  const [istekTuru, setIstekTuru] = useState(
    useTanimDonusu("istekTuru") ?? baslangic?.istekTuru ?? ""
  )
  const [bakimSekli, setBakimSekli] = useState(
    useTanimDonusu("bakimSekli") ?? baslangic?.bakimSekli ?? ""
  )
  const [projesi, setProjesi] = useState(
    useTanimDonusu("projesi") ??
      baslangic?.projesi ??
      araclar.find((a) => a.id === aracId)?.projesi ??
      ""
  )

  const secilenArac = useMemo(
    () => araclar.find((a) => a.id === aracId) ?? null,
    [araclar, aracId]
  )
  const secilenCari = useMemo(
    () => cariler.find((c) => c.id === cariId) ?? null,
    [cariler, cariId]
  )

  /**
   * Cari seçiliyse araç listesi o cariye daralır. Ama "sahibi boş" araçlar
   * listede kalır — ilk kez servise gelen araç henüz kimseye bağlı değil.
   */
  const listelenecekAraclar = useMemo(() => {
    if (!cariId) return araclar
    return araclar.filter((a) => a.cariId === cariId || a.cariId === null)
  }, [araclar, cariId])

  // SA-3.3: seçilen carinin bugün geçerli filo sözleşmesi. Plakaya özel
  // (kapsamPlakalari o plakayı içeren) sözleşme, "tüm araçlar" olana tercih
  // edilir — aktifFiloSozlesmesiBul ile aynı mantık, burada client tarafında.
  const filoSozlesmesi = useMemo(() => {
    if (!cariId) return null
    const hedef = secilenArac
      ? plakaSadelestir(secilenArac.plaka).toLocaleUpperCase("tr-TR")
      : ""
    const carininkiler = filoSozlesmeleri.filter((s) => s.cariId === cariId)
    let genel: AktifFiloSozlesmesi | null = null
    for (const s of carininkiler) {
      const ham = (s.kapsamPlakalari ?? "").trim()
      if (ham === "") {
        if (!genel) genel = s
        continue
      }
      if (!hedef) continue
      const plakalar = ham
        .split(/[\s,;\n]+/)
        .map((p) => plakaSadelestir(p).toLocaleUpperCase("tr-TR"))
        .filter(Boolean)
      if (plakalar.includes(hedef)) return s
    }
    return genel
  }, [cariId, secilenArac, filoSozlesmeleri])

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  // "İleri" tuşu: sekme sırasında bir sonrakine geçer — Selim abi maddesi:
  // kabul bilgilerini girip aşağıya inince direkt "Kartı Aç" ile karşılaşmak
  // yerine önce Araç/Garanti/Müşteri sekmelerine yönlendirilsin.
  const sekmeIndeksi = SEKMELER.findIndex((s) => s.anahtar === sekme)
  const sonSekmedeyiz = sekmeIndeksi === SEKMELER.length - 1
  function ileriGit() {
    if (!sonSekmedeyiz) setSekme(SEKMELER[sekmeIndeksi + 1].anahtar)
  }

  const aracSecenekleri = useMemo<AramaliSecenek[]>(
    () =>
      listelenecekAraclar.map((a) => ({
        value: String(a.id),
        etiket: a.plaka,
        aciklama:
          [[a.marka, a.model].filter(Boolean).join(" "), a.modelYili, a.renk]
            .filter(Boolean)
            .join(" · ") || undefined,
        aramaMetni: a.saseNo ?? undefined,
      })),
    [listelenecekAraclar]
  )

  const cariSecenekleri = useMemo<AramaliSecenek[]>(
    () =>
      cariler.map((c) => ({
        value: String(c.id),
        etiket: c.unvan,
        aciklama: [c.kod, c.gsm || c.telefon, c.yetkili].filter(Boolean).join(" · "),
        aramaMetni: [c.telefon, c.gsm].filter(Boolean).join(" "),
      })),
    [cariler]
  )

  function araciSec(deger: string) {
    const yeni = deger === "" ? "" : Number(deger)
    setAracId(yeni)
    // Araç seçilince sahibi otomatik gelir (Selpar'daki davranış).
    const arac = araclar.find((a) => a.id === yeni)
    if (arac?.cariId) setCariId(arac.cariId)
  }

  const bugun = new Date().toISOString().slice(0, 10)
  const suAn = new Date().toTimeString().slice(0, 5)

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      {/* KARA LİSTE UYARI BANDI (SA-2 / 2.5) — eskiden uyarı yalnızca gizli
          "Müşteri Bilgileri" sekmesindeydi, işlem sırasında görülmüyordu.
          Artık seçilen cari (ya da aracın carisi) kara listedeyse formun en
          üstünde, sekmelerden önce beliriyor. Engelleme yok; onay kutusu
          yine Müşteri Bilgileri sekmesinde. */}
      {secilenCari?.karaListe ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/40 bg-tehlike-yumusak px-3 py-2.5 text-[0.8125rem] text-tehlike">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            ⚠ Bu cari kara listede — {secilenCari.unvan}
          </div>
          {secilenCari.karaListeNedeni ? (
            <p className="mt-1 whitespace-pre-wrap">Sebep: {secilenCari.karaListeNedeni}</p>
          ) : null}
          {baslangic ? null : (
            <p className="mt-1 text-[0.75rem]">
              Kabul yine de açılabilir; onay kutusu &quot;Müşteri Bilgileri&quot; sekmesinde.
            </p>
          )}
        </div>
      ) : null}

      {/* SA-3.3 FİLO SÖZLEŞMESİ ÖNERİ BANDI — seçilen carinin (ve varsa
          plakanın) bugün geçerli filo sözleşmesi varsa vade burada
          hatırlatılır. Forma zorla yazılmaz. */}
      {filoSozlesmesi ? (
        <div className="mx-4 mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-[0.8125rem]">
          <div className="font-semibold text-primary">
            Filo sözleşmesi: {filoSozlesmesi.ad}
          </div>
          <p className="mt-1 text-muted-foreground">
            Önerilen vade <strong>{filoSozlesmesi.vadeGun} gün</strong>.
          </p>
        </div>
      ) : null}

      {/* Dar ekranda sekmeler alt alta düşmesin — şerit kendi içinde yatay kaysın. */}
      <SekmeSeridi
        sekmeler={SEKMELER}
        etkin={sekme}
        degistir={setSekme}
      />

      <div className="p-4">
        {/* ---------------------------------------------------------------- */}
        {/* A) KABUL BİLGİLERİ                                               */}
        {/* ---------------------------------------------------------------- */}
        <Bolum acik={sekme === "kabul"}>
          <Alan
            ad="aracId"
            etiket="Araç (plaka)"
            zorunlu
            hata={hata("aracId")}
            yanTus={
              <YeniKayitTusu
                yol={`/arac/yeni?donus=kabul${cariId ? `&cariId=${cariId}` : ""}`}
                etiket="Yeni Araç"
                baslik="Aranan plaka listede yok — yeni araç kartı aç"
              />
            }
          >
            <AramaliSecim
              name="aracId"
              value={aracId === "" ? "" : String(aracId)}
              onChange={araciSec}
              placeholder="Plaka, marka, model veya şase no yazın…"
              secenekler={aracSecenekleri}
            />
          </Alan>

          <Alan
            ad="cariId"
            etiket="Müşteri (cari)"
            zorunlu
            hata={hata("cariId")}
            yanTus={
              <YeniKayitTusu
                yol="/cari/yeni?donus=kabul"
                etiket="Yeni Cari"
                baslik="Müşteri listede yok — yeni cari kartı aç"
              />
            }
          >
            <AramaliSecim
              name="cariId"
              value={cariId === "" ? "" : String(cariId)}
              onChange={(d) => setCariId(d === "" ? "" : Number(d))}
              placeholder="Ünvan, cari kodu, telefon veya yetkili yazın…"
              secenekler={cariSecenekleri}
            />
          </Alan>

          <Alan
            ad="kartTuru"
            etiket="Kart Türü"
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=KART_TURU"
                alan="kartTuru"
                baslik="Kart Türü"
              />
            }
          >
            <Secim
              name="kartTuru"
              value={kartTuru}
              onChange={(e) => setKartTuru(e.target.value)}
            >
              <option value="">—</option>
              {dropdownlar.kartTurleri.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="kabulOzelNo" etiket="Özel Kabul No" ipucu="Sigorta/filo dosya no">
            <Girdi
              name="kabulOzelNo"
              defaultValue={baslangic?.kabulOzelNo ?? ""}
              placeholder="Örn: sigorta dosya no, filo iş emri no"
            />
          </Alan>

          <Alan
            ad="girisTarihi"
            etiket="Giriş Tarihi"
            ipucu="Boş bırakılırsa bugünün tarihi yazılır"
          >
            <Girdi
              name="girisTarihi"
              type="date"
              defaultValue={baslangic?.girisTarihi ?? bugun}
            />
          </Alan>

          <Alan
            ad="girisSaati"
            etiket="Giriş Saati"
            ipucu="Boş bırakılırsa o anki saat yazılır"
          >
            <Girdi name="girisSaati" type="time" defaultValue={baslangic?.girisSaati ?? suAn} />
          </Alan>

          <Alan
            ad="girisKm"
            etiket="Giriş Km"
            hata={hata("girisKm")}
            ipucu={
              secilenArac?.sonKm ? `Kayıtlı son km: ${secilenArac.sonKm.toLocaleString("tr-TR")}` : undefined
            }
          >
            <Girdi
              name="girisKm"
              type="number"
              min={0}
              defaultValue={baslangic?.girisKm ?? ""}
            />
          </Alan>

          {/* SA-4.1: "İlgilenecek Usta" — eski etiket "Formen / Usta"ydı; alan,
              formenler prop'u ve ilişki aynen. Selim abi: işi yapacak usta. */}
          <Alan ad="formenId" etiket="İlgilenecek Usta">
            <Secim name="formenId" defaultValue={baslangic?.formenId ?? ""}>
              <option value="">—</option>
              {formenler.map((f) => (
                <option key={f.id} value={f.id}>
                  {[f.ad, f.soyad].filter(Boolean).join(" ")}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="istekTuru"
            etiket="İstek Türü"
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=ISTEK_TURU"
                alan="istekTuru"
                baslik="İstek Türü"
              />
            }
          >
            <Secim
              name="istekTuru"
              value={istekTuru}
              onChange={(e) => setIstekTuru(e.target.value)}
            >
              <option value="">—</option>
              {dropdownlar.istekTurleri.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="bakimSekli"
            etiket="Bakım Şekli"
            yanTus={
              <TanimEkleTusu
                hedefYol="/ayar/tanim?tur=BAKIM_SEKLI"
                alan="bakimSekli"
                baslik="Bakım Şekli"
              />
            }
          >
            <Secim
              name="bakimSekli"
              value={bakimSekli}
              onChange={(e) => setBakimSekli(e.target.value)}
            >
              <option value="">—</option>
              {dropdownlar.bakimSekilleri.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan
            ad="projesi"
            etiket="Proje"
            yanTus={
              <TanimEkleTusu hedefYol="/servis/proje" alan="projesi" baslik="Proje" />
            }
          >
            <Secim name="projesi" value={projesi} onChange={(e) => setProjesi(e.target.value)}>
              <option value="">—</option>
              {dropdownlar.projeler.map((t) => (
                <option key={t.id} value={t.ad}>
                  {t.ad}
                </option>
              ))}
            </Secim>
          </Alan>

          <Alan ad="filoSirketi" etiket="Filo Şirketi">
            <Girdi
              name="filoSirketi"
              defaultValue={baslangic?.filoSirketi ?? ""}
              placeholder="Örn: Garenta, TEB Filo, kendi filo şirketiniz"
            />
          </Alan>

          <Alan ad="tahminiTeslimTarihi" etiket="Tahmini Teslim Tarihi">
            <Girdi
              name="tahminiTeslimTarihi"
              type="date"
              defaultValue={baslangic?.tahminiTeslimTarihi ?? ""}
            />
          </Alan>

          <Alan ad="tahminiTeslimSaati" etiket="Tahmini Teslim Saati">
            <Girdi
              name="tahminiTeslimSaati"
              type="time"
              defaultValue={baslangic?.tahminiTeslimSaati ?? ""}
            />
          </Alan>

          <Alan ad="tahminiTutar" etiket="Tahmini Tutar (₺)" hata={hata("tahminiTutar")}>
            <Girdi
              name="tahminiTutar"
              type="number"
              step="0.01"
              min={0}
              defaultValue={baslangic?.tahminiTutar ?? ""}
            />
          </Alan>

          <Alan
            ad="evrakKdvOrani"
            etiket="Evrak KDV Oranı (%)"
            hata={hata("evrakKdvOrani")}
            ipucu="Yeni satırlarda ön değer"
          >
            <Girdi
              name="evrakKdvOrani"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={baslangic?.evrakKdvOrani ?? 20}
            />
          </Alan>

          <Alan ad="durum" etiket="Kart Durumu" ipucu="Ön değer: Açık">
            <Secim name="durum" defaultValue={baslangic?.durum ?? "ACIK"}>
              <option value="ACIK">Açık</option>
              <option value="BEKLEMEDE">Beklemede</option>
              <option value="TAMAMLANDI">Tamamlandı</option>
              <option value="IPTAL">İptal</option>
            </Secim>
          </Alan>

          <Alan ad="sonrakiGelisTarihi" etiket="Sonraki Geliş Tarihi">
            <Girdi
              name="sonrakiGelisTarihi"
              type="date"
              defaultValue={baslangic?.sonrakiGelisTarihi ?? ""}
            />
          </Alan>

          <Alan ad="sonrakiGelisKm" etiket="Sonraki Geliş Km" hata={hata("sonrakiGelisKm")}>
            <Girdi
              name="sonrakiGelisKm"
              type="number"
              min={0}
              defaultValue={baslangic?.sonrakiGelisKm ?? ""}
            />
          </Alan>

          <Alan ad="trigerDegisimKm" etiket="Triger Değişim Km" hata={hata("trigerDegisimKm")}>
            <Girdi
              name="trigerDegisimKm"
              type="number"
              min={0}
              defaultValue={secilenArac?.trigerDegisimKm ?? ""}
            />
          </Alan>

          <Alan ad="trigerDegisimTarih" etiket="Triger Değişim Tarihi">
            <Girdi
              name="trigerDegisimTarih"
              type="date"
              defaultValue={secilenArac?.trigerDegisimTarih ?? ""}
            />
          </Alan>

          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <p className="form-etiket mb-1">Kartta Çalışacak Personeller</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-sm border border-input bg-background p-2">
              {personeller.length === 0 ? (
                <span className="text-[0.75rem] text-muted-foreground">
                  Henüz personel kaydı yok (Cari &gt; tip: personel).
                </span>
              ) : (
                personeller.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-[0.8125rem]">
                    <input
                      type="checkbox"
                      name="personelIdler"
                      value={p.id}
                      defaultChecked={baslangic?.personelIdler.includes(p.id)}
                      className="size-4 accent-primary"
                    />
                    {p.unvan}
                  </label>
                ))
              )}
            </div>
          </div>

          <Alan ad="sikayet" etiket="Müşteri Şikâyeti" genis>
            <Metin
              name="sikayet"
              rows={3}
              defaultValue={baslangic?.sikayet ?? ""}
              placeholder="Örn: motordan tıkırtı geliyor, klima soğutmuyor, ön fren ses yapıyor"
            />
          </Alan>

          {/* SA-4.2: düz textarea yerine etiket girişi — yaz + Enter → etiket.
              Arka planda yine Kabul.yapilanIsler metin alanına satır satır yazılır. */}
          <Alan ad="yapilanIsler" etiket="Yapılan İşler" genis>
            <YapilanIslerGirisi name="yapilanIsler" defaultValue={baslangic?.yapilanIsler ?? ""} />
          </Alan>

          <Alan ad="ozelEsya" etiket="Araçtaki Özel Eşya" genis>
            <Metin
              name="ozelEsya"
              rows={2}
              defaultValue={baslangic?.ozelEsya ?? ""}
              placeholder="Örn: yangın tüpü, kriko, teyp ön paneli, bagajda 4 kış lastiği"
            />
          </Alan>

          <Alan ad="aracNotlari" etiket="Araca Ait Notlar" genis>
            <Metin
              name="aracNotlari"
              rows={2}
              defaultValue={baslangic?.aracNotlari ?? ""}
              placeholder="Örn: sol ön çamurlukta çizik var, lastikler yazlık"
            />
          </Alan>

          <Alan ad="cariNotu" etiket="Cari Notu" genis>
            <Metin
              name="cariNotu"
              rows={2}
              defaultValue={baslangic?.cariNotu ?? ""}
              placeholder="Örn: fatura şirket adına kesilecek, ödemeyi hafta sonu yapacak"
            />
          </Alan>

          <Alan ad="teslimNotu" etiket="Teslim Notu" genis>
            <Metin
              name="teslimNotu"
              rows={2}
              defaultValue={baslangic?.teslimNotu ?? ""}
              placeholder="Örn: araç yıkanıp teslim edilecek, müşteri 17:00'den sonra gelecek"
            />
          </Alan>

          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <label className="flex items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                name="kdvDahilGirilir"
                defaultChecked={baslangic?.kdvDahilGirilir}
                className="size-4 accent-primary"
              />
              Satır fiyatları KDV dahil girilecek
            </label>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              İşaretlenirse girilen birim fiyat KDV&apos;li kabul edilir ve KDV içinden
              ayrıştırılır; fiyatın üstüne eklenmez.
            </p>
          </div>
        </Bolum>

        {/* ---------------------------------------------------------------- */}
        {/* B) ARAÇ BİLGİLERİ (araç kartından okunur)                        */}
        {/* ---------------------------------------------------------------- */}
        <div hidden={sekme !== "arac"}>
          {secilenArac ? (
            <>
              <BilgiIzgarasi
                satirlar={[
                  ["Plaka", secilenArac.plaka, `/arac/${secilenArac.id}`],
                  ["Araç Türü", secilenArac.aracTuru],
                  ["Marka", secilenArac.marka],
                  ["Model", secilenArac.model],
                  ["Model Yılı", secilenArac.modelYili],
                  ["Renk", secilenArac.renk],
                  ["Şase No", secilenArac.saseNo],
                  ["Yakıt Türü", secilenArac.yakitTuru],
                  ["Vites Türü", secilenArac.vitesTuru],
                  ["Kasa Tipi", secilenArac.kasaTipi],
                  ["Motor Hacmi", secilenArac.motorHacmi],
                  ["Kayıtlı Son Km", secilenArac.sonKm?.toLocaleString("tr-TR")],
                  ["Proje", secilenArac.projesi],
                ]}
              />
              <KartBaglantisi
                yol={`/arac/${secilenArac.id}/duzenle`}
                metin="Araç kartını düzenle"
              />
            </>
          ) : (
            <BosUyari metin="Önce Kabul Bilgileri sekmesinden bir araç seçin." />
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* C) GARANTİ / SİGORTA (araç kartından okunur)                     */}
        {/* ---------------------------------------------------------------- */}
        <div hidden={sekme !== "garanti"} className="flex flex-col gap-4">
          {/* Kartın kendi garanti dosyası — "Garanti Listesi" ekranı bunu okur.
              Aracın garanti/sigorta tarihleri araç kartından geliyor, aşağıda
              sadece gösteriliyor; burada girilen bilgi ise BU işe ait. */}
          <div className="[&>*]:min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Alan
              ad="garantiVerenId"
              etiket="Garanti Veren Firma"
              hata={hata("garantiVerenId")}
              ipucu="Distribütör / ana bayi / sigorta — cari kartından seçilir."
            >
              <AramaliSecim
                name="garantiVerenId"
                defaultValue={baslangic?.garantiVerenId ? String(baslangic.garantiVerenId) : ""}
                bosEtiket="— seçilmedi —"
                placeholder="Firma ara…"
                secenekler={cariSecenekleri}
              />
            </Alan>

            <Alan ad="garantiDosyaNo" etiket="Garanti Dosya No" hata={hata("garantiDosyaNo")}>
              <Girdi
                name="garantiDosyaNo"
                defaultValue={baslangic?.garantiDosyaNo ?? ""}
                placeholder="Örn: garanti başvuru / talep dosya no"
              />
            </Alan>

            <Alan ad="garantiOnayNo" etiket="Onay / Yetki No" hata={hata("garantiOnayNo")}>
              <Girdi
                name="garantiOnayNo"
                defaultValue={baslangic?.garantiOnayNo ?? ""}
                placeholder="Örn: distribütörden gelen onay numarası"
              />
            </Alan>

            <Alan ad="garantiTalepTarihi" etiket="Talep Tarihi" hata={hata("garantiTalepTarihi")}>
              <Girdi
                name="garantiTalepTarihi"
                type="date"
                defaultValue={baslangic?.garantiTalepTarihi ?? ""}
              />
            </Alan>

            <Alan ad="garantiDurumu" etiket="Takip Durumu" hata={hata("garantiDurumu")}>
              <Secim name="garantiDurumu" defaultValue={baslangic?.garantiDurumu ?? ""}>
                <option value="">—</option>
                {GARANTI_DURUMLARI.map((d) => (
                  <option key={d} value={d}>
                    {GARANTI_DURUM_ETIKETI[d]}
                  </option>
                ))}
              </Secim>
            </Alan>

            <Alan
              ad="garantiTutar"
              etiket="Garanti Kapsamı Tutar"
              hata={hata("garantiTutar")}
              ipucu="Firmadan istenen tutar; kalanı müşteriye yazılır."
            >
              <Girdi
                name="garantiTutar"
                inputMode="decimal"
                className="text-right tabular-nums"
                defaultValue={baslangic?.garantiTutar ? String(baslangic.garantiTutar) : ""}
              />
            </Alan>

            <Alan ad="garantiNotu" etiket="Garanti Notu" genis hata={hata("garantiNotu")}>
              <Metin
                name="garantiNotu"
                rows={2}
                defaultValue={baslangic?.garantiNotu ?? ""}
                placeholder="Örn: parça garanti kapsamında, işçilik müşteriye yazılacak"
              />
            </Alan>
          </div>

          {secilenArac ? (
            <>
              <BilgiIzgarasi
                satirlar={[
                  ["Trafik Sigortası Bitiş", tarihVeUyari(secilenArac.trafikSigBitis)],
                  ["Kasko Bitiş", tarihVeUyari(secilenArac.kaskoBitis)],
                  ["Garanti Bitiş", tarihVeUyari(secilenArac.garantiBitis)],
                  ["Muayene Bitiş", tarihVeUyari(secilenArac.muayeneBitis)],
                  ["Akü Bitiş", tarihVeUyari(secilenArac.akuBitis)],
                  ["LPG Tank Son Tarih", tarihVeUyari(secilenArac.lpgTankSonTarih)],
                  ["Triger Değişim Km", secilenArac.trigerDegisimKm?.toLocaleString("tr-TR")],
                  ["Triger Değişim Tarihi", tarih(secilenArac.trigerDegisimTarih)],
                ]}
              />
              <KartBaglantisi
                yol={`/arac/${secilenArac.id}/duzenle`}
                metin="Garanti / sigorta tarihlerini düzenle"
              />
            </>
          ) : (
            <BosUyari metin="Önce Kabul Bilgileri sekmesinden bir araç seçin." />
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* D) MÜŞTERİ BİLGİLERİ (cari kartından okunur)                     */}
        {/* ---------------------------------------------------------------- */}
        <div hidden={sekme !== "musteri"}>
          {secilenCari ? (
            <>
              {/* Kara liste kabul açmayı ENGELLEMİYOR (Selpar'da da engel
                  değil, uyarı). Ama uyarının görülmeden geçilmemesi için
                  yeni kartta onay kutusu zorunlu; sunucu tarafı da aynı
                  kutuyu arıyor, sadece ekranda gizlenerek atlatılamıyor. */}
              {secilenCari.karaListe ? (
                <div className="mb-3 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="size-4 shrink-0" />
                    Bu cari KARA LİSTEDE.
                  </div>
                  {secilenCari.karaListeNedeni ? (
                    <p className="mt-1 whitespace-pre-wrap">
                      Neden: {secilenCari.karaListeNedeni}
                    </p>
                  ) : null}
                  {baslangic ? null : (
                    <label className="mt-2 flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        name="karaListeOnay"
                        className="size-4 accent-current"
                      />
                      Uyarıyı gördüm, kabul yine de açılsın.
                    </label>
                  )}
                </div>
              ) : null}
              <BilgiIzgarasi
                satirlar={[
                  ["Cari Kodu", secilenCari.kod, `/cari/${secilenCari.id}`],
                  ["Ünvan", secilenCari.unvan, `/cari/${secilenCari.id}`],
                  ["Yetkili", secilenCari.yetkili],
                  ["Telefon", secilenCari.telefon],
                  ["GSM", secilenCari.gsm],
                  ["Bakiye", para(secilenCari.bakiye)],
                  [
                    "Bakiye Durumu",
                    secilenCari.bakiye > 0
                      ? "Borçlu"
                      : secilenCari.bakiye < 0
                        ? "Alacaklı"
                        : "Kapalı",
                  ],
                  ["Cari Notu", secilenCari.notu],
                ]}
              />
              <KartBaglantisi yol={`/cari/${secilenCari.id}`} metin="Cari kartını aç" />
            </>
          ) : (
            <BosUyari metin="Önce Kabul Bilgileri sekmesinden bir müşteri seçin." />
          )}
        </div>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href={baslangic ? `/servis/kabul/${baslangic.id}` : "/servis/kabul"}>
            <X className="size-4" />
            Vazgeç
          </Link>
        </Button>
        <Button
          type="submit"
          size="sm"
          variant={sonSekmedeyiz ? "default" : "outline"}
          disabled={bekliyor}
        >
          {bekliyor ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {bekliyor
            ? "Kaydediliyor…"
            : baslangic
              ? "Değişiklikleri Kaydet"
              : "Kabul Kartını Aç"}
        </Button>
        {sonSekmedeyiz ? null : (
          <Button type="button" size="sm" onClick={ileriGit}>
            İleri
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </form>
  )
}

/** Süresi geçmiş tarihleri okunur hâle getirir ("12.01.2026 · GEÇTİ"). */
function tarihVeUyari(deger: string | null) {
  if (!deger) return null
  const gecti = new Date(`${deger}T23:59:59`) < new Date()
  return `${tarih(deger)}${gecti ? " · SÜRESİ GEÇTİ" : ""}`
}

/**
 * Salt-okunur bilgi satırları. Satırın 3. elemanı verilirse (bir yol), değer
 * o ekrana giden bir bağlantı olur — Selim abi maddesi 10: "bir yazı görünce
 * üstüne tıklanıp ilgili ekrana girilebilsin". Yol verilmeyen satır düz metin.
 */
function BilgiIzgarasi({
  satirlar,
}: {
  satirlar: [string, string | number | null | undefined, string?][]
}) {
  return (
    <dl className="[&>*]:min-w-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {satirlar.map(([etiket, deger, yol]) => {
        const bos = deger === null || deger === undefined || deger === ""
        return (
          <div key={etiket} className="flex justify-between gap-2 border-b border-border/60 py-1.5">
            <dt className="text-[0.75rem] text-muted-foreground">{etiket}</dt>
            <dd
              className={cn(
                "text-right text-[0.8125rem] font-medium",
                String(deger ?? "").includes("GEÇTİ") && "text-tehlike"
              )}
            >
              {bos ? (
                "—"
              ) : yol ? (
                <Link href={yol} className="text-primary hover:underline">
                  {deger}
                </Link>
              ) : (
                deger
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function KartBaglantisi({ yol, metin }: { yol: string; metin: string }) {
  return (
    <Link
      href={yol}
      className="mt-3 inline-flex items-center gap-1 text-[0.75rem] text-primary hover:underline"
    >
      <ExternalLink className="size-3.5" />
      {metin}
    </Link>
  )
}

function BosUyari({ metin }: { metin: string }) {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">
      {metin}
    </p>
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
  /** Etiketin sağında duran küçük eylem (ör. "+ Yeni Araç"). */
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

/**
 * "+ Yeni Araç" / "+ Yeni Cari" — aranan kayıt listede yoksa kaçış kapısı.
 *
 * Müşteri karşında dururken menüden dolaşmak yok: doğrudan kayıt ekranına
 * gider, kayıt bitince `?donus=kabul` sayesinde buraya döner ve yeni açılan
 * kayıt seçili gelir (bkz. lib/donus.ts). Kabul formunun kendisi henüz
 * kaydedilmediği için ayrılmadan önce kullanıcı uyarılıyor.
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

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

function Girdi({ name, className, ...kalan }: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

function Secim({ name, className, ...kalan }: React.ComponentProps<"select"> & { name: string }) {
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
