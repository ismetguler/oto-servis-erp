import Link from "next/link"
import { FileSearch, Plus } from "lucide-react"

import {
  EKSPERTIZ_DURUM_ETIKETI,
  type EKSPERTIZ_DURUMLARI,
} from "@/app/(panel)/servis/ekspertiz/sema"
import {
  ekspertizleriGetir,
  type EkspertizFiltresi,
} from "@/app/(panel)/servis/ekspertiz/veri"
import { EkspertizFiltre } from "@/components/ekspertiz/ekspertiz-filtre"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

type Durum = (typeof EKSPERTIZ_DURUMLARI)[number]

const DURUM_SINIFI: Record<Durum, string> = {
  TASLAK: "bg-muted text-muted-foreground",
  GONDERILDI: "bg-primary/10 text-primary",
  ONAYLANDI: "bg-basari-yumusak text-basari",
  RED: "bg-tehlike-yumusak text-tehlike",
  KABULE_DONDU: "bg-vurgu/15 text-vurgu-koyu",
}

export function DurumRozeti({ durum }: { durum: Durum }) {
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${DURUM_SINIFI[durum]}`}
    >
      {EKSPERTIZ_DURUM_ETIKETI[durum]}
    </span>
  )
}

export async function EkspertizListesi({
  aramalar,
}: {
  aramalar: { q?: string; durum?: string; bas?: string; bit?: string; sayfa?: string }
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const filtre: EkspertizFiltresi = {
    arama: (aramalar.q ?? "").trim(),
    durum: aramalar.durum ?? "hepsi",
    baslangic: aramalar.bas ?? "",
    bitis: aramalar.bit ?? "",
    sayfa: Math.max(1, Number(aramalar.sayfa ?? 1) || 1),
  }

  const { kayitlar, toplam, sayfa, sayfaBoyu } = await ekspertizleriGetir(filtre)
  const sonSayfa = Math.max(1, Math.ceil(toplam / sayfaBoyu))
  const ekleyebilir = yetkiVar(kullanici, "kabul", "ekle")
  const yol = "/servis/ekspertiz"

  const sayfaYolu = (no: number) => {
    const p = new URLSearchParams()
    if (filtre.arama) p.set("q", filtre.arama)
    if (filtre.durum && filtre.durum !== "hepsi") p.set("durum", filtre.durum)
    if (filtre.baslangic) p.set("bas", filtre.baslangic)
    if (filtre.bitis) p.set("bit", filtre.bitis)
    if (no > 1) p.set("sayfa", String(no))
    const metin = p.toString()
    return metin ? `${yol}?${metin}` : yol
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Ekspertiz</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Sigorta / kaza ön tahmin kartları — {toplam} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/servis/ekspertiz/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Ekspertiz
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <EkspertizFiltre
        yol={yol}
        q={filtre.arama ?? ""}
        durum={filtre.durum ?? "hepsi"}
        bas={filtre.baslangic ?? ""}
        bit={filtre.bitis ?? ""}
      />

      {/* md ÜSTÜ: tam tablo */}
      <div className="tablo-sarmal hidden md:block">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[0.75rem] text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Ekspertiz No</th>
              <th className="px-3 py-2 text-left font-medium">Durum</th>
              <th className="px-3 py-2 text-left font-medium">Tarih</th>
              <th className="px-3 py-2 text-left font-medium">Plaka</th>
              <th className="px-3 py-2 text-left font-medium">Müşteri</th>
              <th className="px-3 py-2 text-left font-medium">Sigorta / Dosya</th>
              <th className="px-3 py-2 text-right font-medium">Parça</th>
              <th className="px-3 py-2 text-right font-medium">İşaretli</th>
              <th className="px-3 py-2 text-right font-medium">Genel Toplam</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                  <FileSearch className="mx-auto mb-2 size-8 opacity-40" aria-hidden />
                  Bu filtreye uyan ekspertiz kaydı yok.
                </td>
              </tr>
            ) : (
              kayitlar.map((k) => (
                <tr key={k.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`${yol}/${k.id}`} className="hover:underline">
                      {k.ekspertizNo}
                    </Link>
                    {k.matbuNo ? (
                      <span className="ml-1 text-[0.75rem] text-muted-foreground">
                        · {k.matbuNo}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <DurumRozeti durum={k.durum} />
                    {k.kabul ? (
                      <span className="ml-1 text-[0.75rem] text-muted-foreground">
                        {k.kabul.kabulNo}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {tarih(k.baslangicTarihi)}
                  </td>
                  <td className="px-3 py-2">
                    {plakaBicim(k.arac.plaka)}
                    <span className="ml-1 text-[0.75rem] text-muted-foreground">
                      {[k.arac.marka, k.arac.model].filter(Boolean).join(" ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">{k.cari.unvan}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[k.sigortaAdi, k.dosyaNo].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {k._count.kalemler}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {k._count.paneller}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {para(k.genelToplam)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* md ALTI: kart görünümü. Aynı veriden çiziliyor, ikinci sorgu yok. */}
      <div className="divide-y divide-border md:hidden">
        {kayitlar.length === 0 ? (
          <p className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
            Bu filtreye uyan ekspertiz kaydı yok.
          </p>
        ) : (
          kayitlar.map((k) => (
            <Link
              key={k.id}
              href={`${yol}/${k.id}`}
              className="block px-4 py-3 active:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{plakaBicim(k.arac.plaka)}</div>
                  <div className="truncate text-[0.75rem] text-muted-foreground">
                    {[k.arac.marka, k.arac.model].filter(Boolean).join(" ")}
                  </div>
                </div>
                <DurumRozeti durum={k.durum} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
                <div className="col-span-2 flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">Müşteri</dt>
                  <dd className="truncate">{k.cari.unvan}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">No</dt>
                  <dd className="truncate font-medium">{k.ekspertizNo}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">Tarih</dt>
                  <dd className="truncate">{tarih(k.baslangicTarihi)}</dd>
                </div>
                <div className="col-span-2 flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">Toplam</dt>
                  <dd className="tabular-nums font-medium">{para(k.genelToplam, false)}</dd>
                </div>
              </dl>
            </Link>
          ))
        )}
      </div>

      {sonSayfa > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[0.8125rem]">
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
    </div>
  )
}
