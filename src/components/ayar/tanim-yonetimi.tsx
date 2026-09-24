"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  tanimDurumDegistir,
  tanimKaydet,
  tanimSil,
  type TanimFormDurumu,
} from "@/app/(panel)/ayar/tanim/actions"
import type { TanimSatiri } from "@/app/(panel)/ayar/tanim/veri"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"
import type { TanimTur } from "@/generated/prisma/enums"

/**
 * `iscilik/bolum-yonetimi.tsx`teki `BolumYonetimi`nin genelleştirilmiş
 * hali — tek fark `tur`un artık sabit değil prop olarak gelmesi (form
 * gizli alanda `tur`u da gönderiyor). Aynı sebeple satır içi değil üstte
 * tek form: yirmi kayıtta yirmi ayrı `useActionState` istemezdik.
 */
export function TanimYonetimi({
  tur,
  baslik,
  kayitlar,
  ekleyebilir,
  duzeltebilir,
  silebilir,
  donusYol,
  donusAlan,
}: {
  tur: TanimTur
  baslik: string
  kayitlar: TanimSatiri[]
  ekleyebilir: boolean
  duzeltebilir: boolean
  silebilir: boolean
  /** "+ Yeni X" ile bir formdan gelindiyse: kayıt eklenince dönülecek adres
      ve o formdaki hangi alanın yeni değeri seçili göstereceği. */
  donusYol?: string
  donusAlan?: string
}) {
  const [durum, setDurum] = useState<TanimFormDurumu>({})
  const [duzenlenen, setDuzenlenen] = useState<TanimSatiri | null>(null)
  const [bekliyor, basla] = useTransition()
  const [islemBekliyor, islemBasla] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  function gonder(form: FormData) {
    basla(async () => {
      const sonuc = await tanimKaydet({}, form)
      setDurum(sonuc)
      if (sonuc.basarili) {
        toast.success(sonuc.basarili)
        setDuzenlenen(null)
        formRef.current?.reset()
        if (donusYol && donusAlan) {
          const ad = String(form.get("ad") ?? "")
          const ayrac = donusYol.includes("?") ? "&" : "?"
          router.push(
            `${donusYol}${ayrac}donusAlan=${encodeURIComponent(donusAlan)}&donusDeger=${encodeURIComponent(ad)}`
          )
        }
      }
    })
  }

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  function durumDegistir(satir: TanimSatiri) {
    islemBasla(async () => {
      const sonuc = await tanimDurumDegistir(satir.id, !satir.aktif)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(satir.aktif ? "Pasife alındı." : "Aktifleştirildi.")
    })
  }

  function sil(satir: TanimSatiri) {
    if (!confirm(`"${satir.ad}" silinsin mi?`)) return
    islemBasla(async () => {
      const sonuc = await tanimSil(satir.id)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success("Tanım silindi.")
    })
  }

  return (
    <div className="[&>*]:min-w-0 grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {ekleyebilir || duzeltebilir ? (
        <form
          ref={formRef}
          onSubmit={(olay) => formGonderimi(olay, gonder)}
          className="panel h-fit p-4"
        >
          <input type="hidden" name="tur" value={tur} />
          {duzenlenen ? <input type="hidden" name="id" value={duzenlenen.id} /> : null}

          <h2 className="mb-1 text-[0.8125rem] font-semibold">
            {duzenlenen ? `${baslik} — Düzenle` : `Yeni ${baslik}`}
          </h2>
          {donusYol && !duzenlenen ? (
            <p className="mb-3 text-[0.75rem] text-muted-foreground">
              Ekleyince geldiğiniz forma geri döneceksiniz.
            </p>
          ) : null}

          {durum.hata ? (
            <div className="mb-3 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
              {durum.hata}
            </div>
          ) : null}

          <div key={duzenlenen?.id ?? "yeni"} className="grid gap-3">
            <div className="form-alani">
              <label htmlFor="ad" className="form-etiket zorunlu-alan">
                Ad
              </label>
              <input
                id="ad"
                name="ad"
                required
                maxLength={150}
                defaultValue={duzenlenen?.ad ?? ""}
                className={ALAN_SINIFI}
              />
              {hata("ad") ? <p className="text-[0.75rem] text-tehlike">{hata("ad")}</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="form-alani">
                <label htmlFor="kod" className="form-etiket">
                  Kod
                </label>
                <input
                  id="kod"
                  name="kod"
                  maxLength={20}
                  defaultValue={duzenlenen?.kod ?? ""}
                  className={cn(ALAN_SINIFI, "font-mono")}
                />
              </div>
              <div className="form-alani">
                <label htmlFor="sira" className="form-etiket">
                  Sıra
                </label>
                <input
                  id="sira"
                  name="sira"
                  inputMode="numeric"
                  defaultValue={String(duzenlenen?.sira ?? 0)}
                  className={cn(ALAN_SINIFI, "text-right")}
                />
                {hata("sira") ? (
                  <p className="text-[0.75rem] text-tehlike">{hata("sira")}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={bekliyor}>
                {bekliyor ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {bekliyor ? "Kaydediliyor…" : duzenlenen ? "Güncelle" : "Ekle"}
              </Button>
              {duzenlenen ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDuzenlenen(null)
                    setDurum({})
                  }}
                >
                  <X className="size-4" aria-hidden />
                  Vazgeç
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}

      <div className="panel overflow-hidden">
        {kayitlar.length === 0 ? (
          <div className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
            Henüz &quot;{baslik}&quot; tanımı yok.
          </div>
        ) : (
          <div className="yazdirma-alani max-h-[calc(100svh-16rem)] overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="text-right">Sıra</th>
                  <th>Kod</th>
                  <th>Ad</th>
                  <th className="text-right">Kullanım</th>
                  <th>Durum</th>
                  {duzeltebilir || silebilir ? (
                    <th className="yazdirma-disi text-right">İşlem</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {kayitlar.map((k) => (
                  <tr key={k.id} className={cn(duzenlenen?.id === k.id && "bg-accent/40")}>
                    <td className="text-right tabular-nums text-muted-foreground">{k.sira}</td>
                    <td className="font-mono text-[0.75rem]">{k.kod ?? "—"}</td>
                    <td className="font-medium">{k.ad}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{k.kullanim}</td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium",
                          k.aktif
                            ? "bg-basari-yumusak text-basari"
                            : "bg-uyari-yumusak text-uyari"
                        )}
                      >
                        {k.aktif ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    {duzeltebilir || silebilir ? (
                      <td className="yazdirma-disi">
                        <div className="flex items-center justify-end gap-1">
                          {duzeltebilir ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Düzenle"
                                aria-label={`${k.ad} tanımını düzenle`}
                                onClick={() => {
                                  setDurum({})
                                  setDuzenlenen(k)
                                }}
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={islemBekliyor}
                                title={k.aktif ? "Pasife al" : "Aktifleştir"}
                                aria-label={k.aktif ? "Pasife al" : "Aktifleştir"}
                                onClick={() => durumDegistir(k)}
                              >
                                {k.aktif ? (
                                  <Ban className="size-4" aria-hidden />
                                ) : (
                                  <Check className="size-4" aria-hidden />
                                )}
                              </Button>
                            </>
                          ) : null}
                          {silebilir ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={islemBekliyor}
                              title="Sil"
                              aria-label={`${k.ad} tanımını sil`}
                              className="text-tehlike hover:text-tehlike"
                              onClick={() => sil(k)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"
