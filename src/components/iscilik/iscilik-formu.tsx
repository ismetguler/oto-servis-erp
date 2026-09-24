"use client"

import { useActionState, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Save, X } from "lucide-react"

import { iscilikKaydet, type IscilikFormDurumu } from "@/app/(panel)/iscilik/actions"
import { Button } from "@/components/ui/button"
import { TanimEkleTusu } from "@/components/ui/tanim-ekle-tusu"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { useTanimDonusu } from "@/lib/kullan-tanim-donusu"
import { metniSayiyaCevir } from "@/lib/sayi"
import { cn } from "@/lib/utils"

/**
 * İŞÇİLİK KATALOĞU FORMU
 *
 * Araç/Cari formlarıyla aynı desen: düz `<input>`/`<select>`, FormData
 * doğrudan server action'a gider. Tek fark, sağdaki canlı önizleme:
 * Selpar'da işçilik satırı kabul kartına eklendiğinde tutar+KDV hesabı
 * yapılıyor; ustanın burada girdiği fiyatın karşılığını görmesi
 * "yanlış fiyat girildi" hatasını daha ekranda yakalatıyor.
 */

export type IscilikBaslangic = {
  id: number
  kod: string
  ad: string
  bolumId: number | null
  sure: string
  fiyat: string
  kdvOrani: string
  aciklama: string | null
  aktif: boolean
}

export type Bolum = { id: number; ad: string }

/** "1.250,50" ve "1250.50" yazımlarının ikisini de sayıya çevirir. */
function sayiya(deger: string): number {
  const sonuc = metniSayiyaCevir(deger)
  return Number.isFinite(sonuc) ? sonuc : 0
}

export function IscilikFormu({
  baslangic,
  bolumler,
}: {
  baslangic?: IscilikBaslangic
  bolumler: Bolum[]
}) {
  const [durum, gonder, bekliyor] = useActionState<IscilikFormDurumu, FormData>(
    iscilikKaydet,
    {}
  )

  const [sure, setSure] = useState(baslangic?.sure ?? "1")
  const [fiyat, setFiyat] = useState(baslangic?.fiyat ?? "0")
  const [kdv, setKdv] = useState(baslangic?.kdvOrani ?? "20")

  // "+ Yeni" ile İşçilik Bölümü eklenip dönüldüğünde bölüm listesi taze
  // geldiği için adından id'sini bulup seçili yapıyoruz (Secim id ile çalışıyor).
  const bolumDonusAdi = useTanimDonusu("bolumId")
  const [bolumId, setBolumId] = useState(
    bolumDonusAdi != null
      ? (bolumler.find((b) => b.ad === bolumDonusAdi)?.id ?? "")
      : (baslangic?.bolumId ?? "")
  )

  const onizleme = useMemo(() => {
    const s = sayiya(sure)
    const f = sayiya(fiyat)
    const o = sayiya(kdv)
    const matrah = s * f
    const kdvTutari = (matrah * o) / 100
    return { matrah, kdvTutari, genel: matrah + kdvTutari }
  }, [sure, fiyat, kdv])

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Alan
              ad="kod"
              etiket="İşçilik Kodu"
              hata={hata("kod")}
              ipucu={baslangic ? undefined : "Boş bırakılırsa otomatik üretilir (IS00001)."}
            >
              <Girdi
                name="kod"
                defaultValue={baslangic?.kod}
                maxLength={30}
                placeholder="otomatik"
                className="font-mono"
              />
            </Alan>

            <Alan
              ad="bolumId"
              etiket="İşçilik Bölümü"
              hata={hata("bolumId")}
              yanTus={
                <TanimEkleTusu
                  hedefYol="/iscilik/bolum"
                  alan="bolumId"
                  baslik="İşçilik Bölümü"
                />
              }
            >
              <Secim
                name="bolumId"
                value={bolumId}
                onChange={(e) => setBolumId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">— Bölümsüz —</option>
                {bolumler.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.ad}
                  </option>
                ))}
              </Secim>
            </Alan>

            <Alan ad="ad" etiket="İşçilik Adı" zorunlu hata={hata("ad")} genis>
              <Girdi
                name="ad"
                defaultValue={baslangic?.ad}
                maxLength={200}
                required
                placeholder="Örn: Motor yağı ve filtre değişimi"
              />
            </Alan>

            <Alan ad="sure" etiket="Süre (saat)" hata={hata("sure")}>
              <Girdi
                name="sure"
                value={sure}
                onChange={(e) => setSure(e.target.value)}
                inputMode="decimal"
                className="text-right"
              />
            </Alan>

            <Alan ad="fiyat" etiket="Birim Fiyat (₺)" hata={hata("fiyat")}>
              <Girdi
                name="fiyat"
                value={fiyat}
                onChange={(e) => setFiyat(e.target.value)}
                inputMode="decimal"
                className="text-right"
              />
            </Alan>

            <Alan ad="kdvOrani" etiket="KDV Oranı (%)" hata={hata("kdvOrani")}>
              <Girdi
                name="kdvOrani"
                value={kdv}
                onChange={(e) => setKdv(e.target.value)}
                inputMode="decimal"
                className="text-right"
              />
            </Alan>

            <Alan ad="aktif" etiket="Durum">
              <Onay
                name="aktif"
                etiket="Aktif — kabul kartında listelensin"
                defaultChecked={baslangic?.aktif ?? true}
              />
            </Alan>

            <Alan ad="aciklama" etiket="Açıklama" hata={hata("aciklama")} genis>
              <Metin
                name="aciklama"
                defaultValue={baslangic?.aciklama ?? ""}
                rows={3}
                maxLength={1000}
                placeholder="İşin kapsamı, dikkat edilecekler…"
              />
            </Alan>
          </div>
        </div>

        <aside className="panel h-fit p-4">
          <h2 className="mb-3 text-[0.8125rem] font-semibold">Satır Önizlemesi</h2>
          <p className="mb-3 text-[0.75rem] text-muted-foreground">
            Bu işçilik kabul kartına eklendiğinde oluşacak tutar.
          </p>
          <dl className="space-y-1.5 text-[0.8125rem]">
            <Satir etiket="Matrah" deger={para(onizleme.matrah)} />
            <Satir etiket={`KDV (%${sayiya(kdv)})`} deger={para(onizleme.kdvTutari)} />
            <div className="border-t border-border pt-1.5">
              <Satir etiket="Genel Toplam" deger={para(onizleme.genel)} kalin />
            </div>
          </dl>
        </aside>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/iscilik">
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

function Satir({
  etiket,
  deger,
  kalin,
}: {
  etiket: string
  deger: string
  kalin?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{etiket}</dt>
      <dd className={cn("tabular-nums", kalin && "font-semibold")}>{deger}</dd>
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
  yanTus,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  /** Etiketin sağında duran küçük eylem (ör. "+ Yeni"). */
  yanTus?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
          {etiket}
        </label>
        {yanTus}
      </div>
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

function Girdi({
  name,
  className,
  ...kalan
}: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

function Secim({
  name,
  className,
  ...kalan
}: React.ComponentProps<"select"> & { name: string }) {
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

function Onay({
  name,
  etiket,
  defaultChecked,
}: {
  name: string
  etiket: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex h-8 items-center gap-2 text-[0.8125rem]">
      <input
        id={name}
        name={name}
        type="checkbox"
        className="size-4 accent-primary"
        defaultChecked={defaultChecked}
      />
      {etiket}
    </label>
  )
}
