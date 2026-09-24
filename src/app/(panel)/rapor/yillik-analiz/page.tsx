import type { Metadata } from "next"
import { TrendingUp } from "lucide-react"

import {
  yillikAnalizVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Servis Yıllık Analiz" }
export const dynamic = "force-dynamic"

/**
 * SERVİS YILLIK ANALİZ (ADIM 10.4)
 *
 * Servis Gün Sonu'nun (10.1) ay bazında büyütülmüş hali — hesap yöntemi
 * rapor/veri.ts'de açıklanıyor. Varsayılan aralık diğer raporlarla aynı
 * (içinde bulunulan ay) ama bu raporun asıl kullanımı geniş aralık
 * (ör. bir yıl) seçip aylık gidişatı görmek.
 */
export default async function YillikAnaliz({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await yillikAnalizVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({
      kartSayisi: t.kartSayisi + s.kartSayisi,
      parcaToplam: t.parcaToplam + s.parcaToplam,
      iscilikToplam: t.iscilikToplam + s.iscilikToplam,
      genelToplam: t.genelToplam + s.genelToplam,
    }),
    { kartSayisi: 0, parcaToplam: 0, iscilikToplam: 0, genelToplam: 0 }
  )
  const ortalamaKartTutari = toplam.kartSayisi > 0 ? toplam.genelToplam / toplam.kartSayisi : 0

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Servis Yıllık Analiz</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Ay bazında kart sayısı ve ciro — {satirlar.length} ay
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/yillik-analiz/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/yillik-analiz" bas={filtreler.bas} bit={filtreler.bit} />
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
                  <th className="text-right">Kart Sayısı</th>
                  <th className="text-right">Parça + Dış Hizmet</th>
                  <th className="text-right">İşçilik Toplam</th>
                  <th className="text-right">Genel Toplam</th>
                  <th className="text-right">Ort. Kart Tutarı</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.ay}>
                    <td className="font-medium whitespace-nowrap">{s.ayEtiketi}</td>
                    <td className="text-right tabular-nums">{s.kartSayisi}</td>
                    <td className="text-right tabular-nums">{para(s.parcaToplam)}</td>
                    <td className="text-right tabular-nums">{para(s.iscilikToplam)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.genelToplam)}</td>
                    <td className="text-right tabular-nums">{para(s.ortalamaKartTutari)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td className="text-right">Dönem toplamı</td>
                  <td className="text-right tabular-nums">{toplam.kartSayisi}</td>
                  <td className="text-right tabular-nums">{para(toplam.parcaToplam)}</td>
                  <td className="text-right tabular-nums">{para(toplam.iscilikToplam)}</td>
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
