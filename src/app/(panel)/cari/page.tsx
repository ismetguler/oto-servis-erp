import type { Metadata } from "next"
import Link from "next/link"
import { Plus, Users } from "lucide-react"

import { CARI_TUR_ADLARI } from "./sema"
import { cariFiltreSorgusu, cariListeKosulu, filtreSecenekleriGetir } from "./veri"
import { CariFiltre } from "@/components/cari/cari-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Cari Listesi" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 50

type Aramalar = {
  q?: string
  tur?: string
  durum?: string
  plasiyer?: string
  sayfa?: string
}

export default async function CariListesi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const kullanici = await yetkiliOturum("cari", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const tur = p.tur ?? ""
  const durum = p.durum ?? "aktif"
  const plasiyer = p.plasiyer ?? ""
  const sayfa = Math.max(1, Number(p.sayfa ?? 1) || 1)

  const kosul = cariListeKosulu({ q, tur, durum, plasiyer })

  const [toplam, kayitlar, ozet, secenekler] = await Promise.all([
    prisma.cari.count({ where: kosul }),
    prisma.cari.findMany({
      where: kosul,
      orderBy: { unvan: "asc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        kod: true,
        unvan: true,
        turu: true,
        tipi: true,
        vergiNo: true,
        telefon: true,
        gsm: true,
        il: true,
        bakiye: true,
        aktif: true,
        karaListe: true,
        plasiyer: { select: { unvan: true } },
        _count: { select: { araclar: true } },
      },
    }),
    // Alt toplam satırı: filtrelenmiş listenin bakiye özeti.
    prisma.cari.aggregate({ where: kosul, _sum: { bakiye: true } }),
    filtreSecenekleriGetir(),
  ])

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU))
  const ekleyebilir = yetkiVar(kullanici, "cari", "ekle")

  /** Sayfa değiştirirken mevcut filtreleri koru. */
  const sayfaYolu = (no: number) => {
    const parametre = new URLSearchParams()
    if (q) parametre.set("q", q)
    if (tur) parametre.set("tur", tur)
    if (durum !== "aktif") parametre.set("durum", durum)
    if (plasiyer) parametre.set("plasiyer", plasiyer)
    if (no > 1) parametre.set("sayfa", String(no))
    const metin = parametre.toString()
    return metin ? `/cari?${metin}` : "/cari"
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Cari Listesi
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Müşteri, tedarikçi ve personel kartları — {toplam} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/cari/disa-aktar${cariFiltreSorgusu({ q, tur, durum, plasiyer })}`} />
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/cari/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Cari
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <CariFiltre
          q={q}
          tur={tur}
          durum={durum}
          plasiyer={plasiyer}
          plasiyerler={secenekler.plasiyerler}
        />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Users className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q || tur || plasiyer || durum !== "aktif"
                  ? "Bu ölçütlere uyan cari bulunamadı"
                  : "Henüz cari kaydı yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                {q || tur || plasiyer || durum !== "aktif"
                  ? "Arama kelimesini veya filtreleri değiştirip tekrar deneyin."
                  : "İlk müşteriyi eklemek için sağ üstteki Yeni Cari düğmesini kullanın."}
              </p>
            </div>
          ) : (
            <>
              {/* md ÜSTÜ: tam tablo. Mobil kart görünümü aynı `kayitlar`
                  dizisinden çiziliyor — ikinci sorgu yok. */}
              <div className="yazdirma-alani hidden max-h-[calc(100svh-16rem)] overflow-auto md:block">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Ünvan</th>
                      <th>Tür</th>
                      <th>VKN / TCKN</th>
                      <th>Telefon</th>
                      <th>İl</th>
                      <th>Sorumlu Personel</th>
                      <th className="text-right">Araç</th>
                      <th className="text-right">Bakiye</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map((c) => {
                      const bakiye = Number(c.bakiye.toString())
                      return (
                        <tr key={c.id}>
                          <td className="font-mono text-[0.75rem]">
                            <Link
                              href={`/cari/${c.id}`}
                              className="text-primary hover:underline"
                            >
                              {c.kod}
                            </Link>
                          </td>
                          <td className="max-w-[22rem] truncate font-medium">
                            <Link href={`/cari/${c.id}`} className="hover:underline">
                              {c.unvan}
                            </Link>
                          </td>
                          <td className="text-muted-foreground">
                            {CARI_TUR_ADLARI[c.turu]}
                          </td>
                          <td className="font-mono text-[0.75rem]">
                            {c.vergiNo ?? "—"}
                          </td>
                          <td>{c.gsm ?? c.telefon ?? "—"}</td>
                          <td className="text-muted-foreground">{c.il ?? "—"}</td>
                          <td className="text-muted-foreground">{c.plasiyer?.unvan ?? "—"}</td>
                          <td className="text-right text-muted-foreground">
                            {c._count.araclar || "—"}
                          </td>
                          <td
                            className={
                              // Borçlu kırmızı, alacaklı yeşil: ekranda tek
                              // bakışta "kim bize borçlu" görünsün.
                              bakiye > 0
                                ? "text-right font-medium text-tehlike"
                                : bakiye < 0
                                  ? "text-right font-medium text-basari"
                                  : "text-right text-muted-foreground"
                            }
                          >
                            {para(Math.abs(bakiye))}
                          </td>
                          <td>
                            <DurumRozetleri
                              aktif={c.aktif}
                              karaListe={c.karaListe}
                              silinen={durum === "silinen"}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                      <td colSpan={8} className="px-3 py-2 text-right text-[0.75rem]">
                        Filtredeki {toplam} kaydın net bakiyesi
                      </td>
                      <td className="px-3 py-2 text-right">
                        {para(Number(ozet._sum.bakiye?.toString() ?? 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* md ALTI: satır yerine kart */}
              <div className="divide-y divide-border md:hidden">
                {kayitlar.map((c) => {
                  const bakiye = Number(c.bakiye.toString())
                  return (
                    <Link
                      key={c.id}
                      href={`/cari/${c.id}`}
                      className="block px-4 py-3 active:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{c.unvan}</div>
                          <div className="font-mono text-[0.75rem] text-muted-foreground">
                            {c.kod} · {CARI_TUR_ADLARI[c.turu]}
                          </div>
                        </div>
                        <DurumRozetleri
                          aktif={c.aktif}
                          karaListe={c.karaListe}
                          silinen={durum === "silinen"}
                        />
                      </div>

                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Telefon</dt>
                          <dd className="truncate">{c.gsm ?? c.telefon ?? "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">İl</dt>
                          <dd className="truncate">{c.il ?? "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Araç</dt>
                          <dd className="tabular-nums">{c._count.araclar || "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Bakiye</dt>
                          <dd
                            className={
                              bakiye > 0
                                ? "font-medium tabular-nums text-tehlike"
                                : bakiye < 0
                                  ? "font-medium tabular-nums text-basari"
                                  : "tabular-nums text-muted-foreground"
                            }
                          >
                            {para(Math.abs(bakiye))}
                          </dd>
                        </div>
                      </dl>
                    </Link>
                  )
                })}
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

function DurumRozetleri({
  aktif,
  karaListe,
  silinen,
}: {
  aktif: boolean
  karaListe: boolean
  silinen: boolean
}) {
  const rozetler: Array<[string, string]> = []
  if (silinen) rozetler.push(["Silinmiş", "bg-muted text-muted-foreground"])
  if (karaListe) rozetler.push(["Kara liste", "bg-tehlike-yumusak text-tehlike"])
  if (!aktif && !silinen) rozetler.push(["Pasif", "bg-uyari-yumusak text-uyari"])
  if (rozetler.length === 0) rozetler.push(["Aktif", "bg-basari-yumusak text-basari"])

  return (
    <div className="flex flex-wrap gap-1">
      {rozetler.map(([ad, sinif]) => (
        <span
          key={ad}
          className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${sinif}`}
        >
          {ad}
        </span>
      ))}
    </div>
  )
}
