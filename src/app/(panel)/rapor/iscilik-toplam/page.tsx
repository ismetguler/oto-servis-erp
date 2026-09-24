import type { Metadata } from "next"
import { Clock } from "lucide-react"

import {
  iscilikToplamlariVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "İşçilik Toplamları" }
export const dynamic = "force-dynamic"

/**
 * İŞÇİLİK TOPLAMLARI (ADIM 10.2)
 *
 * İşçilik bölümü bazında toplam — "hangi bölüm kaç iş yaptı, ne kadar
 * sürdü, ne kadar ciro getirdi" sorusu. Bkz. rapor/veri.ts açıklaması
 * (bölümü olmayan/kataloğa bağlı olmayan satırlar "Bölümsüz"te toplanır).
 */
export default async function IscilikToplamlari({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await iscilikToplamlariVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({
      islemSayisi: t.islemSayisi + s.islemSayisi,
      sure: t.sure + s.sure,
      tutar: t.tutar + s.tutar,
    }),
    { islemSayisi: 0, sure: 0, tutar: 0 }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">İşçilik Toplamları</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            İşçilik bölümü bazında iş sayısı, süre ve tutar (teslim edilen kartlar)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/iscilik-toplam/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/iscilik-toplam" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Clock className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta kayıt yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Bölüm</th>
                  <th className="text-right">İş Sayısı</th>
                  <th className="text-right">Süre (saat)</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.anahtar}>
                    <td>{s.bolumAdi}</td>
                    <td className="text-right tabular-nums">{s.islemSayisi}</td>
                    <td className="text-right tabular-nums">{miktar(s.sure)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td>Dönem toplamı</td>
                  <td className="text-right tabular-nums">{toplam.islemSayisi}</td>
                  <td className="text-right tabular-nums">{miktar(toplam.sure)}</td>
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
