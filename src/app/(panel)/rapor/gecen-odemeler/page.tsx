import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClock } from "lucide-react"

import { gecenOdemelerVerisi } from "../veri"
import { CARI_TUR_ADLARI } from "../../cari/sema"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Ödemesi Geçenler" }
export const dynamic = "force-dynamic"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

const HAREKET_ADI: Record<string, string> = {
  ACILIS: "Açılış",
  EVRAK: "Fatura",
  KABUL: "Servis",
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
  MAHSUP: "Mahsup",
  CEK_SENET: "Çek/Senet",
}

/**
 * ÖDEMESİ GEÇENLER (ADIM 10.7)
 *
 * Cari Yaşlandırma'nın (10.6) KOMŞUSU, TERSİ DEĞİL — Yaşlandırma kova bazlı
 * TOPLU özet, bu vadesi geçmiş TEKİL kayıtların listesi. Gerekçe ve FIFO
 * mantığı rapor/veri.ts'de. Yaşlandırma'yla aynı desende TEK "Analiz Tarihi"
 * alır, tarih aralığı değil.
 */
export default async function GecenOdemelerRapor({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const asOf = sp.asOf || new Date().toISOString().slice(0, 10)

  const satirlar = await gecenOdemelerVerisi(asOf)
  const toplamTutar = satirlar.reduce((t, s) => t + s.tutar, 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Ödemesi Geçenler</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {tarih(new Date(`${asOf}T00:00:00`))} itibarıyla vadesi geçmiş kayıtlar — {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/gecen-odemeler/disa-aktar?asOf=${asOf}`} />
        </div>
      </div>

      <form
        method="get"
        className="yazdirma-disi flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani">
          <label htmlFor="asOf" className="form-etiket">
            Analiz Tarihi
          </label>
          <input id="asOf" name="asOf" type="date" defaultValue={asOf} className={ALAN} />
        </div>
        <Button type="submit" size="sm" className="h-8">
          Getir
        </Button>
      </form>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <CalendarClock className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu tarihte vadesi geçmiş kayıt yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-28">Kod</th>
                  <th>Ünvan</th>
                  <th className="w-24">Tür</th>
                  <th className="w-28">Kaynak</th>
                  <th>Açıklama</th>
                  <th className="w-24">Vade</th>
                  <th className="w-24 text-right">Gecikme</th>
                  <th className="w-32 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, idx) => (
                  <tr key={`${s.cariId}-${idx}`}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/cari/${s.cariId}/ekstre`} className="text-primary hover:underline">
                        {s.cariKod}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.cariUnvan}</td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu}
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {HAREKET_ADI[s.tur] ?? s.tur}
                    </td>
                    <td className="max-w-[16rem] truncate">{s.aciklama ?? "—"}</td>
                    <td className="whitespace-nowrap">{tarih(s.vadeTarihi)}</td>
                    <td className="text-right tabular-nums text-tehlike">{s.gunGecikme} gün</td>
                    <td className="text-right tabular-nums font-medium">{para(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={7} className="px-3 py-2 text-right">
                    Genel Toplam
                  </td>
                  <td className="px-3 py-2 text-right">{para(toplamTutar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
