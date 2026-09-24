import type { Metadata } from "next"
import { CalendarClock } from "lucide-react"

import {
  gunSonuVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Servis Gün Sonu" }
export const dynamic = "force-dynamic"

/**
 * SERVİS GÜN SONU (ADIM 10.1)
 *
 * "Bugün ne kadar iş kapattık, kaç araç girdi çıktı?" sorusunun günlük
 * dökümü. Teslim tarihine göre gruplanır — bkz. rapor/veri.ts açıklaması.
 */
export default async function ServisGunSonu({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await gunSonuVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({
      acilanKabul: t.acilanKabul + s.acilanKabul,
      teslimEdilenKabul: t.teslimEdilenKabul + s.teslimEdilenKabul,
      parcaToplam: t.parcaToplam + s.parcaToplam,
      iscilikToplam: t.iscilikToplam + s.iscilikToplam,
      genelToplam: t.genelToplam + s.genelToplam,
      tahsilat: t.tahsilat + s.tahsilat,
    }),
    {
      acilanKabul: 0,
      teslimEdilenKabul: 0,
      parcaToplam: 0,
      iscilikToplam: 0,
      genelToplam: 0,
      tahsilat: 0,
    }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Servis Gün Sonu</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Gün bazında açılan/teslim edilen kart ve tahsilat dökümü
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/gun-sonu/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/gun-sonu" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <CalendarClock className="size-8 text-muted-foreground/40" aria-hidden />
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
                  <th className="text-right">Parça + Dış Hizmet</th>
                  <th className="text-right">İşçilik</th>
                  <th className="text-right">Genel Toplam</th>
                  <th className="text-right">Tahsilat</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.gun.toISOString()}>
                    <td className="whitespace-nowrap">{tarih(s.gun)}</td>
                    <td className="text-right tabular-nums">{s.acilanKabul}</td>
                    <td className="text-right tabular-nums">{s.teslimEdilenKabul}</td>
                    <td className="text-right tabular-nums">{para(s.parcaToplam)}</td>
                    <td className="text-right tabular-nums">{para(s.iscilikToplam)}</td>
                    <td className="text-right tabular-nums font-medium">
                      {para(s.genelToplam)}
                    </td>
                    <td className="text-right tabular-nums">{para(s.tahsilat)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td>Dönem toplamı</td>
                  <td className="text-right tabular-nums">{toplam.acilanKabul}</td>
                  <td className="text-right tabular-nums">{toplam.teslimEdilenKabul}</td>
                  <td className="text-right tabular-nums">{para(toplam.parcaToplam)}</td>
                  <td className="text-right tabular-nums">{para(toplam.iscilikToplam)}</td>
                  <td className="text-right tabular-nums">{para(toplam.genelToplam)}</td>
                  <td className="text-right tabular-nums">{para(toplam.tahsilat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
