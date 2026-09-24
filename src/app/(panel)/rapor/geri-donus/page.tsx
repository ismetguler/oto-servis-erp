import type { Metadata } from "next"
import Link from "next/link"
import { Undo2 } from "lucide-react"

import {
  geriDonusVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Tekrar Gelen Araçlar" }
export const dynamic = "force-dynamic"

/**
 * GERİ DÖNÜŞ (ADIM 10.4)
 *
 * "Yaptığımız iş tutmadı mı" — aynı araç teslimden sonra 30 gün içinde
 * tekrar kabule girmişse listelenir. Eşik ve ölçüt gerekçesi rapor/veri.ts'de.
 */
export default async function GeriDonus({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await geriDonusVerisi(filtreler)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Tekrar Gelen Araçlar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Teslimden sonra 30 gün içinde tekrar kabule giren araçlar — {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/geri-donus/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/geri-donus" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Undo2 className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta geri dönüş yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Plaka</th>
                  <th>Müşteri</th>
                  <th>İlk Kabul</th>
                  <th>İlk Teslim</th>
                  <th>Şikayet / Yapılan İş</th>
                  <th>İkinci Kabul</th>
                  <th>İkinci Giriş</th>
                  <th className="text-right">Gün Farkı</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => (
                  <tr key={`${s.ilkKabulId}-${s.ikinciKabulId}-${i}`}>
                    <td className="font-medium whitespace-nowrap">
                      <Link href={`/arac/${s.aracId}`} className="text-primary hover:underline">
                        {plakaBicim(s.plaka)}
                      </Link>
                    </td>
                    <td className="max-w-[12rem] truncate">{s.musteri}</td>
                    <td className="whitespace-nowrap">
                      <Link
                        href={`/servis/kabul/${s.ilkKabulId}`}
                        className="text-primary hover:underline"
                      >
                        {s.ilkKabulNo}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{tarih(s.ilkTeslimTarihi)}</td>
                    <td className="max-w-[16rem] truncate">
                      {s.ilkSikayet || s.ilkYapilanIsler || "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      <Link
                        href={`/servis/kabul/${s.ikinciKabulId}`}
                        className="text-primary hover:underline"
                      >
                        {s.ikinciKabulNo}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{tarih(s.ikinciGirisTarihi)}</td>
                    <td className="text-right tabular-nums font-medium">{s.gunFarki}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={7} className="text-right">
                    Toplam
                  </td>
                  <td className="text-right tabular-nums">{satirlar.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
