import type { Metadata } from "next"
import Link from "next/link"
import { Truck } from "lucide-react"

import {
  disHizmetVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Dış Hizmet" }
export const dynamic = "force-dynamic"

/**
 * DIŞ HİZMET (ADIM 10.5)
 *
 * `KabulKalem` tur=DIS_HIZMET satırlarının kart bazında, GRUPLANMADAN
 * dökümü — "hangi iş için dış hizmete gidildi, ne kadar, hangi kartta"
 * sorusu. Gruplanmama gerekçesi rapor/veri.ts'de.
 */
export default async function DisHizmet({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await disHizmetVerisi(filtreler)
  const genelToplam = satirlar.reduce((t, s) => t + s.tutar, 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Dış Hizmet</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Teslim edilen kartlardaki dış hizmet kalemleri — {satirlar.length} kalem
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/dis-hizmet/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/dis-hizmet" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Truck className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta dış hizmet kalemi yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kabul No</th>
                  <th>Teslim</th>
                  <th>Plaka</th>
                  <th>Müşteri</th>
                  <th>Açıklama</th>
                  <th className="text-right">Miktar</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.kalemId}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link
                        href={`/servis/kabul/${s.kabulId}`}
                        className="text-primary hover:underline"
                      >
                        {s.kabulNo}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{tarih(s.teslimTarihi)}</td>
                    <td className="font-medium whitespace-nowrap">{plakaBicim(s.plaka)}</td>
                    <td className="max-w-[14rem] truncate">{s.musteri}</td>
                    <td className="max-w-[20rem] truncate">{s.aciklama}</td>
                    <td className="text-right tabular-nums">{miktar(s.miktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={6} className="text-right">
                    Genel toplam
                  </td>
                  <td className="text-right tabular-nums">{para(genelToplam)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
