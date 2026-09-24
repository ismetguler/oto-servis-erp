"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Ban, BarChart3, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  projeDurumDegistir,
  projeKaydet,
  projeSil,
  type ProjeFormDurumu,
} from "@/app/(panel)/servis/proje/actions"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * PROJE TANIMLARI
 *
 * İşçilik Bölümleri ekranının ikizi; farkı sağdaki kullanım sütunları:
 * proje bir etiket olduğu için "kaç kabul, ne kadar iş" bilgisi olmadan
 * hangisinin silinebileceğine karar vermek zor.
 */

export type ProjeSatiri = {
  id: number
  kod: string | null
  ad: string
  sira: number
  aktif: boolean
  kabulSayisi: number
  aracSayisi: number
  tutar: number
}

export function ProjeYonetimi({
  projeler,
  duzeltebilir,
  silebilir,
  donusYol,
  donusAlan,
}: {
  projeler: ProjeSatiri[]
  duzeltebilir: boolean
  silebilir: boolean
  donusYol?: string
  donusAlan?: string
}) {
  const [durum, setDurum] = useState<ProjeFormDurumu>({})
  const [duzenlenen, setDuzenlenen] = useState<ProjeSatiri | null>(null)
  const [bekliyor, basla] = useTransition()
  const [islemBekliyor, islemBasla] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  function gonder(form: FormData) {
    basla(async () => {
      const sonuc = await projeKaydet({}, form)
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

  function durumDegistir(satir: ProjeSatiri) {
    islemBasla(async () => {
      const sonuc = await projeDurumDegistir(satir.id, !satir.aktif)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(satir.aktif ? "Proje pasife alındı." : "Proje aktifleştirildi.")
    })
  }

  function sil(satir: ProjeSatiri) {
    if (!confirm(`"${satir.ad}" projesi silinsin mi?`)) return
    islemBasla(async () => {
      const sonuc = await projeSil(satir.id)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success("Proje silindi.")
    })
  }

  return (
    <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <form ref={formRef} onSubmit={(olay) => formGonderimi(olay, gonder)} className="panel h-fit p-4">
        <h2 className="mb-3 text-[0.8125rem] font-semibold">
          {duzenlenen ? "Projeyi Düzenle" : "Yeni Proje"}
        </h2>

        {duzenlenen ? <input type="hidden" name="id" value={duzenlenen.id} /> : null}

        {durum.hata ? (
          <div className="mb-3 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
            {durum.hata}
          </div>
        ) : null}

        <div key={duzenlenen?.id ?? "yeni"} className="grid gap-3">
          <div className="form-alani">
            <label htmlFor="ad" className="form-etiket zorunlu-alan">
              Proje Adı
            </label>
            <input
              id="ad"
              name="ad"
              required
              maxLength={100}
              defaultValue={duzenlenen?.ad ?? ""}
              placeholder="Örn: X Lojistik Filo Bakım"
              className={ALAN_SINIFI}
            />
            {hata("ad") ? <p className="text-[0.75rem] text-tehlike">{hata("ad")}</p> : null}
            {duzenlenen && duzenlenen.kabulSayisi + duzenlenen.aracSayisi > 0 ? (
              <p className="text-[0.6875rem] text-muted-foreground">
                Adı değiştirirseniz {duzenlenen.kabulSayisi} kabul ve {duzenlenen.aracSayisi}{" "}
                araç kaydındaki proje adı da güncellenir.
              </p>
            ) : null}
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
                onClick={() => setDuzenlenen(null)}
              >
                <X className="size-4" aria-hidden />
                Vazgeç
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <div className="panel overflow-hidden">
        {projeler.length === 0 ? (
          <div className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
            Henüz proje tanımı yok. Soldaki formdan ilk projeyi ekleyin.
          </div>
        ) : (
          <div className="yazdirma-alani overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="text-right">Sıra</th>
                  <th>Kod</th>
                  <th>Proje Adı</th>
                  <th className="text-right">Kabul</th>
                  <th className="text-right">Araç</th>
                  <th className="text-right">Toplam İş</th>
                  <th>Durum</th>
                  <th className="yazdirma-disi text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {projeler.map((p) => (
                  <tr key={p.id} className={cn(duzenlenen?.id === p.id && "bg-accent/40")}>
                    <td className="text-right tabular-nums text-muted-foreground">{p.sira}</td>
                    <td className="font-mono text-[0.75rem]">{p.kod ?? "—"}</td>
                    <td className="font-medium">{p.ad}</td>
                    <td className="text-right tabular-nums">{p.kabulSayisi}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {p.aracSayisi}
                    </td>
                    <td className="text-right tabular-nums">{para(p.tutar)}</td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium",
                          p.aktif
                            ? "bg-basari-yumusak text-basari"
                            : "bg-uyari-yumusak text-uyari"
                        )}
                      >
                        {p.aktif ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="yazdirma-disi">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Proje raporunu aç"
                          aria-label={`${p.ad} projesinin raporunu aç`}
                        >
                          <Link
                            href={`/servis/proje/rapor?proje=${encodeURIComponent(p.ad)}`}
                          >
                            <BarChart3 className="size-4" aria-hidden />
                          </Link>
                        </Button>
                        {duzeltebilir ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Düzenle"
                              aria-label={`${p.ad} projesini düzenle`}
                              onClick={() => setDuzenlenen(p)}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={islemBekliyor}
                              title={p.aktif ? "Pasife al" : "Aktifleştir"}
                              aria-label={p.aktif ? "Pasife al" : "Aktifleştir"}
                              onClick={() => durumDegistir(p)}
                            >
                              {p.aktif ? (
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
                            aria-label={`${p.ad} projesini sil`}
                            className="text-tehlike hover:text-tehlike"
                            onClick={() => sil(p)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </td>
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
