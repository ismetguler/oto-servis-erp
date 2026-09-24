import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftRight } from "lucide-react"

import { cariAlisSatisVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Cari Alış-Satış" }
export const dynamic = "force-dynamic"

/**
 * CARİ ALIŞ-SATIŞ (ADIM 10.8.b)
 *
 * Hesap Toplamları'ndan (10.6, CariHareket tabanlı) farkı `veri.ts`teki
 * `cariAlisSatisVerisi` yorumunda — burada sadece fatura (Evrak), tahsilat/
 * ödeme/servis kartı karışmıyor.
 */
export default async function CariAlisSatisRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await cariAlisSatisVerisi(filtreler)
  const toplamAlis = satirlar.reduce((t, s) => t + s.alisToplam, 0)
  const toplamSatis = satirlar.reduce((t, s) => t + s.satisToplam, 0)

  const disaAktarYol = `/rapor/cari-alis-satis/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Alış-Satış</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Tarih aralığındaki fatura bazlı alış-satış toplamı — {satirlar.length} cari
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/cari-alis-satis" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ArrowLeftRight className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta fatura yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-28">Kod</th>
                  <th>Ünvan</th>
                  <th className="w-32">VKN</th>
                  <th className="w-20 text-right">Alış F.</th>
                  <th className="w-32 text-right">Alış Toplam</th>
                  <th className="w-20 text-right">Satış F.</th>
                  <th className="w-32 text-right">Satış Toplam</th>
                  <th className="w-32 text-right">Fark (Satış−Alış)</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/cari/${s.id}`} className="text-primary hover:underline">
                        {s.kod}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.unvan}</td>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">{s.vkn ?? "—"}</td>
                    <td className="text-right tabular-nums">{s.alisFaturaSayisi || "—"}</td>
                    <td className="text-right tabular-nums">{s.alisToplam ? para(s.alisToplam) : "—"}</td>
                    <td className="text-right tabular-nums">{s.satisFaturaSayisi || "—"}</td>
                    <td className="text-right tabular-nums">{s.satisToplam ? para(s.satisToplam) : "—"}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.fark)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Dönem Toplamı
                  </td>
                  <td className="px-3 py-2 text-right">{para(toplamAlis)}</td>
                  <td></td>
                  <td className="px-3 py-2 text-right">{para(toplamSatis)}</td>
                  <td className="px-3 py-2 text-right">{para(toplamSatis - toplamAlis)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
