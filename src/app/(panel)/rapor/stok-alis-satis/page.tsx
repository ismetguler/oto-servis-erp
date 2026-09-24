import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftRight } from "lucide-react"

import { raporSorgusu, stokAlisSatisVerisi, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Alış-Satış" }
export const dynamic = "force-dynamic"

const YON_ETIKETI: Record<string, string> = {
  ALIS: "Alış",
  SATIS: "Satış",
  IADE_ALIS: "İade (Alış)",
  IADE_SATIS: "İade (Satış)",
}

/**
 * STOK DETAYLI ALIŞ-SATIŞ (ADIM 10.11.b) — Cari Alış-Satış'la (10.8)
 * KARIŞTIRILMASIN, ekseni farklı; gerekçe `veri.ts`teki `stokAlisSatisVerisi`
 * yorumunda.
 */
export default async function StokAlisSatisRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri & { urun?: string }>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }
  const urunAra = sp.urun ?? ""

  const satirlar = await stokAlisSatisVerisi(filtreler, urunAra)
  const toplamTutar = satirlar.reduce((t, s) => t + s.tutar, 0)

  const disaAktarParam = new URLSearchParams(raporSorgusu(filtreler).replace(/^\?/, ""))
  if (urunAra) disaAktarParam.set("urun", urunAra)
  const disaAktarYol = `/rapor/stok-alis-satis/disa-aktar?${disaAktarParam.toString()}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Alış-Satış</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Stok bazında zaman içindeki alış/satış hareketleri — {satirlar.length} satır
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre
          yol="/rapor/stok-alis-satis"
          bas={filtreler.bas}
          bit={filtreler.bit}
          ekAlan={
            <div className="form-alani">
              <label htmlFor="urun" className="form-etiket">
                Ürün (kod/ad)
              </label>
              <input
                id="urun"
                name="urun"
                type="text"
                defaultValue={urunAra}
                placeholder="Tümü"
                className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              />
            </div>
          }
        />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ArrowLeftRight className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta hareket yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Yön</th>
                  <th>Kaynak</th>
                  <th>Belge No</th>
                  <th className="text-right">Miktar</th>
                  <th className="text-right">Birim Fiyat</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">{tarih(s.tarih)}</td>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      {s.stokId ? (
                        <Link href={`/stok/${s.stokId}`} className="text-primary hover:underline">
                          {s.kod}
                        </Link>
                      ) : (
                        s.kod
                      )}
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.ad}</td>
                    <td className="whitespace-nowrap">{YON_ETIKETI[s.yon]}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.kaynak}</td>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">{s.belgeNo}</td>
                    <td className="text-right tabular-nums">{s.miktar.toLocaleString("tr-TR")}</td>
                    <td className="text-right tabular-nums">{para(s.birimFiyat)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={8} className="text-right">
                    Toplam
                  </td>
                  <td className="text-right tabular-nums">{para(toplamTutar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
