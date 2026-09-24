import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Merge, Copy } from "lucide-react"

import { vknMukerrerVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { CARI_TUR_ADLARI } from "../../cari/sema"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Aynı Vergi Nolu Cariler" }
export const dynamic = "force-dynamic"

/**
 * VKN AYNI OLANLAR (ADIM 10.9.b)
 *
 * Mükerrer cari tespiti — `/cari/mukerrer`in ("Mükerrer Cari Kontrolü", VKN+
 * ünvan+telefon) VKN dilimini Raporlar grubunda SELPAR-ANALIZ.md'deki isimle
 * ve rapor araçlarıyla (CSV/yazdır) tekrar sunar. İkisi de kalır, biri
 * diğerinin yerine geçmez — gerekçe `veri.ts`teki `vknMukerrerVerisi`de.
 *
 * Tarih aralığı SORGUYU DARALTMAZ, yalnızca her satırı "bu aralıkta açılmış"
 * diye işaretler (aksi halde gerçek bir mükerrer kart aralık dışına düşüp
 * gizlenebilirdi) — gerekçe aynı yerde.
 */
export default async function VknMukerrerRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const gruplar = await vknMukerrerVerisi(filtreler)
  const toplamKayit = gruplar.reduce((t, g) => t + g.kayitlar.length, 0)

  const disaAktarYol = `/rapor/vkn-mukerrer/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Aynı Vergi Nolu Cariler</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Aynı vergi numarasına bağlı birden fazla cari kartı — {gruplar.length} VKN, {toplamKayit} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/cari/mukerrer"
            className="h-8 rounded-sm border border-input bg-background px-3 text-[0.8125rem] font-medium leading-8 hover:bg-accent"
          >
            Mükerrer Kontrolü (tam ekran)
          </Link>
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/vkn-mukerrer" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {gruplar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <CheckCircle2 className="size-8 text-basari" aria-hidden />
            <p className="text-[0.875rem] font-medium">Aynı VKN&apos;ye bağlı mükerrer cari yok</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {gruplar.map((g) => (
              <div key={g.vergiNo} className="panel overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2">
                  <Copy className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="font-mono text-[0.8125rem] font-medium">VKN {g.vergiNo}</span>
                  <span className="text-[0.75rem] text-muted-foreground">— {g.kayitlar.length} kart</span>
                </div>
                <div className="tablo-sarmal">
                  <table className="veri-tablosu">
                    <thead>
                      <tr>
                        <th className="w-28">Kod</th>
                        <th>Ünvan</th>
                        <th className="w-24">Tür</th>
                        <th className="w-32">Telefon</th>
                        <th className="w-40">Açılış</th>
                        <th className="w-20 yazdirma-disi"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.kayitlar.map((k) => (
                        <tr key={k.id}>
                          <td className="font-mono text-[0.75rem] whitespace-nowrap">
                            <Link href={`/cari/${k.id}`} className="text-primary hover:underline">
                              {k.kod}
                            </Link>
                          </td>
                          <td className="max-w-[16rem] truncate font-medium">{k.unvan}</td>
                          <td className="text-muted-foreground whitespace-nowrap">
                            {CARI_TUR_ADLARI[k.turu as keyof typeof CARI_TUR_ADLARI] ?? k.turu}
                          </td>
                          <td className="whitespace-nowrap">{k.telefon || "—"}</td>
                          <td className="whitespace-nowrap text-muted-foreground">
                            {tarihSaat(k.olusturmaTarihi)}
                            {!k.aralikIcinde && (
                              <span className="ml-1 text-[0.6875rem] text-muted-foreground/70">
                                (aralık dışı)
                              </span>
                            )}
                          </td>
                          <td className="yazdirma-disi text-right">
                            <Link
                              href={`/cari/birlestir?kaynak=${k.id}&hedef=${g.kayitlar.find((x) => x.id !== k.id)?.id ?? ""}`}
                              className="inline-flex items-center gap-1 text-[0.75rem] text-primary hover:underline"
                            >
                              <Merge className="size-3" aria-hidden />
                              Birleştir
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
