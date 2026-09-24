import type { Metadata } from "next"
import { TrendingUp } from "lucide-react"

import {
  aylikBorcTahsilatVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, yuzde } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Aylık Borç Tahsilat" }
export const dynamic = "force-dynamic"

/**
 * AYLIK BORÇ TAHSİLAT (ADIM 10.7)
 *
 * Cari Hesap Toplamları'nın (10.6, cari bazlı) AY bazında büyütülmüş hali —
 * cari değil İŞLETME GENELİNDE "hangi ay ne kadar borç doğdu, ne kadarı
 * tahsil edildi" sorusu. Gerekçe rapor/veri.ts'de.
 */
export default async function AylikBorcTahsilatRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await aylikBorcTahsilatVerisi(filtreler)
  const toplam = satirlar.reduce(
    (t, s) => ({ borcDogan: t.borcDogan + s.borcDogan, tahsilat: t.tahsilat + s.tahsilat }),
    { borcDogan: 0, tahsilat: 0 }
  )
  const toplamOran = toplam.borcDogan > 0 ? (toplam.tahsilat / toplam.borcDogan) * 100 : 0

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Aylık Borç Tahsilat</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            İşletme genelinde ay bazında doğan borç / tahsilat — {satirlar.length} ay
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/rapor/aylik-borc-tahsilat/disa-aktar${raporSorgusu(filtreler)}`}
          />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre
          yol="/rapor/aylik-borc-tahsilat"
          bas={filtreler.bas}
          bit={filtreler.bit}
        />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <TrendingUp className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta ay bulunamadı</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Ay</th>
                  <th className="w-36 text-right">Doğan Borç</th>
                  <th className="w-36 text-right">Tahsilat</th>
                  <th className="w-28 text-right">Tahsilat Oranı</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.ay}>
                    <td className="font-medium">{s.ayEtiketi}</td>
                    <td className="text-right tabular-nums">
                      {s.borcDogan ? para(s.borcDogan) : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {s.tahsilat ? para(s.tahsilat) : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {s.borcDogan ? yuzde(s.tahsilatOrani) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td className="px-3 py-2 text-right">Genel Toplam</td>
                  <td className="px-3 py-2 text-right">{para(toplam.borcDogan)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.tahsilat)}</td>
                  <td className="px-3 py-2 text-right">
                    {toplam.borcDogan ? yuzde(toplamOran) : "—"}
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
