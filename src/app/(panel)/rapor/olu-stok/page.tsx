import type { Metadata } from "next"
import Link from "next/link"
import { PackageX } from "lucide-react"

import { oluStokVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Hareketsiz Parçalar" }
export const dynamic = "force-dynamic"

/**
 * ÖLÜ STOK (ADIM 10.13.a) — gerekçe `veri.ts`teki `oluStokVerisi`
 * yorumunda. `StokHareket` tabanlı, tarih aralığı SORGUYU DARALTMAZ, sadece
 * "bugün" referansı olarak kullanılır (bkz. HAFIZA 76).
 */
export default async function OluStokRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const { satirlar, esikGun, referansTarihi } = await oluStokVerisi(filtreler)
  const toplamBaglananDeger = satirlar.reduce((t, s) => t + s.baglananDeger, 0)
  const disaAktarYol = `/rapor/olu-stok/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Hareketsiz Parçalar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {tarih(referansTarihi)} itibariyle {esikGun}+ gündür (veya hiç) hareket görmemiş kartlar —{" "}
            {satirlar.length} kayıt, bağlı değer {para(toplamBaglananDeger)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/olu-stok" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <PackageX className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Ölü stok kartı yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Grup</th>
                  <th>Depo</th>
                  <th className="text-right">Mevcut</th>
                  <th className="text-right">Bağlı Değer</th>
                  <th>Son Hareket</th>
                  <th className="text-right">Gün</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/stok/${s.id}`} className="text-primary hover:underline">
                        {s.kod}
                      </Link>
                    </td>
                    <td className="max-w-[18rem] truncate font-medium">{s.ad}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.urunGrubu}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.depoAdi}</td>
                    <td className="text-right tabular-nums">{miktar(s.mevcutMiktar)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.baglananDeger)}</td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {s.sonHareketTarihi ? tarih(s.sonHareketTarihi) : "Hiç hareket yok"}
                    </td>
                    <td className="text-right tabular-nums text-tehlike">
                      {s.gunFarki !== null ? s.gunFarki : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={5} className="text-right">
                    Toplam
                  </td>
                  <td className="text-right tabular-nums">{para(toplamBaglananDeger)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
