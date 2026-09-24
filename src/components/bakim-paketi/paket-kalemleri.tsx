"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { AlertTriangle, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  paketKalemKaydet,
  paketKalemSil,
  paketKatalogAra,
  type PaketKalemDurumu,
} from "@/app/(panel)/servis/bakim-paketi/actions"
import { Button } from "@/components/ui/button"
import { miktar as miktarBicim, para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * BAKIM PAKETİ SATIRLARI
 *
 * Kabul kartındaki kalem ızgarasının sadeleştirilmiş hâli: burada KDV YOK —
 * kabule uygulanırken katalogdan gelir. Pakette dondurulsaydı, katalog
 * fiyatı/KDV'si değişince kartlarda sessizce eski değer kalırdı.
 */

export type PaketKalemSatiri = {
  id: number
  sira: number
  tur: "PARCA" | "ISCILIK" | "DIS_HIZMET"
  stokId: number | null
  iscilikId: number | null
  aciklama: string
  miktar: number
  birim: string
  fiyatSabit: number | null
  katalogFiyat: number | null
  kdvOrani: number
  gecerliFiyat: number
  stokta: number | null
  uyari: string | null
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

const TUR_ADI: Record<PaketKalemSatiri["tur"], string> = {
  PARCA: "Parça",
  ISCILIK: "İşçilik",
  DIS_HIZMET: "Dış Hizmet",
}

export function PaketKalemleri({
  paketId,
  kalemler,
  duzenlenebilir,
}: {
  paketId: number
  kalemler: PaketKalemSatiri[]
  duzenlenebilir: boolean
}) {
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<PaketKalemSatiri | null>(null)

  const araToplam = kalemler.reduce((t, k) => t + k.miktar * k.gecerliFiyat, 0)
  const kdvToplam = kalemler.reduce(
    (t, k) => t + (k.miktar * k.gecerliFiyat * k.kdvOrani) / 100,
    0
  )

  function formuKapat() {
    setFormAcik(false)
    setDuzenlenen(null)
  }

  function satiriDuzenle(kalem: PaketKalemSatiri) {
    setDuzenlenen(kalem)
    setFormAcik(true)
  }

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-[0.8125rem] font-semibold">
          Paket İçeriği
          <span className="ml-2 font-normal text-muted-foreground">
            {kalemler.length} satır
          </span>
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
        <PaketKalemFormu
          key={duzenlenen?.id ?? "yeni"}
          paketId={paketId}
          kalem={duzenlenen}
          kapat={formuKapat}
        />
      ) : null}

      {kalemler.length === 0 ? (
        <div className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
          Paket boş. Parça ve işçilik satırlarını ekleyin — kabul kartında bu satırların
          tamamı tek hamlede eklenecek.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th className="text-right">#</th>
                <th>Tür</th>
                <th>Açıklama</th>
                <th className="text-right">Miktar</th>
                <th>Birim</th>
                <th className="text-right">Fiyat</th>
                <th>Fiyat Kaynağı</th>
                <th className="text-right">KDV %</th>
                <th className="text-right">Tutar</th>
                {duzenlenebilir ? <th className="yazdirma-disi text-right">İşlem</th> : null}
              </tr>
            </thead>
            <tbody>
              {kalemler.map((k, sira) => (
                <tr key={k.id}>
                  <td className="text-right tabular-nums text-muted-foreground">{sira + 1}</td>
                  <td>
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem]">
                      {TUR_ADI[k.tur]}
                    </span>
                  </td>
                  <td className="max-w-[24rem] truncate font-medium">
                    {k.aciklama}
                    {k.uyari ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-[0.6875rem] text-uyari">
                        <AlertTriangle className="size-3" aria-hidden />
                        {k.uyari}
                      </span>
                    ) : null}
                    {k.stokta !== null ? (
                      <span className="ml-2 text-[0.6875rem] text-muted-foreground">
                        stok {miktarBicim(k.stokta)}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-right tabular-nums">{miktarBicim(k.miktar)}</td>
                  <td className="text-muted-foreground">{k.birim}</td>
                  <td className="text-right tabular-nums">{para(k.gecerliFiyat)}</td>
                  <td className="text-[0.6875rem] text-muted-foreground">
                    {k.fiyatSabit !== null ? "Pakette sabit" : "Güncel katalog"}
                  </td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {miktarBicim(k.kdvOrani)}
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {para(k.miktar * k.gecerliFiyat)}
                  </td>
                  {duzenlenebilir ? (
                    <td className="yazdirma-disi">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Düzenle"
                          aria-label={`${k.aciklama} satırını düzenle`}
                          onClick={() => satiriDuzenle(k)}
                          className="rounded-sm p-1 text-muted-foreground hover:bg-muted"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <SatirSil kalemId={k.id} aciklama={k.aciklama} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium">
                <td colSpan={8} className="text-right">
                  Ara Toplam (KDV hariç)
                </td>
                <td className="text-right tabular-nums">{para(araToplam)}</td>
                {duzenlenebilir ? <td /> : null}
              </tr>
              <tr>
                <td colSpan={8} className="text-right text-muted-foreground">
                  KDV
                </td>
                <td className="text-right tabular-nums">{para(kdvToplam)}</td>
                {duzenlenebilir ? <td /> : null}
              </tr>
              <tr className="font-semibold">
                <td colSpan={8} className="text-right">
                  Paket Toplamı (bugünkü fiyatlarla)
                </td>
                <td className="text-right tabular-nums">{para(araToplam + kdvToplam)}</td>
                {duzenlenebilir ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function SatirSil({ kalemId, aciklama }: { kalemId: number; aciklama: string }) {
  const [bekliyor, basla] = useTransition()

  return (
    <button
      type="button"
      disabled={bekliyor}
      title="Sil"
      aria-label={`${aciklama} satırını sil`}
      onClick={() => {
        if (!confirm(`"${aciklama}" satırı paketten çıkarılsın mı?`)) return
        basla(async () => {
          const sonuc = await paketKalemSil(kalemId)
          if (sonuc.hata) toast.error(sonuc.hata)
          else toast.success("Satır silindi.")
        })
      }}
      className="rounded-sm p-1 text-muted-foreground hover:bg-tehlike-yumusak hover:text-tehlike disabled:opacity-50"
    >
      {bekliyor ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="size-3.5" aria-hidden />
      )}
    </button>
  )
}

function PaketKalemFormu({
  paketId,
  kalem,
  kapat,
}: {
  paketId: number
  kalem: PaketKalemSatiri | null
  kapat: () => void
}) {
  const [durum, gonder, bekliyor] = useActionState<PaketKalemDurumu, FormData>(
    async (onceki, form) => {
      const sonuc = await paketKalemKaydet(onceki, form)
      if (!sonuc.hata) {
        toast.success(sonuc.basarili ?? "Satır kaydedildi.")
        kapat()
      }
      return sonuc
    },
    {}
  )

  const [tur, setTur] = useState<PaketKalemSatiri["tur"]>(kalem?.tur ?? "PARCA")
  const [stokId, setStokId] = useState<number | null>(kalem?.stokId ?? null)
  const [iscilikId, setIscilikId] = useState<number | null>(kalem?.iscilikId ?? null)
  const [aciklama, setAciklama] = useState(kalem?.aciklama ?? "")
  const [birim, setBirim] = useState(kalem?.birim ?? "ADET")
  const [miktar, setMiktar] = useState(String(kalem?.miktar ?? 1))
  const [fiyatSabit, setFiyatSabit] = useState(
    kalem?.fiyatSabit === null || kalem?.fiyatSabit === undefined ? "" : String(kalem.fiyatSabit)
  )
  const [katalogFiyat, setKatalogFiyat] = useState<number | null>(kalem?.katalogFiyat ?? null)

  function turuDegistir(yeni: PaketKalemSatiri["tur"]) {
    setTur(yeni)
    setStokId(null)
    setIscilikId(null)
    setKatalogFiyat(null)
    if (!kalem) setBirim(yeni === "ISCILIK" ? "SAAT" : "ADET")
  }

  function katalogdanSec(secim: KatalogSonucu) {
    if (tur === "ISCILIK") setIscilikId(secim.id)
    else setStokId(secim.id)
    setAciklama(`${secim.kod} — ${secim.ad}`)
    setBirim(secim.birim)
    setKatalogFiyat(secim.fiyat)
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="border-b border-border bg-muted/30 p-3">
      <input type="hidden" name="paketId" value={paketId} />
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
            onChange={(e) => turuDegistir(e.target.value as PaketKalemSatiri["tur"])}
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
            {tur !== "DIS_HIZMET" ? (
              <span className="ml-1 font-normal text-muted-foreground">
                (katalogdan arayın veya elle yazın)
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
            <KatalogArama
              tur={tur === "ISCILIK" ? "ISCILIK" : "PARCA"}
              deger={aciklama}
              degistir={(d) => {
                setAciklama(d)
                // Elle yazıldıysa katalog bağı kopar; fiyat sabit alandan gelir.
                setStokId(null)
                setIscilikId(null)
                setKatalogFiyat(null)
              }}
              sec={katalogdanSec}
            />
          )}
        </div>

        <div>
          <MiniEtiket>Miktar</MiniEtiket>
          <input
            name="miktar"
            value={miktar}
            onChange={(e) => setMiktar(e.target.value)}
            inputMode="decimal"
            className={cn(MINI_ALAN, "text-right")}
          />
        </div>

        <div>
          <MiniEtiket>Birim</MiniEtiket>
          <input
            name="birim"
            value={birim}
            onChange={(e) => setBirim(e.target.value)}
            maxLength={20}
            className={MINI_ALAN}
          />
        </div>

        <div className="col-span-2">
          <MiniEtiket>
            Sabit Fiyat
            <span className="ml-1 font-normal text-muted-foreground">
              (boş = güncel katalog fiyatı)
            </span>
          </MiniEtiket>
          <input
            name="fiyatSabit"
            value={fiyatSabit}
            onChange={(e) => setFiyatSabit(e.target.value)}
            inputMode="decimal"
            placeholder={katalogFiyat === null ? "katalogdan" : para(katalogFiyat, false)}
            className={cn(MINI_ALAN, "text-right")}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[0.6875rem] text-muted-foreground">
          Fiyat ve KDV kabule eklenirken katalogdan okunur.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={kapat}>
            Vazgeç
          </Button>
          <Button type="submit" size="sm" disabled={bekliyor}>
            {bekliyor ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            {kalem ? "Güncelle" : "Ekle"}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Kabul kartındaki katalog aramasının aynısı — aynı server action'ı kullanır. */
function KatalogArama({
  tur,
  deger,
  degistir,
  sec,
}: {
  tur: "PARCA" | "ISCILIK"
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
        const bulunan = await paketKatalogAra(tur, arama)
        // Kullanıcı yazmaya devam ettiyse eski sonuç ekrana basılmasın.
        if (sonAramaRef.current === arama) {
          setSonuclar(bulunan)
          setAcik(true)
        }
      } finally {
        setAraniyor(false)
      }
    }, 300)

    return () => clearTimeout(zamanlayici)
  }, [deger, tur])

  return (
    <div className="relative">
      <input
        name="aciklama"
        value={deger}
        onChange={(e) => degistir(e.target.value)}
        onFocus={() => sonuclar.length && setAcik(true)}
        onBlur={() => setTimeout(() => setAcik(false), 150)}
        className={cn(MINI_ALAN, "pr-7")}
        placeholder={tur === "PARCA" ? "Parça kodu / adı" : "İşçilik kodu / adı"}
        autoComplete="off"
      />
      <span className="absolute right-2 top-1.5 text-muted-foreground">
        {araniyor ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Search className="size-3.5" aria-hidden />
        )}
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
