import type { Metadata } from "next"
import Link from "next/link"
import { ReceiptText } from "lucide-react"

import {
  satisDetayVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Servis Satış Detaylı" }
export const dynamic = "force-dynamic"

const TUR_ETIKET: Record<string, string> = {
  PARCA: "Parça",
  ISCILIK: "İşçilik",
  DIS_HIZMET: "Dış Hizmet",
}

/**
 * SERVİS SATIŞ DETAYLI (ADIM 10.3)
 *
 * Onarım Kârlılık'ın kart özetinden farkı: KALEM bazında, kart+kalem
 * ilişkisiyle tek tek — "hangi kartta ne satıldı" sorusu. Yapılan
 * İşçilikler/Parçalar'dan farkı: burada GRUPLAMA yok, her satır ayrı bir
 * kalem. Bkz. rapor/veri.ts açıklaması.
 */
export default async function SatisDetay({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await satisDetayVerisi(filtreler)
  const genelToplam = satirlar.reduce((t, s) => t + s.tutar, 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Servis Satış Detaylı</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Teslim edilen kartların satır satır kalem dökümü — {satirlar.length} kalem
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/satis-detay/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/satis-detay" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ReceiptText className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta kayıt yok</p>
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
                  <th>Tür</th>
                  <th>Kalem</th>
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
                    <td className="whitespace-nowrap text-muted-foreground">
                      {TUR_ETIKET[s.tur] ?? s.tur}
                    </td>
                    <td className="max-w-[18rem] truncate">{s.ad}</td>
                    <td className="text-right tabular-nums">{miktar(s.miktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={7} className="text-right">
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
