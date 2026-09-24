"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  bolumDurumDegistir,
  bolumKaydet,
  bolumSil,
  type BolumFormDurumu,
} from "@/app/(panel)/iscilik/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * İŞÇİLİK BÖLÜMLERİ
 *
 * Selpar'da bu ekran ayrı bir "Tanımlamalar" sayfası; bizde kayıt sayısı
 * az olduğu için liste ve form aynı ekranda. Düzenleme satır içinde değil
 * üstteki tek formda yapılıyor — satır içi form her satırda ayrı `useActionState`
 * gerektirir, 20 satırda 20 ayrı form durumu demekti.
 */

export type BolumSatiri = {
  id: number
  kod: string | null
  ad: string
  sira: number
  aktif: boolean
  kullanim: number
}

export function BolumYonetimi({
  bolumler,
  duzeltebilir,
  silebilir,
  donusYol,
  donusAlan,
}: {
  bolumler: BolumSatiri[]
  duzeltebilir: boolean
  silebilir: boolean
  donusYol?: string
  donusAlan?: string
}) {
  const [durum, setDurum] = useState<BolumFormDurumu>({})
  const [duzenlenen, setDuzenlenen] = useState<BolumSatiri | null>(null)
  const [bekliyor, basla] = useTransition()
  const [islemBekliyor, islemBasla] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  /**
   * `useActionState` yerine elle transition: kayıt başarılıysa formu
   * temizleyip düzenleme modundan çıkmamız gerekiyor, bunu useActionState ile
   * yapmak sonucu effect'te dinlemeyi (ve zincirleme render) zorunlu kılıyordu.
   */
  function gonder(form: FormData) {
    basla(async () => {
      const sonuc = await bolumKaydet({}, form)
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

  function durumDegistir(satir: BolumSatiri) {
    islemBasla(async () => {
      const sonuc = await bolumDurumDegistir(satir.id, !satir.aktif)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(satir.aktif ? "Bölüm pasife alındı." : "Bölüm aktifleştirildi.")
    })
  }

  function sil(satir: BolumSatiri) {
    if (!confirm(`"${satir.ad}" bölümü silinsin mi?`)) return
    islemBasla(async () => {
      const sonuc = await bolumSil(satir.id)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success("Bölüm silindi.")
    })
  }

  return (
    <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <form ref={formRef} onSubmit={(olay) => formGonderimi(olay, gonder)} className="panel h-fit p-4">
        {/* key: düzenlenen satır değiştiğinde defaultValue'ların yenilenmesi için */}
        <h2 className="mb-3 text-[0.8125rem] font-semibold">
          {duzenlenen ? "Bölümü Düzenle" : "Yeni Bölüm"}
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
              Bölüm Adı
            </label>
            <input
              id="ad"
              name="ad"
              required
              maxLength={100}
              defaultValue={duzenlenen?.ad ?? ""}
              placeholder="Örn: Mekanik, Kaporta, Elektrik"
              className={ALAN_SINIFI}
            />
            {hata("ad") ? (
              <p className="text-[0.75rem] text-tehlike">{hata("ad")}</p>
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
        {bolumler.length === 0 ? (
          <div className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
            Henüz bölüm tanımı yok. Soldaki formdan ilk bölümü ekleyin.
          </div>
        ) : (
          <div className="yazdirma-alani overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="text-right">Sıra</th>
                  <th>Kod</th>
                  <th>Bölüm Adı</th>
                  <th className="text-right">İşçilik Sayısı</th>
                  <th>Durum</th>
                  <th className="yazdirma-disi text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {bolumler.map((b) => (
                  <tr key={b.id} className={cn(duzenlenen?.id === b.id && "bg-accent/40")}>
                    <td className="text-right tabular-nums text-muted-foreground">{b.sira}</td>
                    <td className="font-mono text-[0.75rem]">{b.kod ?? "—"}</td>
                    <td className="font-medium">{b.ad}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {b.kullanim}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium",
                          b.aktif
                            ? "bg-basari-yumusak text-basari"
                            : "bg-uyari-yumusak text-uyari"
                        )}
                      >
                        {b.aktif ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="yazdirma-disi">
                      <div className="flex items-center justify-end gap-1">
                        {duzeltebilir ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Düzenle"
                              aria-label={`${b.ad} bölümünü düzenle`}
                              onClick={() => setDuzenlenen(b)}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={islemBekliyor}
                              title={b.aktif ? "Pasife al" : "Aktifleştir"}
                              aria-label={b.aktif ? "Pasife al" : "Aktifleştir"}
                              onClick={() => durumDegistir(b)}
                            >
                              {b.aktif ? (
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
                            aria-label={`${b.ad} bölümünü sil`}
                            className="text-tehlike hover:text-tehlike"
                            onClick={() => sil(b)}
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
