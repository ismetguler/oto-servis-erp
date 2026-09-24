import type { Metadata } from "next"
import Link from "next/link"
import { FilePlus2 } from "lucide-react"

import { alisEvraklariGetir } from "./veri"
import { EvrakDurumRozeti } from "@/components/evrak/durum-rozeti"
import { DisaAktarDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Alış Evrakları" }
export const dynamic = "force-dynamic"

type Aramalar = { q?: string; durum?: string; bas?: string; bit?: string }

/** Alış fatura listesi — Satış Evrakları listesindeki desenin aynısı. */
export default async function AlisEvraklari({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("evrak", "gor")
  const f = await searchParams
  const evraklar = await alisEvraklariGetir(f)

  const genelToplam = evraklar
    .filter((e) => e.durum === "KESILDI")
    .reduce((t, e) => t + Number(e.genelToplam.toString()), 0)

  const disaAktarSorgu = new URLSearchParams(
    Object.entries(f).filter(([, v]) => v) as [string, string][]
  ).toString()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1rem] font-semibold">Alış Evrakları</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {evraklar.length} fatura · kesilmiş toplam {para(genelToplam)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DisaAktarDugmesi
            yol={`/evrak/alis/disa-aktar${disaAktarSorgu ? `?${disaAktarSorgu}` : ""}`}
          />
          <Button size="sm" asChild>
            <Link href="/evrak/alis/yeni">
              <FilePlus2 className="size-4" aria-hidden />
              Yeni Alış Faturası
            </Link>
          </Button>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2 panel p-3">
        <FiltreAlani ad="q" etiket="Ara" tip="text" deger={f.q} yerTutucu="fatura no / cari" />
        <div className="form-alani">
          <label className="form-etiket" htmlFor="durum">
            Durum
          </label>
          <select
            id="durum"
            name="durum"
            defaultValue={f.durum ?? ""}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem]"
          >
            <option value="">Tümü</option>
            <option value="TASLAK">Taslak</option>
            <option value="KESILDI">Kesildi</option>
            <option value="IPTAL">İptal</option>
          </select>
        </div>
        <FiltreAlani ad="bas" etiket="Başlangıç" tip="date" deger={f.bas} />
        <FiltreAlani ad="bit" etiket="Bitiş" tip="date" deger={f.bit} />
        <Button type="submit" size="sm" variant="secondary">
          Filtrele
        </Button>
      </form>

      <div className="panel overflow-hidden">
        <div className="overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Fatura No</th>
                <th>Tür</th>
                <th>Tarih</th>
                <th>Tedarikçi</th>
                <th className="text-right">Genel Toplam</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {evraklar.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={`/evrak/alis/${e.id}`}
                      className="font-mono text-[0.75rem] text-primary hover:underline"
                    >
                      {e.evrakNo}
                    </Link>
                  </td>
                  <td className="text-[0.75rem] text-muted-foreground">
                    {e.tur === "IADE_ALIS" ? "İade Faturası" : "Alış Faturası"}
                  </td>
                  <td className="text-muted-foreground">{tarih(e.tarih)}</td>
                  <td>
                    {e.cari.unvan}
                    <span className="ml-1 text-muted-foreground">({e.cari.kod})</span>
                  </td>
                  <td className="text-right tabular-nums">{para(Number(e.genelToplam.toString()), false)}</td>
                  <td>
                    <EvrakDurumRozeti durum={e.durum} />
                  </td>
                </tr>
              ))}
              {evraklar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Henüz alış faturası oluşturulmamış.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FiltreAlani({
  ad,
  etiket,
  tip,
  deger,
  yerTutucu,
}: {
  ad: string
  etiket: string
  tip: string
  deger?: string
  yerTutucu?: string
}) {
  return (
    <div className="form-alani">
      <label className="form-etiket" htmlFor={ad}>
        {etiket}
      </label>
      <input
        id={ad}
        name={ad}
        type={tip}
        defaultValue={deger ?? ""}
        placeholder={yerTutucu}
        className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem]"
      />
    </div>
  )
}
