import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, FolderKanban } from "lucide-react"

import { projeRaporSorgusu, projeRaporVerisi, raporProjeSecenekleri } from "../veri"
import { DurumRozeti } from "@/components/kabul/kabul-listesi"
import { ProjeRaporFiltre } from "@/components/proje/proje-rapor-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Proje Raporu" }
export const dynamic = "force-dynamic"

type Aramalar = { proje?: string; q?: string; durum?: string; bas?: string; bit?: string }

/**
 * PROJE BAZLI KABUL RAPORU
 *
 * Filo/kurumsal işlerde soru şu: "Bu projede kaç araca, ne kadarlık iş
 * yaptık, ne kadarı faturalanmadı?" — bu yüzden kayıtlar proje bazında
 * gruplanıp her grubun altına toplam satırı konuyor.
 */
export default async function ProjeRaporu({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("kabul", "gor")
  const p = await searchParams

  const filtreler = {
    proje: p.proje ?? "",
    q: (p.q ?? "").trim(),
    durum: p.durum ?? "",
    bas: p.bas ?? "",
    bit: p.bit ?? "",
  }

  const [gruplar, projeSecenekleri] = await Promise.all([
    projeRaporVerisi(filtreler),
    raporProjeSecenekleri(),
  ])

  const ozet = gruplar.reduce(
    (t, g) => ({
      kabul: t.kabul + g.kabulSayisi,
      arac: t.arac + g.aracSayisi,
      tutar: t.tutar + g.genelToplam,
      faturasiz: t.faturasiz + g.faturasizToplam,
    }),
    { kabul: 0, arac: 0, tutar: 0, faturasiz: 0 }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/servis/proje" aria-label="Proje tanımlarına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Proje Raporu</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Proje bazında kabul dökümü — {gruplar.length} proje, {ozet.kabul} kabul
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/servis/proje/rapor/disa-aktar${projeRaporSorgusu(filtreler)}`}
          />
        </div>
      </div>

      <div className="yazdirma-disi">
        <ProjeRaporFiltre {...filtreler} projeler={projeSecenekleri} />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <OzetKutusu baslik="Kabul Adedi" deger={String(ozet.kabul)} />
        <OzetKutusu baslik="Araç Adedi (tekil)" deger={String(ozet.arac)} />
        <OzetKutusu baslik="Toplam İş Tutarı" deger={para(ozet.tutar)} />
        <OzetKutusu baslik="Faturası Kesilmemiş" deger={para(ozet.faturasiz)} vurgu />
      </div>

      <div className="px-4 pb-4">
        {gruplar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <FolderKanban className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu ölçütlere uyan kayıt yok</p>
            <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
              Kabul kartındaki &quot;Proje&quot; alanı doldurulmuş kartlar burada listelenir.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {gruplar.map((g) => (
              <div key={g.proje} className="panel overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                  <h2 className="text-[0.8125rem] font-semibold">
                    {g.proje}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {g.kabulSayisi} kabul · {g.aracSayisi} araç
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-[0.75rem]">
                    <span className="text-muted-foreground">
                      Parça <span className="tabular-nums">{para(g.parcaToplam)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      İşçilik <span className="tabular-nums">{para(g.iscilikToplam)}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{para(g.genelToplam)}</span>
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="veri-tablosu">
                    <thead>
                      <tr>
                        <th>Kabul No</th>
                        <th>Giriş</th>
                        <th>Teslim</th>
                        <th>Plaka</th>
                        <th>Marka / Model</th>
                        <th>Müşteri</th>
                        <th>Filo Şirketi</th>
                        <th>Durum</th>
                        <th className="text-right">Parça</th>
                        <th className="text-right">İşçilik</th>
                        <th className="text-right">Genel Toplam</th>
                        <th>Fatura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.satirlar.map((s) => (
                        <tr key={s.id}>
                          <td className="font-mono text-[0.75rem]">
                            <Link
                              href={`/servis/kabul/${s.id}`}
                              className="text-primary hover:underline"
                            >
                              {s.kabulNo}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap">{tarih(s.girisTarihi)}</td>
                          <td className="whitespace-nowrap text-muted-foreground">
                            {s.teslimTarihi ? tarih(s.teslimTarihi) : "—"}
                          </td>
                          <td className="font-medium">{plakaBicim(s.plaka)}</td>
                          <td className="text-muted-foreground">
                            {[s.marka, s.model].filter(Boolean).join(" ") || "—"}
                          </td>
                          <td className="max-w-[16rem] truncate">{s.musteri}</td>
                          <td className="text-muted-foreground">{s.filoSirketi ?? "—"}</td>
                          <td>
                            <DurumRozeti durum={s.durum as never} />
                          </td>
                          <td className="text-right tabular-nums">{para(s.parcaToplam)}</td>
                          <td className="text-right tabular-nums">{para(s.iscilikToplam)}</td>
                          <td className="text-right tabular-nums font-medium">
                            {para(s.genelToplam)}
                          </td>
                          <td className="text-[0.6875rem]">
                            {s.faturaKesildi ? (
                              <span className="rounded-sm bg-basari-yumusak px-1.5 py-0.5 text-basari">
                                Kesildi
                              </span>
                            ) : (
                              <span className="rounded-sm bg-uyari-yumusak px-1.5 py-0.5 text-uyari">
                                Kesilmedi
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border font-medium">
                        <td colSpan={8} className="text-right">
                          {g.proje} toplamı
                        </td>
                        <td className="text-right tabular-nums">{para(g.parcaToplam)}</td>
                        <td className="text-right tabular-nums">{para(g.iscilikToplam)}</td>
                        <td className="text-right tabular-nums">{para(g.genelToplam)}</td>
                        <td className="text-[0.6875rem] text-uyari">
                          {g.faturasizToplam > 0 ? `${para(g.faturasizToplam)} faturasız` : ""}
                        </td>
                      </tr>
                    </tfoot>
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

function OzetKutusu({
  baslik,
  deger,
  vurgu,
}: {
  baslik: string
  deger: string
  vurgu?: boolean
}) {
  return (
    <div className="panel p-3">
      <p className="text-[0.6875rem] font-medium text-muted-foreground">{baslik}</p>
      <p
        className={`mt-1 text-[1.125rem] font-semibold tabular-nums ${vurgu ? "text-uyari" : ""}`}
      >
        {deger}
      </p>
    </div>
  )
}
