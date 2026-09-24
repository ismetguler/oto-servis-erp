import type { Metadata } from "next"
import { Wrench } from "lucide-react"

import {
  yapilanIscilikliklerVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yapılan İşçilikler" }
export const dynamic = "force-dynamic"

/**
 * YAPILAN İŞÇİLİKLER (ADIM 10.2)
 *
 * "Hangi işçilikten kaç kez yapıldı, ne kadar ciro getirdi" sorusu —
 * teslim edilen kartların işçilik kalemleri, işçilik bazında gruplu.
 * Bkz. rapor/veri.ts açıklaması.
 */
export default async function YapilanIscilikler({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await yapilanIscilikliklerVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({
      islemSayisi: t.islemSayisi + s.islemSayisi,
      miktar: t.miktar + s.miktar,
      tutar: t.tutar + s.tutar,
    }),
    { islemSayisi: 0, miktar: 0, tutar: 0 }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Yapılan İşçilikler</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            İşçilik kalemi bazında gruplu döküm (teslim edilen kartlar)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/iscilik/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/iscilik" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Wrench className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta kayıt yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>İşçilik</th>
                  <th className="text-right">İşlem Sayısı</th>
                  <th className="text-right">Miktar</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.anahtar}>
                    <td>{s.ad}</td>
                    <td className="text-right tabular-nums">{s.islemSayisi}</td>
                    <td className="text-right tabular-nums">{miktar(s.miktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td>Dönem toplamı</td>
                  <td className="text-right tabular-nums">{toplam.islemSayisi}</td>
                  <td className="text-right tabular-nums">{miktar(toplam.miktar)}</td>
                  <td className="text-right tabular-nums">{para(toplam.tutar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
