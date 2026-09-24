import type { Metadata } from "next"
import Link from "next/link"
import { TrendingUp } from "lucide-react"

import {
  karlilikVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, plaka as plakaBicim, tarih, yuzde } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Onarım Kârlılık" }
export const dynamic = "force-dynamic"

/**
 * ONARIM KÂRLILIK (ADIM 10.1)
 *
 * Kabul kartı başına kâr — hesap yöntemi rapor/veri.ts'de açıklanıyor.
 * Dış hizmet tutarı bilgi amaçlı gösterilir, kâra KATILMAZ (maliyeti
 * sistemde tutulmuyor).
 */
export default async function OnarimKarlilik({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await karlilikVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({
      parcaSatis: t.parcaSatis + s.parcaSatis,
      parcaMaliyet: t.parcaMaliyet + s.parcaMaliyet,
      parcaKar: t.parcaKar + s.parcaKar,
      iscilikGeliri: t.iscilikGeliri + s.iscilikGeliri,
      disHizmetToplam: t.disHizmetToplam + s.disHizmetToplam,
      toplamKar: t.toplamKar + s.toplamKar,
      genelToplam: t.genelToplam + s.genelToplam,
    }),
    {
      parcaSatis: 0,
      parcaMaliyet: 0,
      parcaKar: 0,
      iscilikGeliri: 0,
      disHizmetToplam: 0,
      toplamKar: 0,
      genelToplam: 0,
    }
  )
  // Satır bazındaki `karOrani` ile aynı payda: KDV hariç parça + işçilik
  // (bkz. rapor/veri.ts `karlilikVerisi` yorumu).
  const karTabani = toplam.parcaSatis + toplam.iscilikGeliri
  const toplamKarOrani = karTabani > 0 ? (toplam.toplamKar / karTabani) * 100 : 0

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Onarım Kârlılık</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Teslim edilen kartlarda parça + işçilik kârı — {satirlar.length} kart
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/karlilik/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/karlilik" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <TrendingUp className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta teslim edilmiş kart yok</p>
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
                  <th className="text-right">Parça Satış</th>
                  <th className="text-right">Parça Maliyet</th>
                  <th className="text-right">Parça Kâr</th>
                  <th className="text-right">İşçilik Geliri</th>
                  <th className="text-right">Dış Hizmet</th>
                  <th className="text-right">Toplam Kâr</th>
                  <th className="text-right">Kâr Oranı</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem]">
                      <Link href={`/servis/kabul/${s.id}`} className="text-primary hover:underline">
                        {s.kabulNo}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{tarih(s.teslimTarihi)}</td>
                    <td className="font-medium">{plakaBicim(s.plaka)}</td>
                    <td className="max-w-[16rem] truncate">{s.musteri}</td>
                    <td className="text-right tabular-nums">{para(s.parcaSatis)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {para(s.parcaMaliyet)}
                    </td>
                    <td className="text-right tabular-nums">{para(s.parcaKar)}</td>
                    <td className="text-right tabular-nums">{para(s.iscilikGeliri)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {para(s.disHizmetToplam)}
                    </td>
                    <td className="text-right tabular-nums font-medium">{para(s.toplamKar)}</td>
                    <td className="text-right tabular-nums">{yuzde(s.karOrani)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={4} className="text-right">
                    Dönem toplamı
                  </td>
                  <td className="text-right tabular-nums">{para(toplam.parcaSatis)}</td>
                  <td className="text-right tabular-nums">{para(toplam.parcaMaliyet)}</td>
                  <td className="text-right tabular-nums">{para(toplam.parcaKar)}</td>
                  <td className="text-right tabular-nums">{para(toplam.iscilikGeliri)}</td>
                  <td className="text-right tabular-nums">{para(toplam.disHizmetToplam)}</td>
                  <td className="text-right tabular-nums">{para(toplam.toplamKar)}</td>
                  <td className="text-right tabular-nums">{yuzde(toplamKarOrani)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
