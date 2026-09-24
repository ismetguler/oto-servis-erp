import type { Metadata } from "next"
import Link from "next/link"
import { Calculator } from "lucide-react"

import {
  hesapToplamVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { CARI_TUR_ADLARI } from "../../cari/sema"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Cari Alış-Satış Toplamları" }
export const dynamic = "force-dynamic"

/**
 * CARİ HESAP TOPLAMLARI (ADIM 10.6)
 *
 * `/cari/mizan`'dan farkı ve gerekçesi rapor/veri.ts'de: mizan dönem
 * kapanışı (devir+bakiye), bu rapor dönem iş hacmi (tür bazında kırılım).
 */
export default async function HesapToplamRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await hesapToplamVerisi(filtreler)
  const toplam = satirlar.reduce(
    (t, s) => ({
      borcToplam: t.borcToplam + s.borcToplam,
      alacakToplam: t.alacakToplam + s.alacakToplam,
    }),
    { borcToplam: 0, alacakToplam: 0 }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Cari Alış-Satış Toplamları
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Dönem içi cari bazında tür kırılımı (en çok işlem yapılana göre sıralı) —{" "}
            {satirlar.length} cari
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/hesap-toplam/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/hesap-toplam" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Calculator className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta cari hareketi yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-28">Kod</th>
                  <th>Ünvan</th>
                  <th className="w-24">Tür</th>
                  <th className="w-28 text-right">Fatura</th>
                  <th className="w-28 text-right">Servis</th>
                  <th className="w-28 text-right">Tahsilat</th>
                  <th className="w-28 text-right">Ödeme</th>
                  <th className="w-32 text-right">Dönem Borç</th>
                  <th className="w-32 text-right">Dönem Alacak</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/cari/${s.id}/ekstre`} className="text-primary hover:underline">
                        {s.kod}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.unvan}</td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu}
                    </td>
                    <td className="text-right tabular-nums">{s.evrakNet ? para(s.evrakNet) : "—"}</td>
                    <td className="text-right tabular-nums">{s.kabulNet ? para(s.kabulNet) : "—"}</td>
                    <td className="text-right tabular-nums">
                      {s.tahsilatNet ? para(s.tahsilatNet) : "—"}
                    </td>
                    <td className="text-right tabular-nums">{s.tediyeNet ? para(s.tediyeNet) : "—"}</td>
                    <td className="text-right tabular-nums">{para(s.borcToplam)}</td>
                    <td className="text-right tabular-nums">{para(s.alacakToplam)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={7} className="px-3 py-2 text-right">
                    Genel Toplam
                  </td>
                  <td className="px-3 py-2 text-right">{para(toplam.borcToplam)}</td>
                  <td className="px-3 py-2 text-right">{para(toplam.alacakToplam)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
