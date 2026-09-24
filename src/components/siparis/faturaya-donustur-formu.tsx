"use client"

import { useActionState, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { miktar as miktarBicim, para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { kalemHesapla } from "@/lib/hesap"
import { metniSayiyaCevir } from "@/lib/sayi"
import { cn } from "@/lib/utils"

/**
 * SİPARİŞTEN FATURAYA DÖNÜŞTÜRME EKRANI (adım 9.7) — alınan/verilen ortak
 *
 * Her satırın kalan bakiyesi ("miktar - sevkMiktar") başlangıç değeri olarak
 * gelir, kullanıcı isterse azaltıp kısmi sevkiyat yapabilir. En az bir satırda
 * miktar > 0 olmalı — bu kural hem burada (gönder düğmesi) hem sunucuda
 * (`siparis/donustur.ts`) kontrol ediliyor.
 */

export type DonusturSatiri = {
  id: number
  aciklama: string
  birim: string
  birimFiyat: number
  kdvOrani: number
  kalan: number
}

type Durum = { hata?: string }

export function FaturayaDonusturFormu({
  siparisId,
  satirlar,
  aksiyon,
  hedefEtiket,
  geriYolu,
}: {
  siparisId: number
  satirlar: DonusturSatiri[]
  aksiyon: (oncekiDurum: Durum, form: FormData) => Promise<Durum>
  hedefEtiket: string
  geriYolu: string
}) {
  const [durum, gonder, bekliyor] = useActionState<Durum, FormData>(aksiyon, {})
  const [miktarlar, setMiktarlar] = useState<Record<number, string>>(() =>
    Object.fromEntries(satirlar.map((s) => [s.id, String(s.kalan)]))
  )

  const sayiya = (d: string) => {
    const n = metniSayiyaCevir(d)
    return Number.isFinite(n) ? n : 0
  }

  let genelToplam = 0
  let secilenSatir = 0
  let asanVar = false
  for (const s of satirlar) {
    const girilen = sayiya(miktarlar[s.id] ?? "0")
    if (girilen > s.kalan + 1e-6) asanVar = true
    const m = Math.min(girilen, s.kalan)
    if (m > 0) {
      secilenSatir += 1
      genelToplam += kalemHesapla({
        miktar: m,
        birimFiyat: s.birimFiyat,
        kdvOrani: s.kdvOrani,
      }).toplam
    }
  }

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col gap-4">
      <input type="hidden" name="siparisId" value={siparisId} />

      {durum.hata ? (
        <div className="rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-card p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <MiniEtiket>{hedefEtiket} No</MiniEtiket>
            <input name="evrakNo" required maxLength={40} className={MINI_ALAN} placeholder="Elle girin" />
          </div>
          <div>
            <MiniEtiket>Tarih</MiniEtiket>
            <input name="tarih" type="date" className={MINI_ALAN} />
          </div>
          <div>
            <MiniEtiket>Vade Tarihi</MiniEtiket>
            <input name="vadeTarihi" type="date" className={MINI_ALAN} />
          </div>
        </div>
        <div className="mt-3">
          <MiniEtiket>Açıklama</MiniEtiket>
          <input name="aciklama" maxLength={500} className={MINI_ALAN} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.75rem] text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">Açıklama</th>
              <th className="px-2 py-1.5 text-right font-medium">Kalan</th>
              <th className="px-2 py-1.5 text-right font-medium">Sevk Edilecek</th>
              <th className="px-2 py-1.5 text-left font-medium">Birim</th>
              <th className="px-2 py-1.5 text-right font-medium">Birim Fiyat</th>
              <th className="px-2 py-1.5 text-right font-medium">Satır Toplamı</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const girilen = sayiya(miktarlar[s.id] ?? "0")
              const asiyor = girilen > s.kalan + 1e-6
              const satirToplami = kalemHesapla({
                miktar: Math.min(girilen, s.kalan),
                birimFiyat: s.birimFiyat,
                kdvOrani: s.kdvOrani,
              }).toplam
              return (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-1.5">{s.aciklama}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {miktarBicim(s.kalan)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      name={`miktar_${s.id}`}
                      value={miktarlar[s.id] ?? ""}
                      onChange={(e) => setMiktarlar((onceki) => ({ ...onceki, [s.id]: e.target.value }))}
                      className={cn(MINI_ALAN, "text-right tabular-nums", asiyor && "border-tehlike")}
                      inputMode="decimal"
                    />
                    {asiyor ? (
                      <p className="mt-1 text-[0.6875rem] text-tehlike">Kalanı aşamaz.</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{s.birim}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{para(s.birimFiyat, false)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                    {para(satirToplami, false)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] text-muted-foreground">
          {secilenSatir} satır seçildi · Tahmini genel toplam{" "}
          <strong className="text-foreground">{para(genelToplam)}</strong>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href={geriYolu}>Vazgeç</a>
          </Button>
          <Button type="submit" size="sm" disabled={bekliyor || secilenSatir === 0 || asanVar}>
            {bekliyor ? <Loader2 className="size-4 animate-spin" /> : null}
            {bekliyor ? "İşleniyor…" : `${hedefEtiket} Oluştur`}
          </Button>
        </div>
      </div>
    </form>
  )
}

const MINI_ALAN =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

function MiniEtiket({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[0.6875rem] font-medium text-muted-foreground">{children}</label>
}
