import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import {
  sigortaOdemeVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { GARANTI_DURUM_ETIKETI } from "../../servis/kabul/sema"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Sigorta Ödeme" }
export const dynamic = "force-dynamic"

const DURUM_SINIFI: Record<string, string> = {
  BEKLIYOR: "bg-uyari-yumusak text-uyari",
  ONAYLANDI: "bg-bilgi-yumusak text-bilgi",
  RED: "bg-tehlike-yumusak text-tehlike",
  ODENDI: "bg-basari-yumusak text-basari",
}

function durumEtiketi(durum: string | null): string {
  if (!durum) return "(Belirtilmemiş)"
  return GARANTI_DURUM_ETIKETI[durum as keyof typeof GARANTI_DURUM_ETIKETI] ?? durum
}

/**
 * SİGORTA ÖDEME (ADIM 10.5)
 *
 * Garanti Listesi'nden (4c) farkı: bu bir DÖNEM raporu, o bir takip ekranı.
 * Tarih ölçütü ve gerekçe rapor/veri.ts'de.
 */
export default async function SigortaOdeme({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const { satirlar, ozet } = await sigortaOdemeVerisi(filtreler)
  const genelTalepToplam = satirlar.reduce((t, s) => t + s.garantiTutar, 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Sigorta Ödeme</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Talep tarihi aralığındaki garantili/sigortalı kartlar — {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/sigorta-odeme/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/sigorta-odeme" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {ozet.length > 0 && (
          <div className="yazdirma-disi grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ozet.map((o) => (
              <div key={o.durum} className="panel px-4 py-3">
                <div
                  className={`inline-flex rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${DURUM_SINIFI[o.durum] ?? "bg-muted text-muted-foreground"}`}
                >
                  {durumEtiketi(o.durum)}
                </div>
                <p className="mt-2 text-[1.0625rem] font-semibold tabular-nums">{para(o.tutar)}</p>
                <p className="text-[0.75rem] text-muted-foreground">{o.adet} kayıt</p>
              </div>
            ))}
          </div>
        )}

        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta garanti/sigorta talebi yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kabul No</th>
                  <th>Plaka</th>
                  <th>Müşteri</th>
                  <th>Garanti Veren</th>
                  <th>Talep Tarihi</th>
                  <th>Dosya No</th>
                  <th>Onay No</th>
                  <th>Durum</th>
                  <th className="text-right">Talep Edilen</th>
                  <th className="text-right">Kart Toplamı</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/servis/kabul/${s.id}`} className="text-primary hover:underline">
                        {s.kabulNo}
                      </Link>
                    </td>
                    <td className="font-medium whitespace-nowrap">{plakaBicim(s.plaka)}</td>
                    <td className="max-w-[12rem] truncate">{s.musteri}</td>
                    <td className="max-w-[12rem] truncate">{s.garantiVerenFirma}</td>
                    <td className="whitespace-nowrap">{tarih(s.garantiTalepTarihi)}</td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {s.garantiDosyaNo || "—"}
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {s.garantiOnayNo || "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${DURUM_SINIFI[s.garantiDurumu ?? ""] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {durumEtiketi(s.garantiDurumu)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums font-medium">{para(s.garantiTutar)}</td>
                    <td className="text-right tabular-nums">{para(s.genelToplam)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={8} className="text-right">
                    Genel toplam (talep edilen)
                  </td>
                  <td className="text-right tabular-nums">{para(genelTalepToplam)}</td>
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
