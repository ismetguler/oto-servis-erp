import type { Metadata } from "next"
import Link from "next/link"
import { AlarmClockOff } from "lucide-react"

import { cariYaslandirmaVerisi, YASLANDIRMA_KOVA_LISTESI } from "../veri"
import { CARI_TUR_ADLARI } from "../../cari/sema"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Cari Yaşlandırma" }
export const dynamic = "force-dynamic"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

/**
 * CARİ YAŞLANDIRMA (ADIM 10.6)
 *
 * Diğer 10.x raporlarının aksine bir tarih ARALIĞI değil, TEK bir "analiz
 * tarihi" (asOf) alır — yaşlandırma "şu tarih itibarıyla açık borç ne kadar
 * eski" sorusudur, bir başlangıç-bitiş dilimi kavramı yok (bu yüzden ortak
 * `TarihAraligiFiltre` yerine tek alanlı kendi formu var, gerekçesi
 * HAFIZA 69'da). Hesaplama mantığı (FIFO açık borç kuyruğu) rapor/veri.ts'de.
 *
 * `/rapor/gecen-odemeler` ("Ödemesi Geçenler", 10.7) İLE KARIŞTIRILMASIN —
 * o farklı bir tekil-kayıt raporu, bu kova bazlı toplu özet.
 */
export default async function CariYaslandirmaRapor({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const asOf = sp.asOf || new Date().toISOString().slice(0, 10)

  const satirlar = await cariYaslandirmaVerisi(asOf)
  const toplam = satirlar.reduce(
    (t, s) => ({
      vadesiGelmemis: t.vadesiGelmemis + s.vadesiGelmemis,
      g0_30: t.g0_30 + s.g0_30,
      g31_60: t.g31_60 + s.g31_60,
      g61_90: t.g61_90 + s.g61_90,
      g90ustu: t.g90ustu + s.g90ustu,
      toplamBakiye: t.toplamBakiye + s.toplamBakiye,
    }),
    { vadesiGelmemis: 0, g0_30: 0, g31_60: 0, g61_90: 0, g90ustu: 0, toplamBakiye: 0 }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Yaşlandırma</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {tarih(new Date(`${asOf}T00:00:00`))} itibarıyla açık borç — {satirlar.length} cari
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/yaslandirma/disa-aktar?asOf=${asOf}`} />
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
            <AlarmClockOff className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu tarihte açık borçlu cari yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-28">Kod</th>
                  <th>Ünvan</th>
                  <th className="w-24">Tür</th>
                  {YASLANDIRMA_KOVA_LISTESI.map((k) => (
                    <th key={k.anahtar} className="w-28 text-right">
                      {k.etiket}
                    </th>
                  ))}
                  <th className="w-32 text-right">Toplam Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/cari/${s.id}/ekstre`} className="text-primary hover:underline">
                        {s.kod}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.unvan}</td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu}
                    </td>
                    <td className="text-muted-foreground text-right tabular-nums">
                      {s.vadesiGelmemis ? para(s.vadesiGelmemis) : "—"}
                    </td>
                    <td className="text-right tabular-nums">{s.g0_30 ? para(s.g0_30) : "—"}</td>
                    <td className="text-right tabular-nums">{s.g31_60 ? para(s.g31_60) : "—"}</td>
                    <td className="text-right tabular-nums">{s.g61_90 ? para(s.g61_90) : "—"}</td>
                    <td className="text-right tabular-nums text-tehlike">
                      {s.g90ustu ? para(s.g90ustu) : "—"}
                    </td>
                    <td className="text-right tabular-nums font-medium">{para(s.toplamBakiye)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right">
                    Genel Toplam
                  </td>
                  <td className="px-3 py-2 text-right">{para(toplam.vadesiGelmemis)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.g0_30)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.g31_60)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.g61_90)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.g90ustu)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.toplamBakiye)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
