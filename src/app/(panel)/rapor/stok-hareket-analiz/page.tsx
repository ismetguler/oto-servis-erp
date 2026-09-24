import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftRight } from "lucide-react"

import { raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { hareketVerisi, HAREKET_LIMIT, HAREKET_TUR_ADI } from "../../stok/hareket/veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Hareket Analizi" }
export const dynamic = "force-dynamic"

/**
 * STOK HAREKET ANALİZİ (ADIM 10.12.b) — Kritik Stok'taki (73.3/HAFIZA)
 * kararla AYNI desen: sıfırdan yazılmadı, `/stok/hareket`teki
 * `hareketVerisi()`den beslenen İNCE bir kapı Raporlar grubuna eklendi
 * (rapor toolbar'ıyla, CSV/yazdır burada da var ama sorgu mantığı tek
 * kaynaktan). Giriş-Çıkış Analizi'nden (10.12.a) FARKI: o ÖZET/agrege
 * (tür ve stok grubu bazında toplamlar), bu SATIR SATIR ham hareket
 * dökümü — zaten `/stok/hareket` bunu yapıyor, bu kapı sadece Raporlar
 * menüsünden erişim sağlıyor. Stok/tür bazlı filtreleme için ekranda
 * `/stok/hareket`e açık "tam ekran / detaylı filtrele" linki var (Kritik
 * Stok'taki `/stok/minimum` linkiyle aynı fikir).
 */
export default async function StokHareketAnaliziRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const veri = await hareketVerisi({ stok: "tumu", tur: "tumu", bas: filtreler.bas, bit: filtreler.bit })
  const disaAktarYol = `/rapor/stok-hareket-analiz/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Hareket Analizi</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Dönemdeki tüm stok hareketlerinin dökümü — {veri.satirlar.length} satır ·{" "}
            <Link href="/stok/hareket" className="text-primary hover:underline">
              tam ekran / detaylı filtrele
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/stok-hareket-analiz" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="panel p-3">
          <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Dönem Girişi</p>
          <p className="mt-0.5 text-[1.125rem] font-semibold tabular-nums text-basari">{miktar(veri.toplamGiris)}</p>
        </div>
        <div className="panel p-3">
          <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Dönem Çıkışı</p>
          <p className="mt-0.5 text-[1.125rem] font-semibold tabular-nums text-tehlike">{miktar(veri.toplamCikis)}</p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="panel overflow-hidden">
          {veri.satirlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <ArrowLeftRight className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Bu aralıkta hareket yok</p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-24rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Stok Kartı</th>
                    <th>Tür</th>
                    <th>Belge / Açıklama</th>
                    <th className="text-right">Giriş</th>
                    <th className="text-right">Çıkış</th>
                    <th className="text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {veri.satirlar.map((h) => (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap">{tarih(h.tarih)}</td>
                      <td>
                        <Link href={`/stok/${h.stokId}`} className="hover:underline">
                          {h.stokKodu} — {h.stokAdi}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">{HAREKET_TUR_ADI[h.tur]}</td>
                      <td className="max-w-[20rem] truncate">
                        {h.belgeYolu ? (
                          <Link href={h.belgeYolu} className="text-primary hover:underline">
                            {h.belgeEtiketi}
                          </Link>
                        ) : (
                          h.belgeEtiketi
                        )}
                      </td>
                      <td className="text-right tabular-nums text-basari">
                        {h.giris > 0 ? `${miktar(h.giris)} ${h.birim}` : "—"}
                      </td>
                      <td className="text-right tabular-nums text-tehlike">
                        {h.cikis > 0 ? `${miktar(h.cikis)} ${h.birim}` : "—"}
                      </td>
                      <td className="text-right tabular-nums">{h.tutar ? para(h.tutar) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                    <td colSpan={4} className="px-3 py-2 text-right">
                      Dönem Toplamı
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-basari">{miktar(veri.toplamGiris)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-tehlike">{miktar(veri.toplamCikis)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{para(veri.toplamTutar)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        {veri.satirlar.length === HAREKET_LIMIT ? (
          <p className="mt-2 text-[0.75rem] text-muted-foreground">
            İlk {HAREKET_LIMIT} satır gösteriliyor — daha fazlası için{" "}
            <Link href="/stok/hareket" className="text-primary hover:underline">
              detaylı filtrele
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  )
}
