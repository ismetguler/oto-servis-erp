import type { Metadata } from "next"
import Link from "next/link"
import { TrendingUp } from "lucide-react"

import { enCokKullanilanVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "En Çok Kullanılan Parça" }
export const dynamic = "force-dynamic"

/**
 * EN ÇOK KULLANILAN PARÇA (ADIM 10.13.b) — gerekçe `veri.ts`teki
 * `enCokKullanilanVerisi` yorumunda. `StokHareket` tur=CIKIS (yalnız GERÇEK
 * tüketim — depo transferi hariç) tabanlı, tarih aralığı Giriş-Çıkış
 * Analizi'yle (10.12) aynı mantıkla SORGUYU GERÇEKTEN DARALTIR.
 */
export default async function EnCokKullanilanRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const ozet = await enCokKullanilanVerisi(filtreler)
  const disaAktarYol = `/rapor/en-cok-kullanilan/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">En Çok Kullanılan Parça</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Dönemde en çok çıkışı yapılan parçalar — {ozet.miktaraGoreSirali.length} kalem, toplam{" "}
            {para(ozet.toplamTutar)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/en-cok-kullanilan" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Toplam Çıkış Miktarı</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums">{miktar(ozet.toplamMiktar)}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Toplam Çıkış Tutarı</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums">{para(ozet.toplamTutar)}</p>
          </div>
        </div>

        {ozet.grupKirilimi.length > 0 && (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Ürün Grubu</th>
                  <th className="text-right">Çıkış Miktar</th>
                  <th className="text-right">Çıkış Tutar</th>
                </tr>
              </thead>
              <tbody>
                {ozet.grupKirilimi.map((g) => (
                  <tr key={g.urunGrubu}>
                    <td className="font-medium">{g.urunGrubu}</td>
                    <td className="text-right tabular-nums">{miktar(g.cikisMiktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(g.cikisTutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ozet.miktaraGoreSirali.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <TrendingUp className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta gerçek tüketim çıkışı yok</p>
          </div>
        ) : (
          <div className="[&>*]:min-w-0 grid gap-4 lg:grid-cols-2">
            <div className="panel overflow-auto">
              <p className="px-3 pt-3 text-[0.8125rem] font-medium text-muted-foreground">En Çok Adet Giden</p>
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Ürün Adı</th>
                    <th className="text-right">Miktar</th>
                    <th className="text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {ozet.miktaraGoreSirali.slice(0, 50).map((s) => (
                    <tr key={s.stokId}>
                      <td className="font-mono text-[0.75rem] whitespace-nowrap">
                        <Link href={`/stok/${s.stokId}`} className="text-primary hover:underline">
                          {s.kod}
                        </Link>
                      </td>
                      <td className="max-w-[14rem] truncate font-medium">{s.ad}</td>
                      <td className="text-right tabular-nums">{miktar(s.cikisMiktar)}</td>
                      <td className="text-right tabular-nums">{para(s.cikisTutar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel overflow-auto">
              <p className="px-3 pt-3 text-[0.8125rem] font-medium text-muted-foreground">En Çok Ciro Getiren</p>
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Ürün Adı</th>
                    <th className="text-right">Tutar</th>
                    <th className="text-right">Miktar</th>
                  </tr>
                </thead>
                <tbody>
                  {ozet.tutaraGoreSirali.slice(0, 50).map((s) => (
                    <tr key={s.stokId}>
                      <td className="font-mono text-[0.75rem] whitespace-nowrap">
                        <Link href={`/stok/${s.stokId}`} className="text-primary hover:underline">
                          {s.kod}
                        </Link>
                      </td>
                      <td className="max-w-[14rem] truncate font-medium">{s.ad}</td>
                      <td className="text-right tabular-nums font-medium">{para(s.cikisTutar)}</td>
                      <td className="text-right tabular-nums">{miktar(s.cikisMiktar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
