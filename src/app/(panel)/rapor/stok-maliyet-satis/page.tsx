import type { Metadata } from "next"
import Link from "next/link"
import { Percent } from "lucide-react"

import { maliyetSatisVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, yuzde } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Maliyet ve Satış" }
export const dynamic = "force-dynamic"

/**
 * STOK MALİYET & SATIŞ (ADIM 10.11.c) — Kâr-Zarar'dan (10.11.a, GERÇEKLEŞEN
 * satış) farkı ve tarih aralığının burada neden sorguyu daraltmadığı
 * `veri.ts`teki `maliyetSatisVerisi` yorumunda (ANLIK/POTANSİYEL fiyatlama).
 */
export default async function MaliyetSatisRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await maliyetSatisVerisi(filtreler)
  const toplamMaliyet = satirlar.reduce((t, s) => t + s.ortalamaMaliyet, 0)
  const toplamSatisFiyat = satirlar.reduce((t, s) => t + s.satisFiyat, 0)
  const toplamFark = toplamSatisFiyat - toplamMaliyet
  const ortalamaMarj = toplamSatisFiyat > 0 ? (toplamFark / toplamSatisFiyat) * 100 : 0

  const disaAktarYol = `/rapor/stok-maliyet-satis/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Maliyet ve Satış</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Güncel maliyet vs satış fiyatı karşılaştırması — {satirlar.length} kart
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/stok-maliyet-satis" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Percent className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Aktif stok kartı yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Grup</th>
                  <th className="text-right">Ort. Maliyet</th>
                  <th className="text-right">Satış Fiyatı</th>
                  <th className="text-right">Fark</th>
                  <th className="text-right">Marj</th>
                  <th className="w-32">Aralıkta Güncellendi</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/stok/${s.id}`} className="text-primary hover:underline">
                        {s.kod}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.ad}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.urunGrubu}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{para(s.ortalamaMaliyet)}</td>
                    <td className="text-right tabular-nums">{para(s.satisFiyat)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.fark)}</td>
                    <td className="text-right tabular-nums">{yuzde(s.marj)}</td>
                    <td className="text-muted-foreground">{s.araliktaGuncellendi ? "Evet" : "Hayır"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={3} className="text-right">
                    Toplam / Ortalama
                  </td>
                  <td className="text-right tabular-nums">{para(toplamMaliyet)}</td>
                  <td className="text-right tabular-nums">{para(toplamSatisFiyat)}</td>
                  <td colSpan={2}></td>
                  <td className="text-right tabular-nums">{para(toplamFark)}</td>
                  <td className="text-right tabular-nums">{yuzde(ortalamaMarj)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
