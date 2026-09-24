import type { Metadata } from "next"
import { ClipboardList } from "lucide-react"

import {
  icmalVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Günlük Özet" }
export const dynamic = "force-dynamic"

/**
 * GÜNLÜK İCMAL (ADIM 10.1)
 *
 * Servis Gün Sonu'ndan farkı: tek kart yerine o gün işletmede olan HER
 * ŞEYin özeti — açılan/teslim edilen kart, kesilen fatura, tahsilat/tediye.
 * Selpar dashboard'undaki "Günlük Faaliyet Raporu"nun dökümü.
 */
export default async function GunlukIcmal({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await icmalVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({
      acilanKabul: t.acilanKabul + s.acilanKabul,
      teslimEdilenKabul: t.teslimEdilenKabul + s.teslimEdilenKabul,
      kesilenFatura: t.kesilenFatura + s.kesilenFatura,
      faturaToplam: t.faturaToplam + s.faturaToplam,
      tahsilat: t.tahsilat + s.tahsilat,
      tediye: t.tediye + s.tediye,
    }),
    {
      acilanKabul: 0,
      teslimEdilenKabul: 0,
      kesilenFatura: 0,
      faturaToplam: 0,
      tahsilat: 0,
      tediye: 0,
    }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Günlük Özet</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Gün bazında kart, fatura ve tahsilat/tediye özeti — muhasebedeki
            adıyla &ldquo;günlük icmal&rdquo;
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/icmal/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/icmal" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ClipboardList className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta kayıt yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th className="text-right">Açılan Kart</th>
                  <th className="text-right">Teslim Edilen</th>
                  <th className="text-right">Kesilen Fatura</th>
                  <th className="text-right">Fatura Tutarı</th>
                  <th className="text-right">Tahsilat</th>
                  <th className="text-right">Tediye</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.gun.toISOString()}>
                    <td className="whitespace-nowrap">{tarih(s.gun)}</td>
                    <td className="text-right tabular-nums">{s.acilanKabul}</td>
                    <td className="text-right tabular-nums">{s.teslimEdilenKabul}</td>
                    <td className="text-right tabular-nums">{s.kesilenFatura}</td>
                    <td className="text-right tabular-nums">{para(s.faturaToplam)}</td>
                    <td className="text-right tabular-nums">{para(s.tahsilat)}</td>
                    <td className="text-right tabular-nums">{para(s.tediye)}</td>
                    <td className="text-right tabular-nums font-medium">
                      {para(s.tahsilat - s.tediye)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td>Dönem toplamı</td>
                  <td className="text-right tabular-nums">{toplam.acilanKabul}</td>
                  <td className="text-right tabular-nums">{toplam.teslimEdilenKabul}</td>
                  <td className="text-right tabular-nums">{toplam.kesilenFatura}</td>
                  <td className="text-right tabular-nums">{para(toplam.faturaToplam)}</td>
                  <td className="text-right tabular-nums">{para(toplam.tahsilat)}</td>
                  <td className="text-right tabular-nums">{para(toplam.tediye)}</td>
                  <td className="text-right tabular-nums">
                    {para(toplam.tahsilat - toplam.tediye)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
