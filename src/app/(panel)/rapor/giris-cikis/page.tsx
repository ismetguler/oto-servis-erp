import type { Metadata } from "next"
import { ArrowLeftRight } from "lucide-react"

import { girisCikisAnaliziVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Giriş-Çıkış" }
export const dynamic = "force-dynamic"

/**
 * GİRİŞ-ÇIKIŞ ANALİZİ (ADIM 10.12.a) — gerekçe `veri.ts`teki
 * `girisCikisAnaliziVerisi` yorumunda. 10.10-10.11'in aksine `StokHareket`
 * tabanlı, tarih aralığı SORGUYU GERÇEKTEN DARALTIR (bkz. HAFIZA 75).
 */
export default async function GirisCikisRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const ozet = await girisCikisAnaliziVerisi(filtreler)
  const disaAktarYol = `/rapor/giris-cikis/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Giriş-Çıkış</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Dönemde depoya giren/çıkan miktar ve tutar — {ozet.stokKirilimi.length} stok kartı
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/giris-cikis" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Toplam Giriş</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums text-basari">{miktar(ozet.toplamGiris)}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Toplam Çıkış</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums text-tehlike">{miktar(ozet.toplamCikis)}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-[0.75rem] text-muted-foreground">Net Değişim</p>
            <p className="text-[1.0625rem] font-semibold tabular-nums">{miktar(ozet.toplamNet)}</p>
          </div>
        </div>

        {ozet.turKirilimi.length > 0 && (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Hareket Türü</th>
                  <th className="text-right">Hareket Sayısı</th>
                  <th className="text-right">Giriş Miktar</th>
                  <th className="text-right">Çıkış Miktar</th>
                  <th className="text-right">Net Miktar</th>
                  <th className="text-right">Net Tutar</th>
                </tr>
              </thead>
              <tbody>
                {ozet.turKirilimi.map((t) => (
                  <tr key={t.tur}>
                    <td className="font-medium">{t.turAdi}</td>
                    <td className="text-right tabular-nums">{t.hareketSayisi}</td>
                    <td className="text-right tabular-nums text-basari">{miktar(t.girisMiktar)}</td>
                    <td className="text-right tabular-nums text-tehlike">{miktar(t.cikisMiktar)}</td>
                    <td className="text-right tabular-nums">{miktar(t.netMiktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(t.netTutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ozet.grupKirilimi.length > 0 && (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Ürün Grubu</th>
                  <th className="text-right">Giriş Miktar</th>
                  <th className="text-right">Çıkış Miktar</th>
                  <th className="text-right">Net Miktar</th>
                  <th className="text-right">Net Tutar</th>
                </tr>
              </thead>
              <tbody>
                {ozet.grupKirilimi.map((g) => (
                  <tr key={g.urunGrubu}>
                    <td className="font-medium">{g.urunGrubu}</td>
                    <td className="text-right tabular-nums text-basari">{miktar(g.girisMiktar)}</td>
                    <td className="text-right tabular-nums text-tehlike">{miktar(g.cikisMiktar)}</td>
                    <td className="text-right tabular-nums">{miktar(g.netMiktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(g.netTutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ozet.stokKirilimi.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ArrowLeftRight className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta stok hareketi yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Grup</th>
                  <th className="text-right">Giriş</th>
                  <th className="text-right">Çıkış</th>
                  <th className="text-right">Net Miktar</th>
                  <th className="text-right">Net Tutar</th>
                </tr>
              </thead>
              <tbody>
                {ozet.stokKirilimi.map((s) => (
                  <tr key={s.stokId}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">{s.kod}</td>
                    <td className="max-w-[18rem] truncate font-medium">{s.ad}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.urunGrubu}</td>
                    <td className="text-right tabular-nums text-basari">{miktar(s.girisMiktar)}</td>
                    <td className="text-right tabular-nums text-tehlike">{miktar(s.cikisMiktar)}</td>
                    <td className="text-right tabular-nums">{miktar(s.netMiktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.netTutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={3} className="text-right">
                    Dönem toplamı
                  </td>
                  <td className="text-right tabular-nums text-basari">{miktar(ozet.toplamGiris)}</td>
                  <td className="text-right tabular-nums text-tehlike">{miktar(ozet.toplamCikis)}</td>
                  <td className="text-right tabular-nums">{miktar(ozet.toplamNet)}</td>
                  <td className="text-right tabular-nums">{para(ozet.toplamNetTutar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
