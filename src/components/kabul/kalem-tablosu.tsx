"use client"

import Link from "next/link"
import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Search, SquarePlus, Trash2, X } from "lucide-react"

import {
  kalemKaydet,
  kalemSil,
  katalogAraAction,
  type KalemDurumu,
} from "@/app/(panel)/servis/kabul/actions"
import { PaketUygula, type UygulanabilirPaket } from "@/components/kabul/paket-uygula"
import { Button } from "@/components/ui/button"
import { miktar as miktarBicim, para, yuzde } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { kabulToplamlari, kalemHesapla } from "@/lib/hesap"
import { cn } from "@/lib/utils"
import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * KABUL KALEMLERİ — parça / işçilik / dış hizmet satırları
 *
 * Selpar'daki kalem ızgarasının karşılığı. İki davranış birebir taşındı:
 *  1. Katalogdan seçim satırı doldurur (fiyat + KDV + birim otomatik gelir),
 *     ama kullanıcı üzerine yazabilir — servis fiyatı araca göre değişiyor.
 *  2. "KDV dahil giriş" işaretliyse birim fiyatın içinden KDV ayrıştırılır.
 *
 * Toplamlar hem burada (anlık) hem sunucuda hesaplanır; formül `lib/hesap`
 * içinde tek yerde durduğu için iki taraf ayrışamaz.
 *
 * NOT: İndirim/iskonto kavramı sistemden kaldırıldı (HAFIZA §113).
 */

export type KalemSatiri = {
  id: number
  sira: number
  tur: "PARCA" | "ISCILIK" | "DIS_HIZMET"
  stokId: number | null
  iscilikId: number | null
  personelId: number | null
  aciklama: string
  birim: string
  miktar: number
  birimFiyat: number
  kdvOrani: number
  garantili: boolean
}

type KatalogSonucu = {
  id: number
  kod: string
  ad: string
  birim: string
  fiyat: number
  kdvOrani: number
  stokta: number | null
}

const TUR_ADI: Record<KalemSatiri["tur"], string> = {
  PARCA: "Parça",
  ISCILIK: "İşçilik",
  DIS_HIZMET: "Dış Hizmet",
}

export function KalemTablosu({
  kabulId,
  kalemler,
  kdvDahilGirilir,
  varsayilanKdv,
  personeller,
  paketler,
  duzenlenebilir,
}: {
  kabulId: number
  kalemler: KalemSatiri[]
  kdvDahilGirilir: boolean
  varsayilanKdv: number
  personeller: { id: number; unvan: string }[]
  paketler: UygulanabilirPaket[]
  duzenlenebilir: boolean
}) {
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<KalemSatiri | null>(null)

  const toplam = kabulToplamlari(
    kalemler.map((k) => ({ tur: k.tur, ...kalemHesapla(k, kdvDahilGirilir) }))
  )

  function satiriDuzenle(kalem: KalemSatiri) {
    setDuzenlenen(kalem)
    setFormAcik(true)
  }

  function formuKapat() {
    setFormAcik(false)
    setDuzenlenen(null)
  }

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-[0.8125rem] font-semibold">
          Kalemler
          <span className="ml-2 font-normal text-muted-foreground">
            {kalemler.length} satır
          </span>
        </h2>
        {duzenlenebilir ? (
          <div className="flex items-center gap-2">
            {/* Paket, satır satır girmenin kısayolu — aynı satırda dursun. */}
            <PaketUygula kabulId={kabulId} paketler={paketler} />
            <Button
              size="sm"
              variant={formAcik ? "ghost" : "default"}
              onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}
            >
              {formAcik ? <X className="size-4" /> : <Plus className="size-4" />}
              {formAcik ? "Kapat" : "Satır Ekle"}
            </Button>
          </div>
        ) : null}
      </div>

      {formAcik ? (
        <KalemFormu
          key={duzenlenen?.id ?? "yeni"}
          kabulId={kabulId}
          kalem={duzenlenen}
          kdvDahilGirilir={kdvDahilGirilir}
          varsayilanKdv={varsayilanKdv}
          personeller={personeller}
          kapat={formuKapat}
        />
      ) : null}

      <div className="tablo-sarmal">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.75rem] text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">#</th>
              <th className="px-2 py-1.5 text-left font-medium">Tür</th>
              <th className="px-2 py-1.5 text-left font-medium">Açıklama</th>
              <th className="px-2 py-1.5 text-right font-medium">Miktar</th>
              <th className="px-2 py-1.5 text-left font-medium">Birim</th>
              <th className="px-2 py-1.5 text-right font-medium">Birim Fiyat</th>
              <th className="px-2 py-1.5 text-right font-medium">KDV</th>
              <th className="px-2 py-1.5 text-right font-medium">Tutar</th>
              <th className="px-2 py-1.5 text-right font-medium">Toplam</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {kalemler.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  Henüz satır eklenmedi.
                </td>
              </tr>
            ) : (
              kalemler.map((k, sira) => {
                const h = kalemHesapla(k, kdvDahilGirilir)
                return (
                  <tr key={k.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-1.5 text-muted-foreground">{sira + 1}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          "rounded-sm px-1.5 py-0.5 text-[0.6875rem]",
                          k.tur === "PARCA" && "bg-primary/10 text-primary",
                          k.tur === "ISCILIK" && "bg-vurgu/15 text-vurgu-koyu",
                          k.tur === "DIS_HIZMET" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {TUR_ADI[k.tur]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {k.aciklama}
                      {k.garantili ? (
                        <span className="ml-1.5 text-[0.6875rem] text-vurgu-koyu">
                          (garanti)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {miktarBicim(k.miktar)}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{k.birim}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {para(k.birimFiyat, false)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {yuzde(k.kdvOrani)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {para(h.tutar, false)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                      {para(h.toplam, false)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {duzenlenebilir ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => satiriDuzenle(k)}
                            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Düzenle"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <SilDugmesi kalemId={k.id} aciklama={k.aciklama} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t border-border px-3 py-2">
        <dl className="w-full max-w-xs space-y-1 text-[0.8125rem]">
          <ToplamSatiri etiket="Parça" deger={toplam.parcaToplam} />
          <ToplamSatiri etiket="İşçilik" deger={toplam.iscilikToplam} />
          {toplam.disHizmetToplam ? (
            <ToplamSatiri etiket="Dış Hizmet" deger={toplam.disHizmetToplam} />
          ) : null}
          <ToplamSatiri etiket="Ara Toplam" deger={toplam.araToplam} />
          <ToplamSatiri etiket="KDV" deger={toplam.kdvToplam} />
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <dt>Genel Toplam</dt>
            <dd className="tabular-nums">{para(toplam.genelToplam)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function ToplamSatiri({ etiket, deger }: { etiket: string; deger: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{etiket}</dt>
      <dd className="tabular-nums">{para(deger, false)}</dd>
    </div>
  )
}

function SilDugmesi({ kalemId, aciklama }: { kalemId: number; aciklama: string }) {
  const [bekliyor, basla] = useTransition()
  const [hata, setHata] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        disabled={bekliyor}
        title="Sil"
        onClick={() => {
          if (!confirm(`"${aciklama}" satırı silinsin mi?`)) return
          basla(async () => {
            const sonuc = await kalemSil(kalemId)
            setHata(sonuc.hata ?? null)
          })
        }}
        className="rounded-sm p-1 text-muted-foreground hover:bg-tehlike-yumusak hover:text-tehlike disabled:opacity-50"
      >
        {bekliyor ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
      {hata ? <span className="text-[0.6875rem] text-tehlike">{hata}</span> : null}
    </>
  )
}

// ============================================================================
//  SATIR EKLEME / DÜZENLEME FORMU
// ============================================================================

function KalemFormu({
  kabulId,
  kalem,
  kdvDahilGirilir,
  varsayilanKdv,
  personeller,
  kapat,
}: {
  kabulId: number
  kalem: KalemSatiri | null
  kdvDahilGirilir: boolean
  varsayilanKdv: number
  personeller: { id: number; unvan: string }[]
  kapat: () => void
}) {
  const [durum, gonder, bekliyor] = useActionState<KalemDurumu, FormData>(
    async (onceki, form) => {
      const sonuc = await kalemKaydet(onceki, form)
      if (!sonuc.hata) kapat()
      return sonuc
    },
    {}
  )

  const [tur, setTur] = useState<KalemSatiri["tur"]>(kalem?.tur ?? "PARCA")
  const [stokId, setStokId] = useState<number | null>(kalem?.stokId ?? null)
  const [iscilikId, setIscilikId] = useState<number | null>(kalem?.iscilikId ?? null)

  // Satırın anlık toplamını göstermek için kontrollü tutulan alanlar.
  const [aciklama, setAciklama] = useState(kalem?.aciklama ?? "")
  const [birim, setBirim] = useState(kalem?.birim ?? "ADET")
  const [miktar, setMiktar] = useState(String(kalem?.miktar ?? 1))
  const [birimFiyat, setBirimFiyat] = useState(String(kalem?.birimFiyat ?? 0))
  const [kdv, setKdv] = useState(String(kalem?.kdvOrani ?? varsayilanKdv))

  const sayiya = (d: string) => {
    const n = metniSayiyaCevir(d)
    return Number.isFinite(n) ? n : 0
  }

  const onizleme = kalemHesapla(
    {
      miktar: sayiya(miktar),
      birimFiyat: sayiya(birimFiyat),
      kdvOrani: sayiya(kdv),
    },
    kdvDahilGirilir
  )

  /** Tür değişince katalog seçimi ve birim türe göre yenilenir. */
  function turuDegistir(yeni: KalemSatiri["tur"]) {
    setTur(yeni)
    setStokId(null)
    setIscilikId(null)
    if (yeni !== "DIS_HIZMET") setAciklama("")
    if (!kalem) {
      setBirim(yeni === "ISCILIK" ? "SAAT" : "ADET")
    }
  }

  function katalogdanSec(secim: KatalogSonucu) {
    if (tur === "ISCILIK") setIscilikId(secim.id)
    else setStokId(secim.id)
    setAciklama(`${secim.kod} — ${secim.ad}`)
    setBirim(secim.birim)
    setBirimFiyat(String(secim.fiyat))
    setKdv(String(secim.kdvOrani))
  }

  function secimiTemizle() {
    setStokId(null)
    setIscilikId(null)
    setAciklama("")
  }

  // Parça/işçilik satırı katalogdan seçilmeden gönderilemez (HAFIZA: elle
  // yazılan kalemler stok hareketi yazmadan karta sızıyordu).
  const katalogSecimGerekli = tur !== "DIS_HIZMET"
  const katalogSecildi = tur === "ISCILIK" ? iscilikId !== null : stokId !== null

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="border-b border-border bg-muted/30 p-3">
      <input type="hidden" name="kabulId" value={kabulId} />
      {kalem ? <input type="hidden" name="id" value={kalem.id} /> : null}
      <input type="hidden" name="stokId" value={stokId ?? ""} />
      <input type="hidden" name="iscilikId" value={iscilikId ?? ""} />

      {durum.hata ? (
        <div className="mb-2 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <div className="col-span-2 sm:col-span-1">
          <MiniEtiket>Tür</MiniEtiket>
          <select
            name="tur"
            value={tur}
            onChange={(e) => turuDegistir(e.target.value as KalemSatiri["tur"])}
            className={MINI_ALAN}
          >
            <option value="PARCA">Parça</option>
            <option value="ISCILIK">İşçilik</option>
            <option value="DIS_HIZMET">Dış Hizmet</option>
          </select>
        </div>

        <div className="col-span-2 sm:col-span-3 lg:col-span-3">
          <MiniEtiket>
            Açıklama
            {katalogSecimGerekli ? (
              <span className="ml-1 font-normal text-muted-foreground">
                (yalnızca katalogdan seçilir)
              </span>
            ) : null}
          </MiniEtiket>
          {tur === "DIS_HIZMET" ? (
            <input
              name="aciklama"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              className={MINI_ALAN}
              placeholder="Dış hizmet açıklaması"
            />
          ) : (
            <>
              <input type="hidden" name="aciklama" value={aciklama} />
              <KatalogArama
                tur={tur === "ISCILIK" ? "ISCILIK" : "PARCA"}
                secilen={katalogSecildi ? aciklama : null}
                temizle={secimiTemizle}
                sec={katalogdanSec}
              />
            </>
          )}
        </div>

        <div>
          <MiniEtiket>Miktar</MiniEtiket>
          <input
            name="miktar"
            value={miktar}
            onChange={(e) => setMiktar(e.target.value)}
            className={cn(MINI_ALAN, "text-right tabular-nums")}
            inputMode="decimal"
          />
        </div>

        <div>
          <MiniEtiket>Birim</MiniEtiket>
          <input
            name="birim"
            value={birim}
            onChange={(e) => setBirim(e.target.value)}
            className={MINI_ALAN}
          />
        </div>

        <div>
          <MiniEtiket>Birim Fiyat{kdvDahilGirilir ? " (KDV dahil)" : ""}</MiniEtiket>
          <input
            name="birimFiyat"
            value={birimFiyat}
            onChange={(e) => setBirimFiyat(e.target.value)}
            className={cn(MINI_ALAN, "text-right tabular-nums")}
            inputMode="decimal"
          />
        </div>

        <div>
          <MiniEtiket>KDV %</MiniEtiket>
          <input
            name="kdvOrani"
            value={kdv}
            onChange={(e) => setKdv(e.target.value)}
            className={cn(MINI_ALAN, "text-right tabular-nums")}
            inputMode="decimal"
          />
        </div>

        <div className="col-span-2">
          <MiniEtiket>Yapan Personel</MiniEtiket>
          <select
            name="personelId"
            defaultValue={kalem?.personelId ?? ""}
            className={MINI_ALAN}
          >
            <option value="">—</option>
            {personeller.map((p) => (
              <option key={p.id} value={p.id}>
                {p.unvan}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 flex items-end pb-1">
          <label className="flex items-center gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              name="garantili"
              defaultChecked={kalem?.garantili}
              className="size-4 accent-primary"
            />
            Garanti kapsamında
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.75rem] text-muted-foreground">
          Matrah <strong className="text-foreground">{para(onizleme.tutar, false)}</strong> ·
          KDV <strong className="text-foreground">{para(onizleme.kdvTutar, false)}</strong> ·
          Satır Toplamı{" "}
          <strong className="text-foreground">{para(onizleme.toplam)}</strong>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={kapat}>
            Vazgeç
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={bekliyor || (katalogSecimGerekli && !katalogSecildi)}
          >
            {bekliyor ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {bekliyor ? "İşleniyor…" : kalem ? "Satırı Güncelle" : "Satırı Ekle"}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * Katalog seçici. Elle açıklama yazılamaz — kalem ancak katalogdan tıklanarak
 * seçilir (aksi halde stok hareketi yazılmayan tanımsız satırlar kartlara
 * sızıyordu). Aranan kayıt yoksa yanındaki bağlantı ilgili tanım ekranına
 * gönderir; kullanıcı orada parçayı/işçiliği tanımlayıp geri dönüp arar.
 */
function KatalogArama({
  tur,
  secilen,
  temizle,
  sec,
}: {
  tur: "PARCA" | "ISCILIK"
  secilen: string | null
  temizle: () => void
  sec: (s: KatalogSonucu) => void
}) {
  const [arama, setArama] = useState("")
  const [sonuclar, setSonuclar] = useState<KatalogSonucu[]>([])
  const [acik, setAcik] = useState(false)
  const [araniyor, setAraniyor] = useState(false)
  const sonAramaRef = useRef("")

  useEffect(() => {
    const metin = arama.trim()
    sonAramaRef.current = metin

    // setState effect gövdesinde senkron çağrılmıyor (React cascading render
    // uyarısı). Arama kutusu boşken de (kutuya tıklanır tıklanmaz) tüm liste
    // gelsin diye kısa metin artık aramayı iptal etmiyor, sadece debounce'u
    // atlıyor.
    const zamanlayici = setTimeout(
      async () => {
        setAraniyor(true)
        try {
          const bulunan = await katalogAraAction(tur, metin)
          // Kullanıcı bu sırada yazmaya devam ettiyse eski sonuç ekrana basılmasın.
          if (sonAramaRef.current === metin) {
            setSonuclar(bulunan)
          }
        } finally {
          setAraniyor(false)
        }
      },
      metin.length === 0 ? 0 : 300
    )

    return () => clearTimeout(zamanlayici)
  }, [arama, tur])

  const tanimEkleYolu = tur === "PARCA" ? "/stok/yeni" : "/iscilik/yeni"
  const tanimEkleEtiket = tur === "PARCA" ? "Parça Ekle" : "İşçilik Ekle"

  if (secilen) {
    return (
      <div className={cn(MINI_ALAN, "flex items-center justify-between gap-2 bg-basari-yumusak/40")}>
        <span className="truncate text-basari-koyu">{secilen}</span>
        <button
          type="button"
          onClick={() => {
            temizle()
            setArama("")
            setAcik(false)
          }}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Seçimi kaldır"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex gap-1.5">
      <div className="relative flex-1">
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          onFocus={() => setAcik(true)}
          onBlur={() => setTimeout(() => setAcik(false), 150)}
          className={cn(MINI_ALAN, "pr-7")}
          placeholder={tur === "PARCA" ? "Parça kodu / adı ara" : "İşçilik kodu / adı ara"}
          autoComplete="off"
        />
        <span className="absolute right-2 top-1.5 text-muted-foreground">
          {araniyor ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}
        </span>

        {acik ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
            {sonuclar.length > 0 ? (
              sonuclar.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      sec(s)
                      setAcik(false)
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-[0.8125rem] hover:bg-muted"
                  >
                    <span className="truncate">
                      <span className="text-muted-foreground">{s.kod}</span> — {s.ad}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {para(s.fiyat, false)}
                      {s.stokta !== null ? ` · stok ${miktarBicim(s.stokta)}` : ""}
                    </span>
                  </button>
                </li>
              ))
            ) : !araniyor ? (
              <li className="px-2 py-1.5 text-[0.75rem] text-muted-foreground">
                Tanımlarda bulunamadı.
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <Link
        href={tanimEkleYolu}
        target="_blank"
        rel="noopener noreferrer"
        title={`Katalogda yoksa ${tanimEkleEtiket.toLowerCase()} sekmesine git`}
        className="flex h-8 shrink-0 items-center gap-1 rounded-sm border border-dashed border-input px-2 text-[0.75rem] text-muted-foreground hover:border-primary hover:text-primary"
      >
        <SquarePlus className="size-3.5" />
        {tanimEkleEtiket}
      </Link>
    </div>
  )
}

const MINI_ALAN =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

function MiniEtiket({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[0.6875rem] font-medium text-muted-foreground">
      {children}
    </label>
  )
}
