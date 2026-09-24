import type { Metadata } from "next"
import { LineChart } from "lucide-react"

import { raporSorgusu, stokKarZararVerisi, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, yuzde } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Kâr-Zarar" }
export const dynamic = "force-dynamic"

/**
 * STOK KÂR-ZARAR (ADIM 10.11.a) — gerekçe ve iki kaynağın (EvrakKalem +
 * KabulKalem) neden birleştirildiği `veri.ts`teki `stokKarZararVerisi`
 * yorumunda. Stok Son Durum'un (10.10.a) aksine tarih aralığı burada
 * SORGUYU GERÇEKTEN DARALTIR.
 */
export default async function StokKarZararRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const ozet = await stokKarZararVerisi(filtreler)
  const disaAktarYol = `/rapor/stok-kar-zarar/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Kâr-Zarar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Dönemde satılan stoktan elde edilen kâr — {ozet.satirlar.length} ürün
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/stok-kar-zarar" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Satış Tutarı</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums">{para(ozet.toplamSatisTutari)}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Maliyet</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums">{para(ozet.toplamMaliyet)}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Kâr</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums">{para(ozet.toplamKar)}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Kâr Marjı</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums">{yuzde(ozet.toplamKarMarji)}</p>
          </div>
        </div>

        {ozet.grupKirilimi.length > 0 && (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Ürün Grubu</th>
                  <th className="text-right">Satış Tutarı</th>
                  <th className="text-right">Maliyet</th>
                  <th className="text-right">Kâr</th>
                </tr>
              </thead>
              <tbody>
                {ozet.grupKirilimi.map((g) => (
                  <tr key={g.urunGrubu}>
                    <td className="font-medium">{g.urunGrubu}</td>
                    <td className="text-right tabular-nums">{para(g.satisTutari)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{para(g.maliyet)}</td>
                    <td className="text-right tabular-nums">{para(g.kar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ozet.satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <LineChart className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta satılmış stok yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Grup</th>
                  <th className="text-right">Satış Miktarı</th>
                  <th className="text-right">Satış Tutarı</th>
                  <th className="text-right">Maliyet</th>
                  <th className="text-right">Kâr</th>
                  <th className="text-right">Kâr Marjı</th>
                </tr>
              </thead>
              <tbody>
                {ozet.satirlar.map((s) => (
                  <tr key={s.stokId}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">{s.kod}</td>
                    <td className="max-w-[18rem] truncate font-medium">{s.ad}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.urunGrubu}</td>
                    <td className="text-right tabular-nums">{s.satisMiktari.toLocaleString("tr-TR")}</td>
                    <td className="text-right tabular-nums">{para(s.satisTutari)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{para(s.maliyet)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.kar)}</td>
                    <td className="text-right tabular-nums">{yuzde(s.karMarji)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={4} className="text-right">
                    Dönem toplamı
                  </td>
                  <td className="text-right tabular-nums">{para(ozet.toplamSatisTutari)}</td>
                  <td className="text-right tabular-nums">{para(ozet.toplamMaliyet)}</td>
                  <td className="text-right tabular-nums">{para(ozet.toplamKar)}</td>
                  <td className="text-right tabular-nums">{yuzde(ozet.toplamKarMarji)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
