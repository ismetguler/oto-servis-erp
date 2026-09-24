"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  filoSozlesmesiKaydet,
  filoSozlesmesiSil,
  type FiloSozlesmesiDurumu,
} from "@/app/(panel)/cari/filo/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { tarih } from "@/lib/bicim"
import { cn } from "@/lib/utils"

type Sozlesme = {
  id: number
  ad: string
  baslangic: Date | string
  bitis: Date | string
  vadeGun: number
  kapsamPlakalari: string | null
  aktif: boolean
  notu: string | null
}

const gun = (d: Date | string) => new Date(d).toISOString().slice(0, 10)

/**
 * SA-3.3 — Cari kartındaki "Filo Sözleşmeleri" paneli. Ayrı route açmamak
 * için liste + ekle/düzenle formu tek client bileşende (kara liste işlemi
 * deseniyle aynı). Kabul açılırken bu sözleşmelerden vade önerisi
 * gelir; burası yalnızca yönetim ekranı.
 */
export function FiloSozlesmeleri({
  cariId,
  sozlesmeler,
  duzeltebilir,
}: {
  cariId: number
  sozlesmeler: Sozlesme[]
  duzeltebilir: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<null | "yeni" | number>(null)
  const [durum, setDurum] = useState<FiloSozlesmesiDurumu>({})
  const [bekliyor, basla] = useTransition()

  const duzenlenen =
    typeof form === "number" ? sozlesmeler.find((s) => s.id === form) : undefined

  function gonder(fd: FormData) {
    basla(async () => {
      const sonuc = await filoSozlesmesiKaydet({}, fd)
      setDurum(sonuc)
      if (sonuc.basarili) {
        toast.success(sonuc.basarili)
        setForm(null)
        router.refresh()
      } else if (sonuc.hata && !sonuc.alanHatalari) {
        toast.error(sonuc.hata)
      }
    })
  }

  function sil(id: number, ad: string) {
    if (!window.confirm(`"${ad}" sözleşmesi silinsin mi?`)) return
    basla(async () => {
      const sonuc = await filoSozlesmesiSil(id)
      if (sonuc.basarili) {
        toast.success(sonuc.basarili)
        router.refresh()
      } else {
        toast.error(sonuc.hata ?? "Silinemedi.")
      }
    })
  }

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  return (
    <div className="panel overflow-hidden">
      <div className="panel-baslik">
        <h2 className="panel-baslik-yazi">Filo Sözleşmeleri</h2>
        {duzeltebilir && form === null ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDurum({})
              setForm("yeni")
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            Ekle
          </Button>
        ) : null}
      </div>

      {form !== null ? (
        <form
          onSubmit={(olay) => formGonderimi(olay, gonder)}
          className="border-b border-border bg-muted/30 p-3.5 text-[0.8125rem]"
        >
          <input type="hidden" name="cariId" value={cariId} />
          {typeof form === "number" ? (
            <input type="hidden" name="id" value={form} />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Alan etiket="Sözleşme Adı" hata={hata("ad")} genis>
              <input
                name="ad"
                required
                maxLength={120}
                autoFocus
                defaultValue={duzenlenen?.ad ?? ""}
                placeholder="Örn: X Lojistik 2026 Filo Anlaşması"
                className={girdiSinifi(hata("ad"))}
              />
            </Alan>

            <Alan etiket="Başlangıç" hata={hata("baslangic")}>
              <input
                name="baslangic"
                type="date"
                required
                defaultValue={duzenlenen ? gun(duzenlenen.baslangic) : ""}
                className={girdiSinifi(hata("baslangic"))}
              />
            </Alan>

            <Alan etiket="Bitiş" hata={hata("bitis")}>
              <input
                name="bitis"
                type="date"
                required
                defaultValue={duzenlenen ? gun(duzenlenen.bitis) : ""}
                className={girdiSinifi(hata("bitis"))}
              />
            </Alan>

            <Alan etiket="Vade (gün)" hata={hata("vadeGun")}>
              <input
                name="vadeGun"
                inputMode="numeric"
                defaultValue={duzenlenen ? String(duzenlenen.vadeGun) : "0"}
                className={girdiSinifi(hata("vadeGun"))}
              />
            </Alan>

            <Alan
              etiket="Kapsam plakaları (boş = tüm araçlar)"
              hata={hata("kapsamPlakalari")}
              genis
            >
              <textarea
                name="kapsamPlakalari"
                rows={2}
                defaultValue={duzenlenen?.kapsamPlakalari ?? ""}
                placeholder="Boş bırakılırsa carinin tüm araçları. Örn: 38 ABC 123, 38 DEF 456"
                className={girdiSinifi(hata("kapsamPlakalari"))}
              />
            </Alan>

            <Alan etiket="Not" hata={hata("notu")} genis>
              <textarea
                name="notu"
                rows={2}
                defaultValue={duzenlenen?.notu ?? ""}
                className={girdiSinifi(hata("notu"))}
              />
            </Alan>
          </div>

          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              name="aktif"
              defaultChecked={duzenlenen ? duzenlenen.aktif : true}
            />
            Aktif (kabul açılırken öneri olarak gelsin)
          </label>

          <div className="mt-3 flex items-center gap-2">
            <Button type="submit" size="sm" disabled={bekliyor}>
              {bekliyor ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {bekliyor ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setForm(null)}
              disabled={bekliyor}
            >
              <X className="size-4" aria-hidden />
              Vazgeç
            </Button>
          </div>
        </form>
      ) : null}

      {sozlesmeler.length === 0 && form === null ? (
        <p className="px-3.5 py-6 text-center text-[0.8125rem] text-muted-foreground">
          Bu cariye tanımlı filo sözleşmesi yok.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {sozlesmeler.map((s) => (
            <li key={s.id} className="px-3.5 py-2.5 text-[0.8125rem]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.ad}</span>
                    {!s.aktif ? (
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                        Pasif
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                    {tarih(s.baslangic)} – {tarih(s.bitis)} · Vade {s.vadeGun} gün
                  </p>
                  {s.kapsamPlakalari ? (
                    <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                      Kapsam: {s.kapsamPlakalari}
                    </p>
                  ) : null}
                  {s.notu ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-[0.75rem]">
                      {s.notu}
                    </p>
                  ) : null}
                </div>
                {duzeltebilir ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        setDurum({})
                        setForm(s.id)
                      }}
                      aria-label="Düzenle"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-tehlike hover:text-tehlike"
                      onClick={() => sil(s.id, s.ad)}
                      disabled={bekliyor}
                      aria-label="Sil"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function girdiSinifi(hatali?: string) {
  return cn(
    "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
    hatali && "border-tehlike"
  )
}

function Alan({
  etiket,
  hata,
  genis,
  children,
}: {
  etiket: string
  hata?: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={genis ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-[0.75rem] font-medium text-muted-foreground">
        {etiket}
      </label>
      {children}
      {hata ? <p className="mt-1 text-[0.75rem] text-tehlike">{hata}</p> : null}
    </div>
  )
}
