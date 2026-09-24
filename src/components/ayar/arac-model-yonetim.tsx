"use client"

import { useActionState, useState, useTransition } from "react"
import { Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react"

import {
  aracModelKaydet,
  aracModelSil,
  type AracModelDurumu,
} from "@/app/(panel)/ayar/arac-model/actions"
import { ListeVeyaYaz } from "@/components/liste-veya-yaz"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"

type ElleKayit = { id: number; marka: string; model: string; aktif: boolean }

const ALAN =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

/**
 * Ayarlar > Araç Modelleri (SA-5 / madde 15).
 *
 * Hazır katalog (dış açık veri) `kilitli` satırlardır — burada
 * LİSTELENMEZ ve DEĞİŞTİRİLEMEZ, yalnızca marka bazında sayısı gösterilir.
 * Kullanıcı sadece elle marka/model ekler, düzenler, siler.
 */
export function AracModelYonetim({
  markalar,
  elle,
  hazirSayi,
  ekleyebilir,
  duzeltebilir,
  silebilir,
}: {
  markalar: { marka: string; sayi: number }[]
  elle: ElleKayit[]
  hazirSayi: number
  ekleyebilir: boolean
  duzeltebilir: boolean
  silebilir: boolean
}) {
  const [duzenlenen, setDuzenlenen] = useState<ElleKayit | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-3 text-[0.8125rem] text-muted-foreground">
        <p>
          <strong className="font-medium text-foreground">{markalar.length}</strong> marka
          {" · "}
          <strong className="font-medium text-foreground">{hazirSayi}</strong> hazır model
          {" (değiştirilemez)"} +{" "}
          <strong className="font-medium text-foreground">{elle.length}</strong> elle eklenen
        </p>
        <p className="mt-1">
          Hazır liste araç sahiplerinin en çok kullandığı marka/modelleri kapsar.
          Eksik bir araç varsa aşağıdan ekleyin — stok ve araç kartlarında hemen
          seçilebilir olur.
        </p>
      </div>

      {ekleyebilir || duzenlenen ? (
        <EkleForm
          key={duzenlenen?.id ?? "yeni"}
          markalar={markalar.map((m) => m.marka)}
          duzenlenen={duzenlenen}
          onIptal={() => setDuzenlenen(null)}
        />
      ) : null}

      <div className="panel overflow-hidden">
        <div className="panel-baslik">
          <h2 className="panel-baslik-yazi">Elle Eklenen Modeller ({elle.length})</h2>
        </div>
        {elle.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[0.8125rem] text-muted-foreground">
            Henüz elle eklenmiş model yok.
          </p>
        ) : (
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Marka</th>
                <th>Model</th>
                <th className="w-32 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {elle.map((k) => (
                <tr key={k.id}>
                  <td>{k.marka}</td>
                  <td>{k.model}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {duzeltebilir ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => setDuzenlenen(k)}
                          aria-label="Düzenle"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                      ) : null}
                      {silebilir ? <SilDugmesi id={k.id} ad={`${k.marka} ${k.model}`} /> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <details className="panel p-3 text-[0.8125rem]">
        <summary className="cursor-pointer font-medium">
          Hazır katalog — marka listesi ({markalar.length})
        </summary>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {markalar.map((m) => (
            <li key={m.marka} className="flex items-center gap-1.5 text-muted-foreground">
              <Lock className="size-3 shrink-0" aria-hidden />
              {m.marka}{" "}
              <span className="text-[0.6875rem]">({m.sayi})</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function EkleForm({
  markalar,
  duzenlenen,
  onIptal,
}: {
  markalar: string[]
  duzenlenen: ElleKayit | null
  onIptal: () => void
}) {
  const [durum, gonder, bekliyor] = useActionState<AracModelDurumu, FormData>(
    aracModelKaydet,
    {}
  )
  const hata = (alan: string) => durum.alanHatalari?.[alan]

  return (
    <form
      onSubmit={(o) => formGonderimi(o, gonder)}
      className="panel flex flex-col gap-3 p-3"
    >
      {duzenlenen ? <input type="hidden" name="id" value={duzenlenen.id} /> : null}

      <p className="text-[0.8125rem] font-medium">
        {duzenlenen ? "Modeli Düzenle" : "Yeni Marka / Model Ekle"}
      </p>

      {durum.hata ? (
        <p className="rounded-sm border border-tehlike/30 bg-tehlike-yumusak px-2.5 py-1.5 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </p>
      ) : null}
      {durum.basarili ? (
        <p className="rounded-sm border border-basari/30 bg-basari-yumusak px-2.5 py-1.5 text-[0.8125rem] text-basari">
          {durum.basarili}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="form-alani">
          <span className="form-etiket zorunlu-alan">Marka</span>
          <ListeVeyaYaz
            name="marka"
            secenekler={markalar}
            defaultValue={duzenlenen?.marka ?? ""}
            required
            placeholder="Örn: Renault"
          />
          {hata("marka") ? (
            <span className="text-[0.75rem] text-tehlike">{hata("marka")}</span>
          ) : (
            <span className="text-[0.6875rem] text-muted-foreground">
              Var olan bir marka yazabilir ya da yenisini ekleyebilirsiniz
            </span>
          )}
        </label>

        <label className="form-alani">
          <span className="form-etiket zorunlu-alan">Model</span>
          <input
            name="model"
            defaultValue={duzenlenen?.model ?? ""}
            required
            className={ALAN}
            placeholder="Örn: Clio"
          />
          {hata("model") ? (
            <span className="text-[0.75rem] text-tehlike">{hata("model")}</span>
          ) : null}
        </label>
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
          <Button type="button" size="sm" variant="outline" onClick={onIptal}>
            <X className="size-4" aria-hidden />
            Vazgeç
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function SilDugmesi({ id, ad }: { id: number; ad: string }) {
  const [onay, setOnay] = useState(false)
  const [bekliyor, basla] = useTransition()
  const [hata, setHata] = useState<string | null>(null)

  if (!onay) {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="size-7 text-tehlike hover:text-tehlike"
        onClick={() => setOnay(true)}
        aria-label="Sil"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    )
  }

  return (
    <span className="flex items-center gap-1">
      {hata ? <span className="text-[0.6875rem] text-tehlike">{hata}</span> : null}
      <Button
        size="sm"
        variant="destructive"
        className="h-7"
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            const sonuc = await aracModelSil(id)
            if (sonuc.hata) {
              setHata(sonuc.hata)
              setOnay(false)
            }
          })
        }
      >
        {bekliyor ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : `Sil: ${ad}`}
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setOnay(false)}>
        Vazgeç
      </Button>
    </span>
  )
}
