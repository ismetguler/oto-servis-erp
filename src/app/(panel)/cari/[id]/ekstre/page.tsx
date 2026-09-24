import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { gunSonu, para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Cari Ekstre" }
export const dynamic = "force-dynamic"

const HAREKET_ADI: Record<string, string> = {
  ACILIS: "Açılış",
  EVRAK: "Fatura",
  KABUL: "Servis",
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
  MAHSUP: "Mahsup",
}

/** Varsayılan aralık: içinde bulunduğumuz yılın başından bugüne. */
function varsayilanAralik() {
  const bugun = new Date()
  return {
    bas: `${bugun.getFullYear()}-01-01`,
    bit: bugun.toISOString().slice(0, 10),
  }
}

export default async function CariEkstre({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  await yetkiliOturum("cari", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const varsayilan = varsayilanAralik()
  const s = await searchParams
  const bas = s.bas || varsayilan.bas
  const bit = s.bit || varsayilan.bit

  const baslangic = new Date(`${bas}T00:00:00`)
  const bitis = gunSonu(new Date(`${bit}T00:00:00`))

  const cari = await prisma.cari.findUnique({
    where: { id: kayitId },
    select: {
      id: true,
      kod: true,
      unvan: true,
      vergiNo: true,
      vergiDair: true,
      telefon: true,
      gsm: true,
      adres: true,
      il: true,
      ilce: true,
      bakiye: true,
    },
  })
  if (!cari) notFound()

  const [firma, devirToplam, hareketler] = await Promise.all([
    prisma.firma.findFirst({ select: { unvan: true } }),
    // DEVİR: seçilen tarihten önceki her şeyin özeti. Ekstre bu satırla
    // başlamazsa "bakiye neden bu?" sorusu cevapsız kalır.
    prisma.cariHareket.aggregate({
      where: { cariId: kayitId, silindi: false, tarih: { lt: baslangic } },
      _sum: { borc: true, alacak: true },
    }),
    prisma.cariHareket.findMany({
      where: {
        cariId: kayitId,
        silindi: false,
        tarih: { gte: baslangic, lte: bitis },
      },
      orderBy: [{ tarih: "asc" }, { id: "asc" }],
      select: {
        id: true,
        tarih: true,
        tur: true,
        borc: true,
        alacak: true,
        aciklama: true,
        vadeTarihi: true,
      },
    }),
  ])

  // Aynı GÜN içindeki sıralama: "Açılış" hep en üstte, sonra kalan hareketler.
  // Neden: tahsilat/ödeme fişinin tarihi tarih seçiciden GÜN olarak (saat 00:00)
  // yazılıyor, açılış/servis hareketi ise `new Date()` ile o anki saatle. Ham
  // `tarih asc` sıralaması aynı gün tahsilatı, onu doğuran servis/açılış
  // satırından ÖNCE gösteriyordu — ekstre okunmaz hale geliyordu. Gün bazında
  // sıralayıp açılışı öne alınca yürüyen bakiye de mantıklı ilerliyor.
  const gunAnahtari = (d: Date) => new Date(d).toISOString().slice(0, 10)
  hareketler.sort((a, b) => {
    const gunFark = gunAnahtari(a.tarih).localeCompare(gunAnahtari(b.tarih))
    if (gunFark !== 0) return gunFark
    if (a.tur === "ACILIS" && b.tur !== "ACILIS") return -1
    if (b.tur === "ACILIS" && a.tur !== "ACILIS") return 1
    const saatFark = a.tarih.getTime() - b.tarih.getTime()
    if (saatFark !== 0) return saatFark
    return a.id - b.id
  })

  const devir =
    Number(devirToplam._sum.borc?.toString() ?? 0) -
    Number(devirToplam._sum.alacak?.toString() ?? 0)

  // Yürüyen bakiye: her satırda o ana kadarki durum — muhasebecinin
  // ekstrede ilk baktığı sütun. Her satır bir öncekinin bakiyesi üzerine
  // biniyor, bu yüzden reduce ile sırayla yürütülüyor.
  const satirlar = hareketler.reduce<
    Array<
      Omit<(typeof hareketler)[number], "borc" | "alacak"> & {
        // Decimal yerine sayı tutuluyor: yürüyen bakiye toplanarak ilerliyor.
        borc: number
        alacak: number
        yuruyen: number
      }
    >
  >((liste, h) => {
    const borc = Number(h.borc.toString())
    const alacak = Number(h.alacak.toString())
    const onceki = liste.at(-1)?.yuruyen ?? devir
    liste.push({ ...h, borc, alacak, yuruyen: onceki + borc - alacak })
    return liste
  }, [])

  const kapanis = satirlar.at(-1)?.yuruyen ?? devir
  const toplamBorc = satirlar.reduce((t, h) => t + h.borc, 0)
  const toplamAlacak = satirlar.reduce((t, h) => t + h.alacak, 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="yazdirma-disi">
            <Link href={`/cari/${cari.id}`} aria-label="Cari kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Cari Ekstre
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {cari.unvan} · <span className="font-mono">{cari.kod}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/cari/${cari.id}/ekstre/disa-aktar?bas=${bas}&bit=${bit}`}
          />
        </div>
      </div>

      {/* Tarih aralığı — GET formu, seçim adres çubuğunda kalsın */}
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
        <Button type="submit" size="sm">
          Getir
        </Button>
      </form>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {/* Döküm başlığı — kâğıda basıldığında kimin ekstresi olduğu belli olsun */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[0.9375rem] font-semibold">
                  {firma?.unvan ?? ""}
                </div>
                <div className="text-[0.75rem] text-muted-foreground">
                  Cari Hesap Ekstresi · {tarih(baslangic)} — {tarih(bitis)}
                </div>
              </div>
              <div className="text-[0.75rem]">
                <div className="font-medium">{cari.unvan}</div>
                <div className="text-muted-foreground">
                  {cari.vergiNo ? `VKN/TCKN: ${cari.vergiNo}` : ""}
                  {cari.vergiDair ? ` · ${cari.vergiDair}` : ""}
                </div>
                <div className="text-muted-foreground">
                  {[cari.adres, cari.ilce, cari.il].filter(Boolean).join(" / ")}
                </div>
                <div className="text-muted-foreground">
                  {cari.gsm ?? cari.telefon ?? ""}
                </div>
              </div>
            </div>
          </div>

          <div className="yazdirma-alani overflow-x-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-24">Tarih</th>
                  <th className="w-28">Tür</th>
                  <th>Açıklama</th>
                  <th className="w-24">Vade</th>
                  <th className="w-32 text-right">Borç</th>
                  <th className="w-32 text-right">Alacak</th>
                  <th className="w-32 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-secondary/40 font-medium">
                  <td>{tarih(baslangic)}</td>
                  <td className="text-muted-foreground">Devir</td>
                  <td>Önceki dönemden devreden bakiye</td>
                  <td />
                  <td className="text-right">{devir > 0 ? para(devir) : "—"}</td>
                  <td className="text-right">
                    {devir < 0 ? para(Math.abs(devir)) : "—"}
                  </td>
                  <td className="text-right">{para(Math.abs(devir))}</td>
                </tr>

                {satirlar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      Bu tarih aralığında hareket yok.
                    </td>
                  </tr>
                ) : (
                  satirlar.map((h) => (
                    <tr key={h.id}>
                      <td>{tarih(h.tarih)}</td>
                      <td className="text-muted-foreground">
                        {HAREKET_ADI[h.tur] ?? h.tur}
                      </td>
                      <td className="max-w-[24rem] truncate">{h.aciklama ?? "—"}</td>
                      <td>{h.vadeTarihi ? tarih(h.vadeTarihi) : "—"}</td>
                      <td className="text-right">{h.borc ? para(h.borc) : "—"}</td>
                      <td className="text-right">{h.alacak ? para(h.alacak) : "—"}</td>
                      <td className="text-right font-medium">
                        {para(Math.abs(h.yuruyen))}
                        <span className="ml-1 text-[0.6875rem] text-muted-foreground">
                          {h.yuruyen > 0 ? "B" : h.yuruyen < 0 ? "A" : ""}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Dönem Toplamı
                  </td>
                  <td className="px-3 py-2 text-right">{para(toplamBorc)}</td>
                  <td className="px-3 py-2 text-right">{para(toplamAlacak)}</td>
                  <td className="px-3 py-2 text-right">
                    {para(Math.abs(kapanis))}
                    <span className="ml-1 text-[0.6875rem]">
                      {kapanis > 0 ? "BORÇ" : kapanis < 0 ? "ALACAK" : ""}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <p className="mt-2 text-[0.75rem] text-muted-foreground">
          <strong>B</strong> = borçlu bakiye (tahsil edilecek) · <strong>A</strong> ={" "}
          alacaklı bakiye (cariye ödenecek)
        </p>
      </div>
    </div>
  )
}
