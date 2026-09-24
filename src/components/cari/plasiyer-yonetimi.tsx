"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Ban, Check, ExternalLink, Loader2, Pencil, Plus, X } from "lucide-react"
import { toast } from "sonner"

import {
  plasiyerDurumDegistir,
  plasiyerKaydet,
  type TanimFormDurumu,
} from "@/app/(panel)/cari/tanimlar/actions"
import { Button } from "@/components/ui/button"
import { TelefonGirdi } from "@/components/ui/telefon-girdi"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * PLASİYER (SORUMLU PERSONEL) TANIMLARI
 *
 * Plasiyer bir cari kaydıdır (turu = PERSONEL) — bu yüzden buradaki form
 * sadece kimlik alanlarını yönetir, kartın bakiye/limit tarafına dokunmaz.
 * Satırdaki "kartı aç" bağlantısı tam cari kartına götürüyor; iki ekran aynı
 * kaydı iki farklı derinlikte gösterdiği için burada alanları çoğaltmak,
 * ikisinin ayrışması demekti.
 *
 * Silme düğmesi bilinçli olarak YOK: plasiyerin geçmiş cari hareketleri
 * olabilir, silme cari kartının kendi ekranından yapılır (orada bakiye
 * ve hareket kontrolleri zaten var). Buradan sadece pasife alınır.
 */

export type PlasiyerSatiri = {
  id: number
  kod: string
  unvan: string
  gsm: string | null
  email: string | null
  aktif: boolean
  cariSayisi: number
}

export function PlasiyerYonetimi({
  plasiyerler,
  duzeltebilir,
}: {
  plasiyerler: PlasiyerSatiri[]
  duzeltebilir: boolean
}) {
  const [durum, setDurum] = useState<TanimFormDurumu>({})
  const [duzenlenen, setDuzenlenen] = useState<PlasiyerSatiri | null>(null)
  const [bekliyor, basla] = useTransition()
  const [islemBekliyor, islemBasla] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function gonder(form: FormData) {
    basla(async () => {
      const sonuc = await plasiyerKaydet({}, form)
      setDurum(sonuc)
      if (sonuc.basarili) {
        toast.success(sonuc.basarili)
        setDuzenlenen(null)
        formRef.current?.reset()
      }
    })
  }

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  function durumDegistir(satir: PlasiyerSatiri) {
    islemBasla(async () => {
      const sonuc = await plasiyerDurumDegistir(satir.id, !satir.aktif)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(satir.aktif ? "Sorumlu personel pasife alındı." : "Sorumlu personel aktifleştirildi.")
    })
  }

  return (
    <div className="[&>*]:min-w-0 grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <form ref={formRef} onSubmit={(olay) => formGonderimi(olay, gonder)} className="panel h-fit p-4">
        <h3 className="mb-3 text-[0.8125rem] font-semibold">
          {duzenlenen ? "Sorumlu Personeli Düzenle" : "Yeni Sorumlu Personel"}
        </h3>

        {duzenlenen ? <input type="hidden" name="id" value={duzenlenen.id} /> : null}

        {durum.hata ? (
          <div className="mb-3 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
            {durum.hata}
          </div>
        ) : null}

        <div key={duzenlenen?.id ?? "yeni"} className="grid gap-3">
          <div className="form-alani">
            <label htmlFor="plasiyer-unvan" className="form-etiket zorunlu-alan">
              Ad Soyad
            </label>
            <input
              id="plasiyer-unvan"
              name="unvan"
              required
              maxLength={200}
              defaultValue={duzenlenen?.unvan ?? ""}
              placeholder="Örn: Ahmet Kaya"
              className={ALAN_SINIFI}
            />
            {hata("unvan") ? (
              <p className="text-[0.75rem] text-tehlike">{hata("unvan")}</p>
            ) : null}
          </div>

          <div className="form-alani">
            <label htmlFor="plasiyer-kod" className="form-etiket">
              Cari Kodu
            </label>
            <input
              id="plasiyer-kod"
              name="kod"
              maxLength={30}
              defaultValue={duzenlenen?.kod ?? ""}
              placeholder="Boş bırakılırsa otomatik"
              className={cn(ALAN_SINIFI, "font-mono")}
            />
            {hata("kod") ? <p className="text-[0.75rem] text-tehlike">{hata("kod")}</p> : null}
          </div>

          <div className="form-alani">
            <label htmlFor="plasiyer-gsm" className="form-etiket">
              GSM
            </label>
            <TelefonGirdi id="plasiyer-gsm" name="gsm" defaultValue={duzenlenen?.gsm} />
          </div>

          <div className="form-alani">
            <label htmlFor="plasiyer-email" className="form-etiket">
              E-posta
            </label>
            <input
              id="plasiyer-email"
              name="email"
              type="email"
              maxLength={200}
              defaultValue={duzenlenen?.email ?? ""}
              className={ALAN_SINIFI}
            />
            {hata("email") ? (
              <p className="text-[0.75rem] text-tehlike">{hata("email")}</p>
            ) : null}
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
              <Button type="button" variant="ghost" size="sm" onClick={() => setDuzenlenen(null)}>
                <X className="size-4" aria-hidden />
                Vazgeç
              </Button>
            ) : null}
          </div>

          <p className="text-[0.6875rem] text-muted-foreground">
            Sorumlu personel, cari tablosunda <strong>personel</strong> türünde bir karttır.
            Bakiye, limit ve adres bilgileri için satırdaki kart bağlantısını kullanın.
          </p>
        </div>
      </form>

      <div className="panel overflow-hidden">
        {plasiyerler.length === 0 ? (
          <div className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
            Henüz sorumlu personel kaydı yok. Soldaki formdan ilk kaydı ekleyin.
          </div>
        ) : (
          <div className="yazdirma-alani overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ad Soyad</th>
                  <th>GSM</th>
                  <th className="text-right">Cari</th>
                  <th>Durum</th>
                  <th className="yazdirma-disi text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {plasiyerler.map((p) => (
                  <tr key={p.id} className={cn(duzenlenen?.id === p.id && "bg-accent/40")}>
                    <td className="font-mono text-[0.75rem]">{p.kod}</td>
                    <td className="font-medium">{p.unvan}</td>
                    <td>{p.gsm ?? "—"}</td>
                    <td className="text-right tabular-nums">
                      {p.cariSayisi > 0 ? (
                        <Link
                          href={`/cari?plasiyer=${p.id}`}
                          className="text-primary hover:underline"
                        >
                          {p.cariSayisi}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <DurumRozeti aktif={p.aktif} />
                    </td>
                    <td className="yazdirma-disi">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Cari kartını aç"
                          aria-label={`${p.unvan} cari kartını aç`}
                        >
                          <Link href={`/cari/${p.id}`}>
                            <ExternalLink className="size-4" aria-hidden />
                          </Link>
                        </Button>
                        {duzeltebilir ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Düzenle"
                              aria-label={`${p.unvan} kaydını düzenle`}
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right text-[0.75rem]">
                    {plasiyerler.length} kayıt
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {plasiyerler.reduce((t, p) => t + p.cariSayisi, 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function DurumRozeti({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium",
        aktif ? "bg-basari-yumusak text-basari" : "bg-uyari-yumusak text-uyari"
      )}
    >
      {aktif ? "Aktif" : "Pasif"}
    </span>
  )
}

export const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"
