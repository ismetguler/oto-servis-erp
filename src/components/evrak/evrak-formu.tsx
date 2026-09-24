"use client"

import { useActionState, useState } from "react"
import { AlertTriangle, Loader2, Save, X } from "lucide-react"
import Link from "next/link"

import { evrakKaydet, type EvrakFormDurumu } from "@/app/(panel)/evrak/satis/actions"
import type { SatisCarisi } from "@/app/(panel)/evrak/satis/veri"
import { AramaliSecim } from "@/components/aramali-secim"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * SATIŞ FATURASI KARTI — üst bilgi formu.
 *
 * Kalemler bu ekranda YOK: kabul kartındaki desenin aynısı — önce kart
 * (TASLAK) kaydedilir, kalemler ayrı ekranda (`/evrak/satis/[id]`) eklenir.
 * Fatura no ELLE girilir (e-Fatura/e-Arşiv entegrasyonu kapsam dışı).
 *
 * `kabul` verilirse ekran "kabulden dönüştürme" kipindedir (adım 9.2):
 * cari DEĞİŞTİRİLEMEZ (fatura kartın carisine kesilir) ve kaydetme anında
 * kabul satırları faturaya kopyalanır — kalem ızgarasına elle girmeye gerek
 * kalmaz. Cari kutusu `disabled` değil `readOnly` görünümlü bir metin +
 * gizli alan: disabled select form verisine HİÇ girmez, cariId boş giderdi.
 */
export function EvrakFormu({
  baslangic,
  cariler,
  kabul,
  iade,
}: {
  baslangic?: {
    id: number
    evrakNo: string
    cariId: number
    tarih: string
    vadeTarihi: string
    aciklama: string
    kaynakEvrakNo?: string
    irsaliyeNo?: string
    irsaliyeTarihi?: string
    tasiyiciPlaka?: string
    sevkAdresi?: string
    tevkifatKodu?: string
    tevkifatOrani?: string
  }
  cariler: SatisCarisi[]
  /** Düzenlenen kayıt zaten İade Faturası ise (adım 11.8) — tür değiştirilemez, sadece bilgi. */
  iade?: boolean
  kabul?: {
    id: number
    kabulNo: string
    cariId: number
    cariUnvan: string
    satirSayisi: number
    genelToplam: number
    /** Dönüştürme engellenmişse (kart açık, satırsız veya zaten faturalanmış). */
    kilitli: boolean
  }
}) {
  const [durum, gonder, bekliyor] = useActionState<EvrakFormDurumu, FormData>(evrakKaydet, {})
  const hata = (alan: string) => durum.alanHatalari?.[alan]
  const bugun = new Date().toISOString().slice(0, 10)

  // Kara liste uyarı bandı (SA-2 / 2.5) için seçili cariyi izle. Kabulden
  // dönüştürmede cari sabit — kabulün carisini kullan.
  const [seciliCariId, setSeciliCariId] = useState<number | "">(
    kabul?.cariId ?? baslangic?.cariId ?? ""
  )
  const seciliCari = cariler.find((c) => c.id === Number(seciliCariId)) ?? null

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col gap-4">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}
      {kabul ? <input type="hidden" name="kabulId" value={kabul.id} /> : null}

      {kabul ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[0.8125rem] text-muted-foreground">
          <strong className="text-foreground">{kabul.kabulNo}</strong> kartının{" "}
          {kabul.satirSayisi} satırı bu faturaya kopyalanacak (kart toplamı{" "}
          {kabul.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺).
          Kesinleştirmede stok yeniden düşülmez; cari borcu kabulden faturaya devredilir.
        </div>
      ) : null}

      {durum.hata ? (
        <div className="rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      {seciliCari?.karaListe ? (
        <div className="rounded-md border border-tehlike/40 bg-tehlike-yumusak px-3 py-2.5 text-[0.8125rem] text-tehlike">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            ⚠ Bu cari kara listede — {seciliCari.unvan}
          </div>
          {seciliCari.karaListeNedeni ? (
            <p className="mt-1 whitespace-pre-wrap">Sebep: {seciliCari.karaListeNedeni}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Alan ad="evrakNo" etiket="Fatura No" zorunlu hata={hata("evrakNo")} ipucu="Elle girilir">
          <Girdi name="evrakNo" defaultValue={baslangic?.evrakNo ?? ""} placeholder="örn. SF2026-00001" />
        </Alan>

        <Alan
          ad="cariId"
          etiket="Müşteri (cari)"
          zorunlu
          hata={hata("cariId")}
          ipucu={kabul ? "Kabul kartından geliyor, değiştirilemez" : undefined}
        >
          {kabul ? (
            <>
              <input type="hidden" name="cariId" value={kabul.cariId} />
              <div className="flex h-8 w-full items-center rounded-sm border border-input bg-muted/50 px-2 text-[0.8125rem]">
                {kabul.cariUnvan}
              </div>
            </>
          ) : (
<AramaliSecim
              name="cariId"
              value={seciliCariId === "" ? "" : String(seciliCariId)}
              onChange={(d) => setSeciliCariId(d === "" ? "" : Number(d))}
              placeholder="Müşteri ara — ünvan veya kod…"
              secenekler={cariler.map((c) => ({ value: String(c.id), etiket: c.unvan, aciklama: c.kod }))}
            />
          )}
        </Alan>

        <Alan ad="tarih" etiket="Tarih">
          <Girdi name="tarih" type="date" defaultValue={baslangic?.tarih ?? bugun} />
        </Alan>

        <Alan ad="vadeTarihi" etiket="Vade Tarihi" hata={hata("vadeTarihi")}>
          <Girdi name="vadeTarihi" type="date" defaultValue={baslangic?.vadeTarihi ?? ""} />
        </Alan>

        <Alan ad="aciklama" etiket="Açıklama" genis>
          <Girdi
            name="aciklama"
            defaultValue={baslangic?.aciklama ?? (kabul ? `Servis kabul ${kabul.kabulNo}` : "")}
          />
        </Alan>
      </div>

      {/* Adım 11.8: baskı şablonlarını besleyen elle-girilen alanlar — kart
          üstünde toplanmış, gerçek dış entegrasyon (e-İrsaliye/tevkifat
          kodu listesi) yok, hepsi serbest metin/sayı. */}
      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-[0.75rem] font-medium text-muted-foreground">
          İrsaliye / Tevkifat / İade Bilgileri (opsiyonel)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!baslangic ? (
            <Alan ad="iade" etiket="Fatura Türü" ipucu="İşaretlenirse İade Faturası olarak kaydedilir">
              <label className="flex h-8 items-center gap-2 text-[0.8125rem]">
                <input type="checkbox" name="iade" className="size-4" />
                Bu bir İade Faturası
              </label>
            </Alan>
          ) : iade ? (
            <Alan ad="iadeBilgi" etiket="Fatura Türü">
              <div className="flex h-8 items-center text-[0.8125rem] font-medium text-tehlike">
                İade Faturası
              </div>
            </Alan>
          ) : null}

          <Alan ad="kaynakEvrakNo" etiket="Kaynak Evrak No" ipucu="İade ise hangi faturaya istinaden">
            <Girdi name="kaynakEvrakNo" defaultValue={baslangic?.kaynakEvrakNo ?? ""} />
          </Alan>

          <Alan ad="irsaliyeNo" etiket="İrsaliye No">
            <Girdi name="irsaliyeNo" defaultValue={baslangic?.irsaliyeNo ?? ""} />
          </Alan>

          <Alan ad="irsaliyeTarihi" etiket="İrsaliye Tarihi" hata={hata("irsaliyeTarihi")}>
            <Girdi name="irsaliyeTarihi" type="date" defaultValue={baslangic?.irsaliyeTarihi ?? ""} />
          </Alan>

          <Alan ad="tasiyiciPlaka" etiket="Taşıyıcı / Araç Plakası">
            <Girdi name="tasiyiciPlaka" defaultValue={baslangic?.tasiyiciPlaka ?? ""} />
          </Alan>

          <Alan ad="sevkAdresi" etiket="Sevk Adresi" genis>
            <Girdi name="sevkAdresi" defaultValue={baslangic?.sevkAdresi ?? ""} />
          </Alan>

          <Alan ad="tevkifatKodu" etiket="Tevkifat Kodu">
            <Girdi name="tevkifatKodu" defaultValue={baslangic?.tevkifatKodu ?? ""} placeholder="örn. 601" />
          </Alan>

          <Alan ad="tevkifatOrani" etiket="Tevkifat Oranı (%)" hata={hata("tevkifatOrani")}>
            <Girdi name="tevkifatOrani" defaultValue={baslangic?.tevkifatOrani ?? ""} inputMode="decimal" />
          </Alan>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href={kabul ? `/servis/kabul/${kabul.id}` : "/evrak/satis"}>
            <X className="size-4" />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor || kabul?.kilitli}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  ipucu,
  genis,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-2")}>
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
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

function Girdi({ name, className, ...kalan }: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

