import type { Metadata } from "next"
import { CarFront } from "lucide-react"

import {
  aracAnalizVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Servis Araç Analiz" }
export const dynamic = "force-dynamic"

/**
 * SERVİS ARAÇ ANALİZ (ADIM 10.4)
 *
 * Araç Genel'in (10.3, tekil araç) tersine burada araçlar MARKA bazında
 * gruplanıyor — hesap yöntemi rapor/veri.ts'de açıklanıyor.
 */
export default async function AracAnaliz({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await aracAnalizVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({ kartSayisi: t.kartSayisi + s.kartSayisi, genelToplam: t.genelToplam + s.genelToplam }),
    { kartSayisi: 0, genelToplam: 0 }
  )
  const ortalamaKartTutari = toplam.kartSayisi > 0 ? toplam.genelToplam / toplam.kartSayisi : 0

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Servis Araç Analiz</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Marka bazında kart sayısı ve ciro — {satirlar.length} marka
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/arac-analiz/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/arac-analiz" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <CarFront className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta teslimat yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Marka</th>
                  <th className="text-right">Kart Sayısı</th>
                  <th className="text-right">Genel Toplam</th>
                  <th className="text-right">Ort. Kart Tutarı</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.marka}>
                    <td className="font-medium whitespace-nowrap">{s.marka}</td>
                    <td className="text-right tabular-nums">{s.kartSayisi}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.genelToplam)}</td>
                    <td className="text-right tabular-nums">{para(s.ortalamaKartTutari)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td className="text-right">Dönem toplamı</td>
                  <td className="text-right tabular-nums">{toplam.kartSayisi}</td>
                  <td className="text-right tabular-nums">{para(toplam.genelToplam)}</td>
                  <td className="text-right tabular-nums">{para(ortalamaKartTutari)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
