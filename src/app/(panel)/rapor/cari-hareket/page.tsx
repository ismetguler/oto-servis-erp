import type { Metadata } from "next"
import Link from "next/link"
import { Receipt } from "lucide-react"

import {
  cariHareketRaporuVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Cari Hareket" }
export const dynamic = "force-dynamic"

const HAREKET_ADI: Record<string, string> = {
  ACILIS: "Açılış",
  EVRAK: "Fatura",
  KABUL: "Servis",
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
  MAHSUP: "Mahsup",
  CEK_SENET: "Çek/Senet",
}

/**
 * CARİ HAREKET (ADIM 10.6)
 *
 * `/cari/[id]/ekstre`nin TEK cariye bakan halinin TÜM carilere
 * genelleştirilmiş hali — yürüyen bakiye yok, gerekçesi rapor/veri.ts'de.
 */
export default async function CariHareketRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri & { cari?: string }>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }
  const cariAra = sp.cari ?? ""

  const satirlar = await cariHareketRaporuVerisi(filtreler, cariAra)
  const toplamBorc = satirlar.reduce((t, s) => t + s.borc, 0)
  const toplamAlacak = satirlar.reduce((t, s) => t + s.alacak, 0)

  const disaAktarYol = `/rapor/cari-hareket/disa-aktar${raporSorgusu(filtreler)}${
    cariAra ? `${raporSorgusu(filtreler) ? "&" : "?"}cari=${encodeURIComponent(cariAra)}` : ""
  }`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Hareket</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Tarih aralığındaki tüm carilerin hareket dökümü — {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre
          yol="/rapor/cari-hareket"
          bas={filtreler.bas}
          bit={filtreler.bit}
          ekAlan={
            <div className="form-alani min-w-[14rem]">
              <label htmlFor="cari" className="form-etiket">
                Cari (kod/ünvan)
              </label>
              <input
                id="cari"
                name="cari"
                defaultValue={cariAra}
                placeholder="Tümü"
                className="h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              />
            </div>
          }
        />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Receipt className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta cari hareketi yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-24">Tarih</th>
                  <th className="w-28">Cari Kod</th>
                  <th>Ünvan</th>
                  <th className="w-28">Tür</th>
                  <th>Açıklama</th>
                  <th className="w-24">Vade</th>
                  <th className="w-32 text-right">Borç</th>
                  <th className="w-32 text-right">Alacak</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">{tarih(s.tarih)}</td>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/cari/${s.cariId}`} className="text-primary hover:underline">
                        {s.cariKod}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.cariUnvan}</td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {HAREKET_ADI[s.tur] ?? s.tur}
                    </td>
                    <td className="max-w-[18rem] truncate">{s.aciklama ?? "—"}</td>
                    <td className="whitespace-nowrap">{s.vadeTarihi ? tarih(s.vadeTarihi) : "—"}</td>
                    <td className="text-right tabular-nums">{s.borc ? para(s.borc) : "—"}</td>
                    <td className="text-right tabular-nums">{s.alacak ? para(s.alacak) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={6} className="px-3 py-2 text-right">
                    Dönem Toplamı
                  </td>
                  <td className="px-3 py-2 text-right">{para(toplamBorc)}</td>
                  <td className="px-3 py-2 text-right">{para(toplamAlacak)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
