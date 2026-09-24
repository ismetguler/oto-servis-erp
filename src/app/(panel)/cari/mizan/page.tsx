import type { Metadata } from "next"
import Link from "next/link"
import { Scale } from "lucide-react"

import { CARI_TUR_ADLARI } from "../sema"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { gunSonu, para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Cari Devir ve Bakiye" }
export const dynamic = "force-dynamic"

type Aramalar = {
  bas?: string
  bit?: string
  tur?: string
  sifir?: string
}

/**
 * CARİ MİZAN
 *
 * Tüm carilerin tek tabloda devir / dönem borç / dönem alacak / bakiye
 * özeti. Muhasebecinin dönem kapanışında baktığı ekran budur; alttaki
 * genel toplam satırı "kasa tutuyor mu" sorusunun cevabıdır.
 */
export default async function CariMizan({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("cari", "gor")

  const bugun = new Date()
  const s = await searchParams
  const bas = s.bas || `${bugun.getFullYear()}-01-01`
  const bit = s.bit || bugun.toISOString().slice(0, 10)
  const tur = s.tur ?? ""
  const sifirGoster = s.sifir === "1"

  const baslangic = new Date(`${bas}T00:00:00`)
  const bitis = gunSonu(new Date(`${bit}T00:00:00`))

  const cariKosulu = {
    silindi: false,
    ...(tur ? { turu: tur as "MUSTERI" } : {}),
  }

  const [firma, cariler, devirler, donemler] = await Promise.all([
    prisma.firma.findFirst({ select: { unvan: true } }),
    prisma.cari.findMany({
      where: cariKosulu,
      orderBy: { unvan: "asc" },
      select: { id: true, kod: true, unvan: true, turu: true },
    }),
    // Devir ve dönem ayrı ayrı toplanıyor: mizanın anlamı "geçen dönemden
    // ne geldi, bu dönemde ne oldu, sonuç ne" üçlüsünü yan yana görmek.
    prisma.cariHareket.groupBy({
      by: ["cariId"],
      where: { silindi: false, tarih: { lt: baslangic } },
      _sum: { borc: true, alacak: true },
    }),
    prisma.cariHareket.groupBy({
      by: ["cariId"],
      where: { silindi: false, tarih: { gte: baslangic, lte: bitis } },
      _sum: { borc: true, alacak: true },
    }),
  ])

  const devirHaritasi = new Map(
    devirler.map((d) => [
      d.cariId,
      Number(d._sum.borc?.toString() ?? 0) - Number(d._sum.alacak?.toString() ?? 0),
    ])
  )
  const donemHaritasi = new Map(
    donemler.map((d) => [
      d.cariId,
      {
        borc: Number(d._sum.borc?.toString() ?? 0),
        alacak: Number(d._sum.alacak?.toString() ?? 0),
      },
    ])
  )

  const satirlar = cariler
    .map((c) => {
      const devir = devirHaritasi.get(c.id) ?? 0
      const donem = donemHaritasi.get(c.id) ?? { borc: 0, alacak: 0 }
      return { ...c, devir, ...donem, bakiye: devir + donem.borc - donem.alacak }
    })
    // Hiç hareketi olmayan cariler mizanı gereksiz uzatır; isteyen açabilir.
    .filter((r) => sifirGoster || r.devir !== 0 || r.borc !== 0 || r.alacak !== 0)

  const toplam = satirlar.reduce(
    (t, r) => ({
      devir: t.devir + r.devir,
      borc: t.borc + r.borc,
      alacak: t.alacak + r.alacak,
      bakiye: t.bakiye + r.bakiye,
    }),
    { devir: 0, borc: 0, alacak: 0, bakiye: 0 }
  )

  const sorgu = new URLSearchParams({ bas, bit })
  if (tur) sorgu.set("tur", tur)
  if (sifirGoster) sorgu.set("sifir", "1")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Devir ve Bakiye</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Devir, dönem borç/alacak ve kalan bakiye — muhasebedeki adıyla
            &ldquo;cari mizan&rdquo; · {tarih(baslangic)} — {tarih(bitis)} ·{" "}
            {satirlar.length} cari
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/cari/mizan/disa-aktar?${sorgu.toString()}`} />
        </div>
      </div>

      <form
        method="get"
        className="yazdirma-disi flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Başlangıç
          </label>
          <input
            id="bas"
            name="bas"
            type="date"
            defaultValue={bas}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Bitiş
          </label>
          <input
            id="bit"
            name="bit"
            type="date"
            defaultValue={bit}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
        <div className="form-alani">
          <label htmlFor="tur" className="form-etiket">
            Tür
          </label>
          <select
            id="tur"
            name="tur"
            defaultValue={tur}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Tümü</option>
            {Object.entries(CARI_TUR_ADLARI).map(([deger, ad]) => (
              <option key={deger} value={deger}>
                {ad}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-8 items-center gap-2 text-[0.8125rem]">
          <input
            name="sifir"
            type="checkbox"
            value="1"
            defaultChecked={sifirGoster}
            className="size-4 accent-primary"
          />
          Hareketsizleri de göster
        </label>
        <Button type="submit" size="sm">
          Getir
        </Button>
      </form>

      <div className="p-4">
        <div className="panel overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[0.9375rem] font-semibold">{firma?.unvan ?? ""}</div>
            <div className="text-[0.75rem] text-muted-foreground">
              Cari Devir ve Bakiye · {tarih(baslangic)} — {tarih(bitis)}
            </div>
          </div>

          {satirlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Scale className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                Bu aralıkta hareketli cari yok
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Tarih aralığını genişletin veya &quot;Hareketsizleri de
                göster&quot; seçeneğini işaretleyin.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-19rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th className="w-28">Kod</th>
                    <th>Ünvan</th>
                    <th className="w-28">Tür</th>
                    <th className="w-32 text-right">Devir</th>
                    <th className="w-32 text-right">Dönem Borç</th>
                    <th className="w-32 text-right">Dönem Alacak</th>
                    <th className="w-36 text-right">Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-[0.75rem]">
                        <Link
                          href={`/cari/${r.id}/ekstre?bas=${bas}&bit=${bit}`}
                          className="text-primary hover:underline"
                        >
                          {r.kod}
                        </Link>
                      </td>
                      <td className="max-w-[22rem] truncate font-medium">{r.unvan}</td>
                      <td className="text-muted-foreground">
                        {CARI_TUR_ADLARI[r.turu]}
                      </td>
                      <td className="text-right">
                        {r.devir ? para(Math.abs(r.devir)) : "—"}
                      </td>
                      <td className="text-right">{r.borc ? para(r.borc) : "—"}</td>
                      <td className="text-right">{r.alacak ? para(r.alacak) : "—"}</td>
                      <td
                        className={
                          r.bakiye > 0
                            ? "text-right font-medium text-tehlike"
                            : r.bakiye < 0
                              ? "text-right font-medium text-basari"
                              : "text-right text-muted-foreground"
                        }
                      >
                        {para(Math.abs(r.bakiye))}
                        <span className="ml-1 text-[0.6875rem] text-muted-foreground">
                          {r.bakiye > 0 ? "B" : r.bakiye < 0 ? "A" : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right">
                      GENEL TOPLAM
                    </td>
                    <td className="px-3 py-2 text-right">
                      {para(Math.abs(toplam.devir))}
                    </td>
                    <td className="px-3 py-2 text-right">{para(toplam.borc)}</td>
                    <td className="px-3 py-2 text-right">{para(toplam.alacak)}</td>
                    <td className="px-3 py-2 text-right">
                      {para(Math.abs(toplam.bakiye))}
                      <span className="ml-1 text-[0.6875rem]">
                        {toplam.bakiye > 0 ? "BORÇ" : toplam.bakiye < 0 ? "ALACAK" : ""}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
