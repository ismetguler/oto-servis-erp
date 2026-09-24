import type { Metadata } from "next"
import Link from "next/link"
import { Layers, Pencil, Plus, Wrench } from "lucide-react"

import { iscilikBolumleriGetir, iscilikFiltreSorgusu, iscilikListeKosulu } from "./veri"
import { IscilikFiltre } from "@/components/iscilik/iscilik-filtre"
import { IscilikSilDugmesi } from "@/components/iscilik/iscilik-sil-dugmesi"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "İşçilik Kataloğu" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 50

type Aramalar = {
  q?: string
  bolum?: string
  durum?: string
  sayfa?: string
}

export default async function IscilikListesi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const kullanici = await yetkiliOturum("iscilik", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const bolum = p.bolum ?? ""
  const durum = p.durum ?? "aktif"
  const sayfa = Math.max(1, Number(p.sayfa ?? 1) || 1)

  const kosul = iscilikListeKosulu({ q, bolum, durum })

  const [toplam, kayitlar, bolumler] = await Promise.all([
    prisma.iscilik.count({ where: kosul }),
    prisma.iscilik.findMany({
      where: kosul,
      orderBy: [{ ad: "asc" }],
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        kod: true,
        ad: true,
        sure: true,
        fiyat: true,
        kdvOrani: true,
        aktif: true,
        silindi: true,
        bolum: { select: { ad: true } },
        _count: { select: { kabulKalemleri: true } },
      },
    }),
    iscilikBolumleriGetir(),
  ])

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU))
  const ekleyebilir = yetkiVar(kullanici, "iscilik", "ekle")
  const duzeltebilir = yetkiVar(kullanici, "iscilik", "duzelt")
  const silebilir = yetkiVar(kullanici, "iscilik", "sil")

  const sayfaYolu = (no: number) => {
    const parametre = new URLSearchParams()
    if (q) parametre.set("q", q)
    if (bolum) parametre.set("bolum", bolum)
    if (durum !== "aktif") parametre.set("durum", durum)
    if (no > 1) parametre.set("sayfa", String(no))
    const metin = parametre.toString()
    return metin ? `/iscilik?${metin}` : "/iscilik"
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">İşçilik Kataloğu</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Kabul kartına eklenen hazır işçilik tanımları — {toplam} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/iscilik/disa-aktar${iscilikFiltreSorgusu({ q, bolum, durum })}`}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href="/iscilik/bolum">
              <Layers className="size-4" aria-hidden />
              Bölümler
            </Link>
          </Button>
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/iscilik/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni İşçilik
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <IscilikFiltre q={q} bolum={bolum} durum={durum} bolumler={bolumler} />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Wrench className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q || bolum || durum !== "aktif"
                  ? "Bu ölçütlere uyan işçilik bulunamadı"
                  : "Henüz işçilik tanımı yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                {q || bolum || durum !== "aktif"
                  ? "Arama kelimesini veya filtreleri değiştirip tekrar deneyin."
                  : "Sık yapılan işleri buraya bir kez tanımlarsanız, kabul kartında tek tıkla eklenir."}
              </p>
            </div>
          ) : (
            <>
              <div className="yazdirma-alani max-h-[calc(100svh-16rem)] overflow-auto">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>İşçilik Adı</th>
                      <th>Bölüm</th>
                      <th className="text-right">Süre (sa)</th>
                      <th className="text-right">Birim Fiyat</th>
                      <th className="text-right">KDV %</th>
                      <th className="text-right">Kullanım</th>
                      <th>Durum</th>
                      <th className="yazdirma-disi text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map((i) => (
                      <tr key={i.id}>
                        <td className="font-mono text-[0.75rem]">
                          {duzeltebilir ? (
                            <Link
                              href={`/iscilik/${i.id}/duzenle`}
                              className="text-primary hover:underline"
                            >
                              {i.kod}
                            </Link>
                          ) : (
                            i.kod
                          )}
                        </td>
                        <td className="max-w-[24rem] truncate font-medium">{i.ad}</td>
                        <td className="text-muted-foreground">{i.bolum?.ad ?? "—"}</td>
                        <td className="text-right tabular-nums">{miktar(i.sure)}</td>
                        <td className="text-right tabular-nums">{para(i.fiyat)}</td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {miktar(i.kdvOrani)}
                        </td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {i._count.kabulKalemleri}
                        </td>
                        <td>
                          {i.silindi ? (
                            <Rozet metin="Silinmiş" sinif="bg-muted text-muted-foreground" />
                          ) : i.aktif ? (
                            <Rozet metin="Aktif" sinif="bg-basari-yumusak text-basari" />
                          ) : (
                            <Rozet metin="Pasif" sinif="bg-uyari-yumusak text-uyari" />
                          )}
                        </td>
                        <td className="yazdirma-disi">
                          <div className="flex items-center justify-end gap-1">
                            {duzeltebilir && !i.silindi ? (
                              <Button variant="ghost" size="icon" asChild title="Düzenle">
                                <Link
                                  href={`/iscilik/${i.id}/duzenle`}
                                  aria-label={`${i.ad} kaydını düzenle`}
                                >
                                  <Pencil className="size-4" aria-hidden />
                                </Link>
                              </Button>
                            ) : null}
                            {silebilir ? (
                              <IscilikSilDugmesi id={i.id} silinmis={i.silindi} ad={i.ad} />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
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
                    <Button variant="outline" size="sm" asChild disabled={sayfa >= sonSayfa}>
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
