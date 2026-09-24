"use client"

import { useActionState, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"

import {
  ekspertizKaydet,
  type EkspertizFormDurumu,
} from "@/app/(panel)/servis/ekspertiz/actions"
import {
  DONANIM_SATIRLARI,
  EKSPERTIZ_DURUM_ETIKETI,
  EKSPERTIZ_DURUMLARI,
  ISCILIK_SATIRLARI,
  type IscilikAlani,
} from "@/app/(panel)/servis/ekspertiz/sema"
import type {
  EkspertizAraci,
  EkspertizCarisi,
  EkspertizKaydi,
} from "@/app/(panel)/servis/ekspertiz/veri"
import { AramaliSecim, type AramaliSecenek } from "@/components/aramali-secim"
import { AracSemasi, type PanelSecimi } from "@/components/ekspertiz/arac-semasi"
import { Button } from "@/components/ui/button"
import { SekmeSeridi } from "@/components/ui/sekme-seridi"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { kalemHesapla, kurusaYuvarla } from "@/lib/hesap"
import { plakaSadelestir } from "@/lib/plaka"
import { metniSayiyaCevir } from "@/lib/sayi"
import { cn } from "@/lib/utils"

/**
 * EKSPERTİZ FORMU — matbu "EKSPER SURETİ" kâğıdının dijital karşılığı.
 *
 * Sekmeler kâğıdın bloklarıyla birebir eşleşiyor, böylece kâğıda alışkın
 * kişi ekranda kaybolmuyor:
 *   A) Dosya Bilgileri   → kâğıdın üst bloğu (poliçe, dosya, eksper, sigorta)
 *   B) Donanım           → sağ üstteki VAR / YOK çeklisti
 *   C) Parçalar          → ADET / PARÇA İSMİ / MİKTAR / BİRİM FİYAT / TUTAR
 *   D) İşçilik           → alttaki 10 sabit satır
 *   E) Boya / Değişen    → Selim abinin istediği şema (kâğıtta yok, eklendi)
 *
 * Sekmeler `hidden` ile gizlenir, DOM'dan silinmez: silinseydi görünmeyen
 * sekmedeki alanlar kaydederken sessizce boşalırdı (kabul formundaki
 * kuralın aynısı).
 *
 * Toplamlar ekranda anlık hesaplanıyor ama KAYITTA SUNUCU YENİDEN
 * HESAPLIYOR — ekrandaki rakam bilgi, veritabanındaki rakam gerçek.
 */

const SEKMELER = [
  { anahtar: "dosya", ad: "Dosya Bilgileri" },
  { anahtar: "donanim", ad: "Donanım" },
  { anahtar: "parca", ad: "Parçalar" },
  { anahtar: "iscilik", ad: "İşçilik" },
  { anahtar: "sema", ad: "Boya / Değişen" },
] as const

type SekmeAnahtari = (typeof SEKMELER)[number]["anahtar"]

/** Parça tablosunun tek satırı — tarayıcıda tutulan hâli. */
type KalemSatiri = {
  anahtar: number
  aciklama: string
  miktar: string
  birim: string
  birimFiyat: string
  kdvOrani: string
}

let sayac = 0
const bosSatir = (kdv = "20"): KalemSatiri => ({
  anahtar: ++sayac,
  aciklama: "",
  miktar: "1",
  birim: "ADET",
  birimFiyat: "",
  kdvOrani: kdv,
})

export function EkspertizFormu({
  baslangic,
  cariler,
  araclar,
  varsayilanAracId,
  varsayilanCariId,
}: {
  baslangic?: EkspertizKaydi
  cariler: EkspertizCarisi[]
  araclar: EkspertizAraci[]
  varsayilanAracId?: number
  varsayilanCariId?: number
}) {
  const [durum, gonder, bekliyor] = useActionState<EkspertizFormDurumu, FormData>(
    ekspertizKaydet,
    {}
  )
  const [sekme, setSekme] = useState<SekmeAnahtari>("dosya")

  const onSecilenAracinCarisi =
    varsayilanAracId != null
      ? (araclar.find((a) => a.id === varsayilanAracId)?.cariId ?? undefined)
      : undefined

  const [aracId, setAracId] = useState<number | "">(
    baslangic?.aracId ?? varsayilanAracId ?? ""
  )
  const [cariId, setCariId] = useState<number | "">(
    baslangic?.cariId ?? varsayilanCariId ?? onSecilenAracinCarisi ?? ""
  )

  const [kdvDahil, setKdvDahil] = useState(baslangic?.kdvDahilGirilir ?? false)
  const [iscilikKdv, setIscilikKdv] = useState(
    String(baslangic?.iscilikKdvOrani ?? 20)
  )

  const [kalemler, setKalemler] = useState<KalemSatiri[]>(() => {
    if (baslangic?.kalemler.length) {
      return baslangic.kalemler.map((k) => ({
        anahtar: ++sayac,
        aciklama: k.aciklama,
        miktar: String(k.miktar),
        birim: k.birim,
        birimFiyat: String(k.birimFiyat),
        kdvOrani: String(k.kdvOrani),
      }))
    }
    // Yeni kartta üç boş satırla açılıyor: eksper kâğıda da doğrudan yazmaya
    // başlıyor, önce "satır ekle"ye basmak zorunda kalmasın.
    return [bosSatir(), bosSatir(), bosSatir()]
  })

  const [iscilikler, setIscilikler] = useState<Record<IscilikAlani, string>>(() => {
    const ilk = {} as Record<IscilikAlani, string>
    for (const satir of ISCILIK_SATIRLARI) {
      const deger = baslangic?.[satir.ad]
      ilk[satir.ad] = deger ? String(deger) : ""
    }
    return ilk
  })

  const secilenArac = useMemo(
    () => araclar.find((a) => a.id === aracId),
    [araclar, aracId]
  )

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  // Sekmeler arası ileri/geri gezinme — kullanıcı tüm blokları görmeden
  // kaydetmeye yönelmesin diye asıl vurgu "İleri"de.
  const sekmeIndeksi = SEKMELER.findIndex((s) => s.anahtar === sekme)
  const sonSekmedeyiz = sekmeIndeksi === SEKMELER.length - 1
  function ileriGit() {
    if (!sonSekmedeyiz) setSekme(SEKMELER[sekmeIndeksi + 1].anahtar)
  }
  function geriGit() {
    if (sekmeIndeksi > 0) setSekme(SEKMELER[sekmeIndeksi - 1].anahtar)
  }

  // --- toplamlar (ekranda anlık; sunucu kayıtta yeniden hesaplıyor) ---
  const ozet = useMemo(() => {
    let parcaTutar = 0
    let parcaKdv = 0
    for (const k of kalemler) {
      if (!k.aciklama.trim()) continue
      const m = metniSayiyaCevir(k.miktar || "1")
      const f = metniSayiyaCevir(k.birimFiyat || "0")
      const o = metniSayiyaCevir(k.kdvOrani || "0")
      if (!Number.isFinite(m) || !Number.isFinite(f) || !Number.isFinite(o)) continue
      const h = kalemHesapla({ miktar: m, birimFiyat: f, kdvOrani: o }, kdvDahil)
      parcaTutar += h.tutar
      parcaKdv += h.kdvTutar
    }

    const iscilikGirilen = ISCILIK_SATIRLARI.reduce((acc, s) => {
      const d = metniSayiyaCevir(iscilikler[s.ad] || "0")
      return acc + (Number.isFinite(d) ? d : 0)
    }, 0)
    const oran = metniSayiyaCevir(iscilikKdv || "0")
    const ih = kalemHesapla(
      { miktar: 1, birimFiyat: iscilikGirilen, kdvOrani: Number.isFinite(oran) ? oran : 0 },
      kdvDahil
    )

    const parcaToplam = kurusaYuvarla(parcaTutar)
    const araToplam = kurusaYuvarla(parcaToplam + ih.tutar)
    const kdvToplam = kurusaYuvarla(parcaKdv + ih.kdvTutar)

    return {
      parcaToplam,
      iscilikToplam: ih.tutar,
      araToplam,
      kdvToplam,
      genelToplam: kurusaYuvarla(araToplam + kdvToplam),
    }
  }, [kalemler, iscilikler, iscilikKdv, kdvDahil])

  const cariSecenekleri: AramaliSecenek[] = cariler.map((c) => ({
    value: String(c.id),
    etiket: c.unvan,
    aciklama: [c.kod, c.gsm ?? c.telefon].filter(Boolean).join(" · "),
    aramaMetni: [c.kod, c.telefon, c.gsm, c.vergiNo].filter(Boolean).join(" "),
  }))

  const aracSecenekleri: AramaliSecenek[] = araclar.map((a) => ({
    value: String(a.id),
    etiket: a.plaka,
    aciklama: [a.marka, a.model, a.modelYili].filter(Boolean).join(" "),
    aramaMetni: [plakaSadelestir(a.plaka), a.saseNo, a.marka, a.model]
      .filter(Boolean)
      .join(" "),
  }))

  /** Araç seçilince sahibini cari olarak öner (kabul ekranındaki davranış). */
  function araciSec(deger: string) {
    const yeni = deger === "" ? "" : Number(deger)
    setAracId(yeni)
    if (yeni === "") return
    const sahibi = araclar.find((a) => a.id === yeni)?.cariId
    if (sahibi) setCariId(sahibi)
  }

  function kalemDegistir(anahtar: number, alan: keyof KalemSatiri, deger: string) {
    setKalemler((onceki) =>
      onceki.map((k) => (k.anahtar === anahtar ? { ...k, [alan]: deger } : k))
    )
  }

  return (
    <form
      onSubmit={(olay) => formGonderimi(olay, gonder)}
      className="flex flex-col gap-4"
    >
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}

      {durum.hata ? (
        <p className="flex items-start gap-2 rounded-md border border-tehlike/40 bg-tehlike/5 px-3 py-2 text-[0.8125rem] text-tehlike">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {durum.hata}
        </p>
      ) : null}

      <SekmeSeridi sekmeler={SEKMELER} etkin={sekme} degistir={setSekme} />

      {/* ------------------------------------------------ A) DOSYA BİLGİLERİ */}
      <Bolum acik={sekme === "dosya"}>
        <Alan ad="cariId" etiket="Müşteri" zorunlu hata={hata("cariId")}>
          <AramaliSecim
            name="cariId"
            secenekler={cariSecenekleri}
            value={cariId === "" ? "" : String(cariId)}
            onChange={(d) => setCariId(d === "" ? "" : Number(d))}
            placeholder="Ünvan, kod veya telefon yazın"
          />
        </Alan>

        <Alan ad="aracId" etiket="Araç" zorunlu hata={hata("aracId")}>
          <AramaliSecim
            name="aracId"
            secenekler={aracSecenekleri}
            value={aracId === "" ? "" : String(aracId)}
            onChange={araciSec}
            placeholder="Plaka veya şasi yazın"
          />
        </Alan>

        <Alan
          ad="matbuNo"
          etiket="Matbu Form No"
          ipucu="Bloknottaki kırmızı sıra no (örn. 00591)"
          hata={hata("matbuNo")}
        >
          <Girdi name="matbuNo" defaultValue={baslangic?.matbuNo ?? ""} />
        </Alan>

        <Alan ad="durum" etiket="Durum">
          <Secim name="durum" defaultValue={baslangic?.durum ?? "TASLAK"}>
            {EKSPERTIZ_DURUMLARI.filter((d) => d !== "KABULE_DONDU").map((d) => (
              <option key={d} value={d}>
                {EKSPERTIZ_DURUM_ETIKETI[d]}
              </option>
            ))}
          </Secim>
        </Alan>

        <Alan ad="km" etiket="Km" hata={hata("km")}>
          <Girdi
            name="km"
            type="number"
            min={0}
            defaultValue={baslangic?.km ?? secilenArac?.sonKm ?? ""}
            key={`km-${secilenArac?.id ?? "yok"}`}
          />
        </Alan>

        <Alan ad="baslangicTarihi" etiket="Başlangıç Tarihi" hata={hata("baslangicTarihi")}>
          <Girdi
            name="baslangicTarihi"
            type="date"
            defaultValue={
              baslangic?.baslangicTarihiGun ?? new Date().toISOString().slice(0, 10)
            }
          />
        </Alan>

        <Alan ad="teslimTarihi" etiket="Teslim Tarihi" hata={hata("teslimTarihi")}>
          <Girdi
            name="teslimTarihi"
            type="date"
            defaultValue={baslangic?.teslimTarihiGun ?? ""}
          />
        </Alan>

        <Alan ad="sigortaAdi" etiket="Sigorta" hata={hata("sigortaAdi")}>
          <Girdi name="sigortaAdi" defaultValue={baslangic?.sigortaAdi ?? ""} />
        </Alan>

        <Alan ad="eksperAdi" etiket="Eksper" hata={hata("eksperAdi")}>
          <Girdi name="eksperAdi" defaultValue={baslangic?.eksperAdi ?? ""} />
        </Alan>

        <Alan ad="policeNo" etiket="Poliçe No" hata={hata("policeNo")}>
          <Girdi name="policeNo" defaultValue={baslangic?.policeNo ?? ""} />
        </Alan>

        <Alan ad="dosyaNo" etiket="Dosya No" hata={hata("dosyaNo")}>
          <Girdi name="dosyaNo" defaultValue={baslangic?.dosyaNo ?? ""} />
        </Alan>

        <Alan ad="hdNo" etiket="H.D. No" hata={hata("hdNo")}>
          <Girdi name="hdNo" defaultValue={baslangic?.hdNo ?? ""} />
        </Alan>

        <Alan ad="soforTc" etiket="Şöför T.C." hata={hata("soforTc")}>
          <Girdi name="soforTc" inputMode="numeric" defaultValue={baslangic?.soforTc ?? ""} />
        </Alan>

        <Alan ad="tcKimlikNo" etiket="T.C. Kimlik No" hata={hata("tcKimlikNo")}>
          <Girdi
            name="tcKimlikNo"
            inputMode="numeric"
            defaultValue={baslangic?.tcKimlikNo ?? ""}
          />
        </Alan>

        <Alan ad="karsiAracTel" etiket="Karşı Araç Tel" hata={hata("karsiAracTel")}>
          <Girdi name="karsiAracTel" defaultValue={baslangic?.karsiAracTel ?? ""} />
        </Alan>

        <Alan ad="karsiAracTc" etiket="Karşı Araç T.C." hata={hata("karsiAracTc")}>
          <Girdi
            name="karsiAracTc"
            inputMode="numeric"
            defaultValue={baslangic?.karsiAracTc ?? ""}
          />
        </Alan>

        <Alan ad="notlar" etiket="Notlar" genis hata={hata("notlar")}>
          <Metin name="notlar" rows={3} defaultValue={baslangic?.notlar ?? ""} />
        </Alan>

        {secilenArac ? (
          <p className="text-[0.75rem] text-muted-foreground sm:col-span-2 lg:col-span-3 xl:col-span-4">
            Seçili araç:{" "}
            <span className="font-medium text-foreground">
              {[secilenArac.marka, secilenArac.model, secilenArac.modelYili]
                .filter(Boolean)
                .join(" ")}
            </span>
            {secilenArac.saseNo ? ` · Şasi: ${secilenArac.saseNo}` : null}
          </p>
        ) : null}
      </Bolum>

      {/* ------------------------------------------------------- B) DONANIM */}
      <div hidden={sekme !== "donanim"} className="flex flex-col gap-3">
        <p className="text-[0.8125rem] text-muted-foreground">
          Matbu formun sağ üstündeki çeklist. Boş bırakılan satır
          &quot;sorulmadı&quot; demektir — sigorta ihtilafında
          &quot;sorulmadı&quot; ile &quot;yoktu&quot; aynı şey değil, bu yüzden
          üç durum ayrı tutuluyor.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DONANIM_SATIRLARI.map((satir) => (
            <DonanimSecimi
              key={satir.ad}
              ad={satir.ad}
              etiket={satir.etiket}
              baslangic={baslangic?.[satir.ad] ?? null}
            />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ C) PARÇALAR */}
      <div hidden={sekme !== "parca"} className="flex flex-col gap-3">
        <p className="text-[0.8125rem] text-muted-foreground">
          Parça katalogdan seçilmek zorunda değil — ekspertiz bir ön tahmin,
          stoktan düşmüyor. Henüz stok kartı olmayan parça da yazılabilir.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-10 py-1.5 pr-2 font-medium">#</th>
                <th className="py-1.5 pr-2 font-medium">Parça İsmi</th>
                <th className="w-24 py-1.5 pr-2 font-medium">Adet</th>
                <th className="w-24 py-1.5 pr-2 font-medium">Birim</th>
                <th className="w-32 py-1.5 pr-2 font-medium">Birim Fiyat</th>
                <th className="w-20 py-1.5 pr-2 font-medium">KDV %</th>
                <th className="w-32 py-1.5 pr-2 text-right font-medium">Tutar</th>
                <th className="w-10 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {kalemler.map((k, sira) => {
                const m = metniSayiyaCevir(k.miktar || "1")
                const f = metniSayiyaCevir(k.birimFiyat || "0")
                const o = metniSayiyaCevir(k.kdvOrani || "0")
                const gecerli =
                  Number.isFinite(m) && Number.isFinite(f) && Number.isFinite(o)
                const satirToplam = gecerli
                  ? kalemHesapla({ miktar: m, birimFiyat: f, kdvOrani: o }, kdvDahil).toplam
                  : 0

                return (
                  <tr key={k.anahtar} className="border-b last:border-0">
                    <td className="py-1 pr-2 text-muted-foreground">{sira + 1}</td>
                    <td className="py-1 pr-2">
                      <input
                        name="kalemAciklama"
                        value={k.aciklama}
                        onChange={(e) =>
                          kalemDegistir(k.anahtar, "aciklama", e.target.value)
                        }
                        placeholder="Sol ön çamurluk"
                        className={ALAN_SINIFI}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        name="kalemMiktar"
                        value={k.miktar}
                        onChange={(e) => kalemDegistir(k.anahtar, "miktar", e.target.value)}
                        inputMode="decimal"
                        className={ALAN_SINIFI}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        name="kalemBirim"
                        value={k.birim}
                        onChange={(e) => kalemDegistir(k.anahtar, "birim", e.target.value)}
                        className={ALAN_SINIFI}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        name="kalemBirimFiyat"
                        value={k.birimFiyat}
                        onChange={(e) =>
                          kalemDegistir(k.anahtar, "birimFiyat", e.target.value)
                        }
                        inputMode="decimal"
                        className={cn(ALAN_SINIFI, "text-right")}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        name="kalemKdvOrani"
                        value={k.kdvOrani}
                        onChange={(e) =>
                          kalemDegistir(k.anahtar, "kdvOrani", e.target.value)
                        }
                        inputMode="decimal"
                        className={cn(ALAN_SINIFI, "text-right")}
                      />
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {k.aciklama.trim() ? para(satirToplam) : "—"}
                    </td>
                    <td className="py-1">
                      <button
                        type="button"
                        onClick={() =>
                          setKalemler((onceki) =>
                            onceki.length === 1
                              ? [bosSatir()]
                              : onceki.filter((s) => s.anahtar !== k.anahtar)
                          )
                        }
                        title="Satırı sil"
                        className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-tehlike"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sr-only">Satırı sil</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setKalemler((onceki) => [
                ...onceki,
                bosSatir(onceki.at(-1)?.kdvOrani ?? "20"),
              ])
            }
          >
            <Plus className="size-4" aria-hidden />
            Satır Ekle
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------ D) İŞÇİLİK */}
      <div hidden={sekme !== "iscilik"} className="flex flex-col gap-3">
        <p className="text-[0.8125rem] text-muted-foreground">
          Matbu formun alt bloğu. Boş bırakılan satır sıfır sayılır.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ISCILIK_SATIRLARI.map((satir) => (
            <Alan
              key={satir.ad}
              ad={satir.ad}
              etiket={`${satir.etiket} (₺)`}
              hata={hata(satir.ad)}
            >
              <Girdi
                name={satir.ad}
                inputMode="decimal"
                className="text-right"
                value={iscilikler[satir.ad]}
                onChange={(e) =>
                  setIscilikler((onceki) => ({ ...onceki, [satir.ad]: e.target.value }))
                }
              />
            </Alan>
          ))}

          <Alan
            ad="iscilikKdvOrani"
            etiket="İşçilik KDV Oranı (%)"
            hata={hata("iscilikKdvOrani")}
          >
            <Girdi
              name="iscilikKdvOrani"
              inputMode="decimal"
              className="text-right"
              value={iscilikKdv}
              onChange={(e) => setIscilikKdv(e.target.value)}
            />
          </Alan>
        </div>

        <label className="flex w-fit items-center gap-2 text-[0.8125rem]">
          <input
            type="checkbox"
            name="kdvDahilGirilir"
            checked={kdvDahil}
            onChange={(e) => setKdvDahil(e.target.checked)}
            className="size-4"
          />
          Girilen tutarlar KDV dahil
        </label>
      </div>

      {/* --------------------------------------------------------- E) ŞEMA */}
      <div hidden={sekme !== "sema"} className="flex flex-col gap-3">
        <p className="text-[0.8125rem] text-muted-foreground">
          Boyalı veya değişen parçalar. İşaretlenmeyen parça orijinal kabul
          edilir ve kayda yazılmaz.
        </p>
        <AracSemasi baslangic={(baslangic?.panelSecimi ?? {}) as PanelSecimi} />
      </div>

      {/* --------------------------------------------------------- ÖZET */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-muted/40 px-3 py-2 text-[0.8125rem]">
        <OzetKalem etiket="Parça" deger={ozet.parcaToplam} />
        <OzetKalem etiket="İşçilik" deger={ozet.iscilikToplam} />
        <OzetKalem etiket="Ara Toplam" deger={ozet.araToplam} />
        <OzetKalem etiket="KDV" deger={ozet.kdvToplam} />
        <OzetKalem etiket="Genel Toplam" deger={ozet.genelToplam} vurgulu />
      </div>

      <p className="text-[0.75rem] text-muted-foreground">
        BU EKSPERTİZ BİR ÖN TAHMİNDİR, KESİN SONUÇ ONARIM NETİCESİ BELLİ
        OLACAKTIR. Bu kart hiçbir cari, kasa veya stok hareketi oluşturmaz.
      </p>

      {/* Kabul formundaki aksiyon çubuğunun aynısı: Kaydet son sekmeye kadar
          soluk (outline) duruyor, asıl vurgu "İleri"de. Böylece kullanıcı
          ilk sekmede yanlışlıkla yarım formu kaydetmiyor, sekmeleri
          gezmeye yönlendiriliyor — ama isterse baştan da kaydedebiliyor. */}
      <div className="form-aksiyon-cubugu sticky bottom-0 -mx-4 -mb-4 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href={baslangic ? `/servis/ekspertiz/${baslangic.id}` : "/servis/ekspertiz"}>
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        {sekmeIndeksi > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={geriGit}>
            <ArrowLeft className="size-4" aria-hidden />
            Geri
          </Button>
        ) : null}
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
          {bekliyor
            ? "Kaydediliyor…"
            : baslangic
              ? "Değişiklikleri Kaydet"
              : "Ekspertizi Kaydet"}
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

/**
 * VAR / YOK / (boş) üçlüsü. Radyo düğmesi kullanılıyor, checkbox değil:
 * checkbox iki durumlu, "sorulmadı"yı anlatamaz.
 */
function DonanimSecimi({
  ad,
  etiket,
  baslangic,
}: {
  ad: string
  etiket: string
  baslangic: boolean | null
}) {
  const ilk = baslangic === true ? "VAR" : baslangic === false ? "YOK" : ""
  const [deger, setDeger] = useState(ilk)

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5">
      <span className="text-[0.8125rem]">{etiket}</span>
      <input type="hidden" name={ad} value={deger} />
      <div className="flex shrink-0 gap-1">
        {[
          { kod: "VAR", etiket: "Var" },
          { kod: "YOK", etiket: "Yok" },
        ].map((secenek) => (
          <button
            key={secenek.kod}
            type="button"
            // Seçili olana tekrar basınca temizlenir → "sorulmadı"ya döner.
            onClick={() => setDeger((o) => (o === secenek.kod ? "" : secenek.kod))}
            aria-pressed={deger === secenek.kod}
            className={cn(
              "rounded-sm border px-2 py-0.5 text-[0.75rem] transition",
              deger === secenek.kod
                ? secenek.kod === "VAR"
                  ? "border-emerald-600 bg-emerald-600 font-medium text-white"
                  : "border-neutral-500 bg-neutral-500 font-medium text-white"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {secenek.etiket}
          </button>
        ))}
      </div>
    </div>
  )
}

function OzetKalem({
  etiket,
  deger,
  vurgulu,
}: {
  etiket: string
  deger: number
  vurgulu?: boolean
}) {
  return (
    <span className={cn("flex items-baseline gap-1.5", vurgulu && "font-semibold")}>
      <span className="text-muted-foreground">{etiket}:</span>
      <span className="tabular-nums">{para(deger)}</span>
    </span>
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
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
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
