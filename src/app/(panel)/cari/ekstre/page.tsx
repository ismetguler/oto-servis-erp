import type { Metadata } from "next"
import Link from "next/link"
import { FileText, Search } from "lucide-react"

import { CARI_TUR_ADLARI } from "../sema"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Cari Ekstre" }
export const dynamic = "force-dynamic"

/**
 * EKSTRE ALINACAK CARİYİ SEÇ
 *
 * Ekstre tek bir cariye ait olduğu için önce hangi cari sorusu cevaplanmalı.
 * Menüden "Cari Ekstre"ye tıklayan kullanıcıyı boş bir ekranla karşılamak
 * yerine, arayıp seçebileceği kısa bir liste veriliyor.
 */
export default async function EkstreCariSec({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await yetkiliOturum("cari", "gor")

  const { q = "" } = await searchParams
  const arama = q.trim()

  const kayitlar = await prisma.cari.findMany({
    where: {
      silindi: false,
      ...(arama
        ? {
            OR: [
              { unvan: { contains: arama, mode: "insensitive" } },
              { kod: { contains: arama, mode: "insensitive" } },
              { vergiNo: { contains: arama } },
            ],
          }
        : {}),
    },
    orderBy: { unvan: "asc" },
    take: 100,
    select: {
      id: true,
      kod: true,
      unvan: true,
      turu: true,
      vergiNo: true,
      bakiye: true,
    },
  })

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Ekstre</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Hesap dökümünü görmek istediğiniz cariyi seçin
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/cari/mizan">Cari Devir ve Bakiye</Link>
        </Button>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani min-w-[18rem] flex-1">
          <label htmlFor="q" className="form-etiket">
            Cari Ara
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="q"
              name="q"
              defaultValue={arama}
              autoFocus
              placeholder="Ünvan, kod veya vergi no…"
              className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>
        </div>
        <Button type="submit" size="sm">
          Ara
        </Button>
      </form>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <FileText className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Cari bulunamadı</p>
              <p className="text-[0.8125rem] text-muted-foreground">
                Arama kelimesini değiştirip tekrar deneyin.
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100svh-16rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th className="w-28">Kod</th>
                    <th>Ünvan</th>
                    <th className="w-28">Tür</th>
                    <th className="w-32">VKN / TCKN</th>
                    <th className="w-32 text-right">Bakiye</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((c) => {
                    const bakiye = Number(c.bakiye.toString())
                    return (
                      <tr key={c.id}>
                        <td className="font-mono text-[0.75rem]">{c.kod}</td>
                        <td className="max-w-[24rem] truncate font-medium">
                          {c.unvan}
                        </td>
                        <td className="text-muted-foreground">
                          {CARI_TUR_ADLARI[c.turu]}
                        </td>
                        <td className="font-mono text-[0.75rem]">
                          {c.vergiNo ?? "—"}
                        </td>
                        <td
                          className={
                            bakiye > 0
                              ? "text-right font-medium text-tehlike"
                              : bakiye < 0
                                ? "text-right font-medium text-basari"
                                : "text-right text-muted-foreground"
                          }
                        >
                          {para(Math.abs(bakiye))}
                        </td>
                        <td className="text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/cari/${c.id}/ekstre`}>Ekstre</Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {kayitlar.length === 100 ? (
          <p className="mt-2 text-[0.75rem] text-muted-foreground">
            İlk 100 kayıt gösteriliyor — aramayı daraltın.
          </p>
        ) : null}
      </div>
    </div>
  )
}
