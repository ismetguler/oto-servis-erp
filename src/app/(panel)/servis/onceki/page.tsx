import type { Metadata } from "next"
import Link from "next/link"
import { History, Search, Wrench } from "lucide-react"

import { gecmisiOlanAraclar, oncekiOnarimlar } from "./veri"
import { DurumRozeti } from "@/components/kabul/kabul-listesi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { miktar, para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Önceki Onarımlar" }
export const dynamic = "force-dynamic"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

type Aramalar = { q?: string; aracId?: string; cariId?: string; haric?: string }

const sayiya = (d?: string) => {
  const n = Number(d)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/**
 * ÖNCEKİ ONARIMLAR — Selpar'daki aynı isimli ekran.
 *
 * "Tüm Kabuller" listesinden ayrı duruyor çünkü sorusu farklı: orada kart
 * arıyorsun, burada bir aracın/müşterinin GEÇMİŞİNE bakıyorsun. Bu yüzden
 * satırlar kalemleriyle birlikte açılıyor ve gelişler arası km farkı
 * gösteriliyor — periyodik bakım aralığı ancak böyle görülüyor.
 */
export default async function OncekiOnarimlar({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("kabul", "gor")

  const p = await searchParams
  const q = p.q ?? ""
  const aracId = sayiya(p.aracId)
  const cariId = sayiya(p.cariId)
  const haricId = sayiya(p.haric)
  const seciliVar = Boolean(aracId || cariId)

  const [adaylar, kayitlar, arac, cari] = await Promise.all([
    seciliVar ? Promise.resolve([]) : gecmisiOlanAraclar(q),
    oncekiOnarimlar({ aracId, cariId, haricId }),
    aracId
      ? prisma.arac.findUnique({
          where: { id: aracId },
          select: {
            id: true,
            plaka: true,
            marka: true,
            model: true,
            modelYili: true,
            sonKm: true,
            cari: { select: { id: true, unvan: true } },
          },
        })
      : Promise.resolve(null),
    cariId
      ? prisma.cari.findUnique({ where: { id: cariId }, select: { id: true, unvan: true } })
      : Promise.resolve(null),
  ])

  const toplamTutar = kayitlar.reduce((t, k) => t + k.genelToplam, 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
            <History className="size-4 text-muted-foreground" aria-hidden />
            Önceki Onarımlar
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {arac
              ? `${plakaBicim(arac.plaka)} · ${[arac.marka, arac.model].filter(Boolean).join(" ") || "—"} · ${arac.cari?.unvan ?? "sahipsiz"}`
              : cari
                ? `${cari.unvan} — tüm araçların servis geçmişi`
                : "Bir aracın ya da müşterinin geçmiş servis kayıtları"}
          </p>
        </div>
        {seciliVar ? (
          <div className="flex items-center gap-2">
            {arac ? (
              <Link href={`/arac/${arac.id}`} className="text-[0.8125rem] text-primary hover:underline">
                Araç kartı
              </Link>
            ) : null}
            <Link href="/servis/onceki" className="text-[0.8125rem] text-primary hover:underline">
              Başka araç
            </Link>
            <YazdirDugmesi />
          </div>
        ) : null}
      </div>

      {!seciliVar ? (
        <>
          <form
            method="get"
            action="/servis/onceki"
            className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
          >
            <div className="form-alani min-w-[18rem] flex-1">
              <label htmlFor="q" className="form-etiket">
                Araç ara
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
                  placeholder="Plaka, şase, marka/model veya müşteri…"
                  className={`${ALAN} w-full pl-7`}
                />
              </div>
            </div>
            <button type="submit" className="h-8 rounded-sm bg-primary px-3 text-[0.8125rem] font-medium text-primary-foreground">
              Ara
            </button>
          </form>

          {q.trim() === "" ? (
            <p className="px-4 py-10 text-center text-[0.8125rem] text-muted-foreground">
              Geçmişini görmek istediğin aracı arat.
            </p>
          ) : adaylar.length === 0 ? (
            <p className="px-4 py-10 text-center text-[0.8125rem] text-muted-foreground">
              Aramaya uyan araç bulunamadı.
            </p>
          ) : (
            <div className="p-4">
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Plaka</th>
                      <th>Araç</th>
                      <th>Sahibi</th>
                      <th className="text-right">Son KM</th>
                      <th className="text-right">Kabul</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {adaylar.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono">{plakaBicim(a.plaka)}</td>
                        <td>{[a.marka, a.model].filter(Boolean).join(" ") || "—"}</td>
                        <td>{a.cari?.unvan ?? "—"}</td>
                        <td className="text-right tabular-nums">
                          {a.sonKm !== null ? miktar(a.sonKm) : "—"}
                        </td>
                        <td className="text-right tabular-nums">{a._count.kabuller}</td>
                        <td className="text-right">
                          <Link
                            href={`/servis/onceki?aracId=${a.id}`}
                            className="text-[0.8125rem] text-primary hover:underline"
                          >
                            Geçmişi aç
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : kayitlar.length === 0 ? (
        <p className="px-4 py-10 text-center text-[0.8125rem] text-muted-foreground">
          Bu araç/müşteri için önceki onarım kaydı yok.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border bg-card px-4 py-2 text-[0.8125rem]">
            <span>
              <span className="text-muted-foreground">Kayıt: </span>
              <b className="tabular-nums">{kayitlar.length}</b>
            </span>
            <span>
              <span className="text-muted-foreground">Toplam tutar: </span>
              <b className="tabular-nums">{para(toplamTutar)}</b>
            </span>
            {arac?.sonKm != null ? (
              <span>
                <span className="text-muted-foreground">Aracın son KM değeri: </span>
                <b className="tabular-nums">{miktar(arac.sonKm)}</b>
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 p-4">
            {kayitlar.map((k) => (
              <details key={k.id} open className="rounded-sm border border-border bg-card">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[0.8125rem]">
                  <span className="font-mono font-semibold">{k.kabulNo}</span>
                  <DurumRozeti durum={k.durum} />
                  <span className="text-muted-foreground">{tarih(k.girisTarihi)}</span>
                  {!aracId ? (
                    <span className="font-mono">{plakaBicim(k.arac.plaka)}</span>
                  ) : null}
                  <span className="tabular-nums text-muted-foreground">
                    {k.girisKm !== null ? `${miktar(k.girisKm)} km` : "km yok"}
                    {k.kmFarki !== null ? ` (+${miktar(k.kmFarki)})` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {[k.istekTuru, k.bakimSekli].filter(Boolean).join(" · ")}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <b className="tabular-nums">{para(k.genelToplam)}</b>
                    <Link
                      href={`/servis/kabul/${k.id}`}
                      className="text-[0.75rem] text-primary hover:underline yazdirma-disi"
                    >
                      Kartı aç
                    </Link>
                  </span>
                </summary>

                <div className="border-t border-border px-3 py-2 text-[0.8125rem]">
                  {k.sikayet ? (
                    <p className="mb-1">
                      <span className="text-muted-foreground">Şikâyet: </span>
                      {k.sikayet}
                    </p>
                  ) : null}
                  {k.yapilanIsler ? (
                    <p className="mb-1">
                      <span className="text-muted-foreground">Yapılan işler: </span>
                      {k.yapilanIsler}
                    </p>
                  ) : null}

                  {k.kalemler.length === 0 ? (
                    <p className="py-2 text-muted-foreground">Bu kartta kalem yok.</p>
                  ) : (
                    <div className="tablo-sarmal">
                      <table className="veri-tablosu mt-1">
                        <thead>
                          <tr>
                            <th className="w-24">Tür</th>
                            <th>Açıklama</th>
                            <th className="w-28 text-right">Miktar</th>
                            <th className="w-28 text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {k.kalemler.map((s) => (
                            <tr key={s.id}>
                              <td className="text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Wrench className="size-3" aria-hidden />
                                  {s.tur === "PARCA"
                                    ? "Parça"
                                    : s.tur === "ISCILIK"
                                      ? "İşçilik"
                                      : "Dış hizmet"}
                                </span>
                              </td>
                              <td>
                                {s.aciklama}
                                {s.garantili ? (
                                  <span className="ml-1.5 rounded-sm bg-muted px-1 py-0.5 text-[0.6875rem]">
                                    GARANTİ
                                  </span>
                                ) : null}
                              </td>
                              <td className="text-right tabular-nums">
                                {miktar(s.miktar)} {s.birim}
                              </td>
                              <td className="text-right tabular-nums">{para(s.toplam)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
