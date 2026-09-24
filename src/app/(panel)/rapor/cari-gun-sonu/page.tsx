import type { Metadata } from "next"
import { CalendarClock } from "lucide-react"

import {
  cariGunSonuVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Cari Gün Sonu" }
export const dynamic = "force-dynamic"

/**
 * CARİ GÜN SONU (ADIM 10.7)
 *
 * Servis Gün Sonu'nun (10.1) CARİ tarafındaki karşılığı — isim çakışmasın
 * diye o "Servis Gün Sonü" olarak ayrıştırıldı (HAFIZA 64). Günlük İcmal'den
 * (10.1) farkı: İcmal servis odaklı tüm faaliyeti kapsıyordu, bu sadece CARİ
 * hareketlerine (fatura/servis/tahsilat/ödeme) odaklanır. Gerekçe rapor/veri.ts'de.
 */
export default async function CariGunSonuRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await cariGunSonuVerisi(filtreler)
  const toplam = satirlar.reduce(
    (t, s) => ({
      faturaToplam: t.faturaToplam + s.faturaToplam,
      servisToplam: t.servisToplam + s.servisToplam,
      tahsilat: t.tahsilat + s.tahsilat,
      odeme: t.odeme + s.odeme,
      digerNet: t.digerNet + s.digerNet,
      gunNet: t.gunNet + s.gunNet,
    }),
    { faturaToplam: 0, servisToplam: 0, tahsilat: 0, odeme: 0, digerNet: 0, gunNet: 0 }
  )
  const sonBakiye = satirlar.length > 0 ? satirlar[0].kumulatifBakiye : 0

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Gün Sonu</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Gün bazında cari hareket dökümü ve yürüyen net bakiye — {satirlar.length} gün
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/cari-gun-sonu/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/cari-gun-sonu" bas={filtreler.bas} bit={filtreler.bit} />
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
                  <th className="text-right">Fatura</th>
                  <th className="text-right">Servis</th>
                  <th className="text-right">Tahsilat</th>
                  <th className="text-right">Ödeme</th>
                  <th className="text-right">Diğer</th>
                  <th className="text-right">Gün Net</th>
                  <th className="text-right">Yürüyen Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.gun.toISOString()}>
                    <td className="whitespace-nowrap">{tarih(s.gun)}</td>
                    <td className="text-right tabular-nums">
                      {s.faturaToplam ? para(s.faturaToplam) : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {s.servisToplam ? para(s.servisToplam) : "—"}
                    </td>
                    <td className="text-right tabular-nums">{s.tahsilat ? para(s.tahsilat) : "—"}</td>
                    <td className="text-right tabular-nums">{s.odeme ? para(s.odeme) : "—"}</td>
                    <td className="text-right tabular-nums">
                      {s.digerNet ? para(s.digerNet) : "—"}
                    </td>
                    <td className="text-right tabular-nums font-medium">{para(s.gunNet)}</td>
                    <td className="text-right tabular-nums">{para(s.kumulatifBakiye)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td className="px-3 py-2 text-right">Dönem Toplamı</td>
                  <td className="px-3 py-2 text-right">{para(toplam.faturaToplam)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.servisToplam)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.tahsilat)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.odeme)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.digerNet)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.gunNet)}</td>
                  <td className="px-3 py-2 text-right">{para(sonBakiye)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
