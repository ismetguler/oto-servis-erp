"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react"

import {
  kalemKaydet,
  kalemSil,
  katalogAraAction,
  type KalemDurumu,
} from "@/app/(panel)/evrak/satis/actions"
import { Button } from "@/components/ui/button"
import { miktar as miktarBicim, para, yuzde } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { kalemHesapla } from "@/lib/hesap"
import { metniSayiyaCevir } from "@/lib/sayi"
import { cn } from "@/lib/utils"

/**
 * SATIŞ FATURASI KALEMLERİ — kabuldeki `KalemTablosu`nun sade hâli.
 * Fark: tür seçimi yok (her satır bir "kalem"), garanti/personel yok.
 * Stok kartından seçim aynı katalog arama motorunu (`katalogAraAction`)
 * kullanıyor — kabuldeki parça araması burada TEKRAR YAZILMADI.
 */

export type KalemSatiri = {
  id: number
  sira: number
  stokId: number | null
  aciklama: string
  birim: string
  miktar: number
  birimFiyat: number
  kdvOrani: number
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

export function KalemTablosu({
  evrakId,
  kalemler,
  duzenlenebilir,
}: {
  evrakId: number
  kalemler: KalemSatiri[]
  duzenlenebilir: boolean
}) {
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<KalemSatiri | null>(null)

  const toplam = kalemler.reduce(
    (t, k) => {
      const h = kalemHesapla(k)
      return {
        araToplam: t.araToplam + h.tutar,
        kdvToplam: t.kdvToplam + h.kdvTutar,
        genelToplam: t.genelToplam + h.toplam,
      }
    },
    { araToplam: 0, kdvToplam: 0, genelToplam: 0 }
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
          <span className="ml-2 font-normal text-muted-foreground">{kalemler.length} satır</span>
        </h2>
        {duzenlenebilir ? (
          <Button
            size="sm"
            variant={formAcik ? "ghost" : "default"}
            onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}
          >
            {formAcik ? <X className="size-4" /> : <Plus className="size-4" />}
            {formAcik ? "Kapat" : "Satır Ekle"}
          </Button>
        ) : null}
      </div>

      {formAcik ? (
        <KalemFormu key={duzenlenen?.id ?? "yeni"} evrakId={evrakId} kalem={duzenlenen} kapat={formuKapat} />
      ) : null}

      <div className="tablo-sarmal">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.75rem] text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">#</th>
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
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Henüz satır eklenmedi.
                </td>
              </tr>
            ) : (
              kalemler.map((k, sira) => {
                const h = kalemHesapla(k)
                return (
                  <tr key={k.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-1.5 text-muted-foreground">{sira + 1}</td>
                    <td className="px-2 py-1.5">{k.aciklama}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{miktarBicim(k.miktar)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{k.birim}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{para(k.birimFiyat, false)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{yuzde(k.kdvOrani)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{para(h.tutar, false)}</td>
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
        {bekliyor ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
      {hata ? <span className="text-[0.6875rem] text-tehlike">{hata}</span> : null}
    </>
  )
}

// ============================================================================
//  SATIR EKLEME / DÜZENLEME FORMU
// ============================================================================

function KalemFormu({
  evrakId,
  kalem,
  kapat,
}: {
  evrakId: number
  kalem: KalemSatiri | null
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

  const [stokId, setStokId] = useState<number | null>(kalem?.stokId ?? null)
  const [stokKalan, setStokKalan] = useState<number | null>(null)
  const [aciklama, setAciklama] = useState(kalem?.aciklama ?? "")
  const [birim, setBirim] = useState(kalem?.birim ?? "ADET")
  const [miktar, setMiktar] = useState(String(kalem?.miktar ?? 1))
  const [birimFiyat, setBirimFiyat] = useState(String(kalem?.birimFiyat ?? 0))
  const [kdv, setKdv] = useState(String(kalem?.kdvOrani ?? 20))

  const sayiya = (d: string) => {
    const n = metniSayiyaCevir(d)
    return Number.isFinite(n) ? n : 0
  }

  const onizleme = kalemHesapla({
    miktar: sayiya(miktar),
    birimFiyat: sayiya(birimFiyat),
    kdvOrani: sayiya(kdv),
  })

  function katalogdanSec(secim: KatalogSonucu) {
    setStokId(secim.id)
    setStokKalan(secim.stokta)
    setAciklama(`${secim.kod} — ${secim.ad}`)
    setBirim(secim.birim)
    setBirimFiyat(String(secim.fiyat))
    setKdv(String(secim.kdvOrani))
  }

  // Stoktan fazla satış engellenmez ama uyarılır (İsmet kararı).
  const stokAsimi =
    stokKalan !== null && sayiya(miktar) > stokKalan ? sayiya(miktar) - stokKalan : 0

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="border-b border-border bg-muted/30 p-3">
      <input type="hidden" name="evrakId" value={evrakId} />
      {kalem ? <input type="hidden" name="id" value={kalem.id} /> : null}
      <input type="hidden" name="stokId" value={stokId ?? ""} />

      {durum.hata ? (
        <div className="mb-2 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-4 lg:col-span-2">
          <MiniEtiket>
            Açıklama
            <span className="ml-1 font-normal text-muted-foreground">
              (stoktan arayın veya elle yazın)
            </span>
          </MiniEtiket>
          <KatalogArama
            deger={aciklama}
            degistir={(d) => {
              setAciklama(d)
              setStokId(null)
              setStokKalan(null)
            }}
            sec={katalogdanSec}
          />
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
          <input name="birim" value={birim} onChange={(e) => setBirim(e.target.value)} className={MINI_ALAN} />
        </div>

        <div>
          <MiniEtiket>Birim Fiyat</MiniEtiket>
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
      </div>

      {stokAsimi > 0 ? (
        <div className="mt-2 rounded-md border border-uyari/40 bg-uyari-yumusak px-3 py-2 text-[0.8125rem] text-uyari">
          Stokta {miktarBicim(stokKalan ?? 0)} {birim.toLowerCase()} var; {miktarBicim(sayiya(miktar))}{" "}
          giriliyor — stok {miktarBicim(stokAsimi)} {birim.toLowerCase()} eksiye düşecek. Kayıt
          engellenmez.
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.75rem] text-muted-foreground">
          Matrah <strong className="text-foreground">{para(onizleme.tutar, false)}</strong> · KDV{" "}
          <strong className="text-foreground">{para(onizleme.kdvTutar, false)}</strong> · Satır Toplamı{" "}
          <strong className="text-foreground">{para(onizleme.toplam)}</strong>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={kapat}>
            Vazgeç
          </Button>
          <Button type="submit" size="sm" disabled={bekliyor}>
            {bekliyor ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {bekliyor ? "İşleniyor…" : kalem ? "Satırı Güncelle" : "Satırı Ekle"}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Stok arama kutusu — kabuldeki `KatalogArama` ile aynı davranış, PARÇA sabit. */
function KatalogArama({
  deger,
  degistir,
  sec,
}: {
  deger: string
  degistir: (d: string) => void
  sec: (s: KatalogSonucu) => void
}) {
  const [sonuclar, setSonuclar] = useState<KatalogSonucu[]>([])
  const [acik, setAcik] = useState(false)
  const [araniyor, setAraniyor] = useState(false)
  const sonAramaRef = useRef("")

  useEffect(() => {
    const arama = deger.trim()
    sonAramaRef.current = arama

    const zamanlayici = setTimeout(async () => {
      if (arama.length < 2) {
        setSonuclar([])
        setAcik(false)
        return
      }
      setAraniyor(true)
      try {
        const bulunan = await katalogAraAction(arama)
        if (sonAramaRef.current === arama) {
          setSonuclar(bulunan)
          setAcik(true)
        }
      } finally {
        setAraniyor(false)
      }
    }, 300)

    return () => clearTimeout(zamanlayici)
  }, [deger])

  return (
    <div className="relative">
      <input
        name="aciklama"
        value={deger}
        onChange={(e) => degistir(e.target.value)}
        onFocus={() => sonuclar.length && setAcik(true)}
        onBlur={() => setTimeout(() => setAcik(false), 150)}
        className={cn(MINI_ALAN, "pr-7")}
        placeholder="Parça kodu / adı"
        autoComplete="off"
      />
      <span className="absolute right-2 top-1.5 text-muted-foreground">
        {araniyor ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
      </span>

      {acik && sonuclar.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {sonuclar.map((s) => (
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
          ))}
        </ul>
      ) : null}
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
