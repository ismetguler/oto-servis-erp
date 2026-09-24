import type { Metadata } from "next"
import Link from "next/link"
import { PackageSearch, Search } from "lucide-react"

import { acikKabulleriGetir } from "./veri"
import { DurumRozeti } from "@/components/kabul/kabul-listesi"
import { Button } from "@/components/ui/button"
import { para, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Servise Parça Çıkışı" }
export const dynamic = "force-dynamic"

/**
 * KABUL PARÇA ÇIKIŞI — 1. adım: kart seçimi
 *
 * Depocu genelde elinde plakayla geliyor, bu yüzden arama kutusu plaka,
 * kabul no ve müşteri unvanını birden tarıyor ve odak doğrudan bu kutuda
 * açılıyor. Tek sonuç kalınca Enter'a basmak yeterli olsun diye liste
 * satırları da klavyeyle gezilebilen bağlantılar.
 */
export default async function ParcaCikisSecim({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await yetkiliOturum("kabul", "duzelt")
  const p = await searchParams
  const q = (p.q ?? "").trim()

  const kabuller = await acikKabulleriGetir(q)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Servise Parça Çıkışı
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Parçanın çıkılacağı açık kabul kartını seçin — {kabuller.length} kart
          </p>
        </div>
      </div>

      <form
        method="get"
        action="/servis/parca-cikis"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani min-w-[18rem] flex-1">
          <label htmlFor="q" className="form-etiket">
            Kabul no / Plaka / Müşteri
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="q"
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="34ABC123, K2026-00012, Ahmet Yılmaz…"
              className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>
        </div>
        <Button type="submit" size="sm">
          Ara
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/servis/parca-cikis">Temizle</Link>
        </Button>
      </form>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kabuller.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <PackageSearch className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q ? "Bu aramaya uyan açık kabul yok" : "Açık kabul kartı yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Parça çıkışı yalnızca teslim edilmemiş kartlara yapılabilir.
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100svh-16rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kabul No</th>
                    <th>Plaka</th>
                    <th>Araç</th>
                    <th>Müşteri</th>
                    <th>Giriş</th>
                    <th className="text-right">Satır</th>
                    <th className="text-right">Parça Toplamı</th>
                    <th>Durum</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {kabuller.map((k) => (
                    <tr key={k.id}>
                      <td className="font-mono text-[0.75rem]">
                        <Link
                          href={`/servis/parca-cikis/${k.id}`}
                          className="text-primary hover:underline"
                        >
                          {k.kabulNo}
                        </Link>
                      </td>
                      <td className="font-medium">
                        <Link href={`/arac/${k.arac.id}`} className="text-primary hover:underline">
                          {k.arac.plaka}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">
                        {[k.arac.marka, k.arac.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td>
                        <Link href={`/cari/${k.cari.id}`} className="text-primary hover:underline">
                          {k.cari.unvan}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{tarihSaat(k.girisTarihi)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {k._count.kalemler}
                      </td>
                      <td className="text-right tabular-nums">{para(k.parcaToplam)}</td>
                      <td>
                        <DurumRozeti durum={k.durum} />
                      </td>
                      <td className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/servis/parca-cikis/${k.id}`}>Parça Çık</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
