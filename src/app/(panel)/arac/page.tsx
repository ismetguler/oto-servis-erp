import type { Metadata } from "next"
import Link from "next/link"
import { Car, Plus } from "lucide-react"

import { aracDropdownlariGetir, aracFiltreSorgusu, aracListeKosulu } from "./veri"
import { AracFiltre } from "@/components/arac/arac-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { plaka, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Araç Listesi" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 50

type Aramalar = {
  q?: string
  marka?: string
  durum?: string
  sayfa?: string
}

export default async function AracListesi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const kullanici = await yetkiliOturum("arac", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const marka = p.marka ?? ""
  const durum = p.durum ?? "aktif"
  const sayfa = Math.max(1, Number(p.sayfa ?? 1) || 1)

  const kosul = aracListeKosulu({ q, marka, durum })

  const [toplam, kayitlar, { markalar }] = await Promise.all([
    prisma.arac.count({ where: kosul }),
    prisma.arac.findMany({
      where: kosul,
      orderBy: { plaka: "asc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        plaka: true,
        marka: true,
        model: true,
        modelYili: true,
        renk: true,
        sonKm: true,
        muayeneBitis: true,
        aktif: true,
        cariId: true,
        cari: { select: { unvan: true } },
      },
    }),
    aracDropdownlariGetir(),
  ])

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU))
  const ekleyebilir = yetkiVar(kullanici, "arac", "ekle")

  const sayfaYolu = (no: number) => {
    const parametre = new URLSearchParams()
    if (q) parametre.set("q", q)
    if (marka) parametre.set("marka", marka)
    if (durum !== "aktif") parametre.set("durum", durum)
    if (no > 1) parametre.set("sayfa", String(no))
    const metin = parametre.toString()
    return metin ? `/arac?${metin}` : "/arac"
  }

  const bugun = new Date()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Araç Listesi</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Servise gelen araçların kayıtları — {toplam} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/arac/disa-aktar${aracFiltreSorgusu({ q, marka, durum })}`} />
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/arac/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Araç
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <AracFiltre q={q} marka={marka} durum={durum} markalar={markalar} />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Car className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q || marka || durum !== "aktif"
                  ? "Bu ölçütlere uyan araç bulunamadı"
                  : "Henüz araç kaydı yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                {q || marka || durum !== "aktif"
                  ? "Arama kelimesini veya filtreleri değiştirip tekrar deneyin."
                  : "İlk aracı eklemek için sağ üstteki Yeni Araç düğmesini kullanın."}
              </p>
            </div>
          ) : (
            <>
              <div className="yazdirma-alani max-h-[calc(100svh-16rem)] overflow-auto">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Plaka</th>
                      <th>Marka / Model</th>
                      <th className="text-right">Yıl</th>
                      <th>Renk</th>
                      <th>Sahibi</th>
                      <th className="text-right">Son KM</th>
                      <th>Muayene</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map((a) => {
                      const muayeneGecmis = a.muayeneBitis ? a.muayeneBitis < bugun : false
                      return (
                        <tr key={a.id}>
                          <td className="font-mono text-[0.75rem]">
                            <Link href={`/arac/${a.id}`} className="text-primary hover:underline">
                              {plaka(a.plaka)}
                            </Link>
                          </td>
                          <td className="max-w-[16rem] truncate font-medium">
                            <Link href={`/arac/${a.id}`} className="hover:underline">
                              {[a.marka, a.model].filter(Boolean).join(" ") || "—"}
                            </Link>
                          </td>
                          <td className="text-right text-muted-foreground">
                            {a.modelYili ?? "—"}
                          </td>
                          <td className="text-muted-foreground">{a.renk ?? "—"}</td>
                          <td className="max-w-[14rem] truncate text-muted-foreground">
                            {a.cari ? (
                              <Link
                                href={`/cari/${a.cariId}`}
                                className="text-primary hover:underline"
                              >
                                {a.cari.unvan}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-right">
                            {a.sonKm ? a.sonKm.toLocaleString("tr-TR") : "—"}
                          </td>
                          <td
                            className={
                              muayeneGecmis ? "text-tehlike" : "text-muted-foreground"
                            }
                          >
                            {tarih(a.muayeneBitis)}
                          </td>
                          <td>
                            {durum === "silinen" ? (
                              <Rozet metin="Silinmiş" sinif="bg-muted text-muted-foreground" />
                            ) : !a.aktif ? (
                              <Rozet metin="Pasif" sinif="bg-uyari-yumusak text-uyari" />
                            ) : (
                              <Rozet metin="Aktif" sinif="bg-basari-yumusak text-basari" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {sonSayfa > 1 ? (
                <div className="yazdirma-disi flex items-center justify-between border-t border-border px-3 py-2 text-[0.8125rem]">
                  <span className="text-muted-foreground">
                    Sayfa {sayfa} / {sonSayfa}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild disabled={sayfa <= 1}>
                      <Link href={sayfaYolu(Math.max(1, sayfa - 1))}>Önceki</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={sayfa >= sonSayfa}
                    >
                      <Link href={sayfaYolu(Math.min(sonSayfa, sayfa + 1))}>Sonraki</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Rozet({ metin, sinif }: { metin: string; sinif: string }) {
  return (
    <span
      className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${sinif}`}
    >
      {metin}
    </span>
  )
}
