import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList, Package, Plus, Printer, ScanLine, TrendingUp } from "lucide-react"

import { stokFiltreSorgusu, stokListeKosulu, filtreSecenekleriGetir } from "./veri"
import { StokFiltre } from "@/components/stok/stok-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Stok Listesi" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 50

type Aramalar = {
  q?: string
  depo?: string
  grup?: string
  durum?: string
  sayfa?: string
}

export default async function StokListesi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const kullanici = await yetkiliOturum("stok", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const depo = p.depo ?? ""
  const grup = p.grup ?? ""
  const durum = p.durum ?? "aktif"
  const sayfa = Math.max(1, Number(p.sayfa ?? 1) || 1)

  const kosul = stokListeKosulu({ q, depo, grup, durum })

  const [toplam, kayitlar, secenekler] = await Promise.all([
    prisma.stok.count({ where: kosul }),
    prisma.stok.findMany({
      where: kosul,
      orderBy: { ad: "asc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        kod: true,
        ad: true,
        barkod: true,
        uretici: true,
        birim: true,
        mevcutMiktar: true,
        minSeviye: true,
        satisFiyat: true,
        kdvOrani: true,
        aktif: true,
        silindi: true,
        depo: { select: { ad: true } },
      },
    }),
    filtreSecenekleriGetir(),
  ])

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU))
  const ekleyebilir = yetkiVar(kullanici, "stok", "ekle")

  const sayfaYolu = (no: number) => {
    const parametre = new URLSearchParams()
    if (q) parametre.set("q", q)
    if (depo) parametre.set("depo", depo)
    if (grup) parametre.set("grup", grup)
    if (durum !== "aktif") parametre.set("durum", durum)
    if (no > 1) parametre.set("sayfa", String(no))
    const metin = parametre.toString()
    return metin ? `/stok?${metin}` : "/stok"
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Listesi</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Parça, sarf ve lastik kartları — {toplam} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/stok/disa-aktar${stokFiltreSorgusu({ q, depo, grup, durum })}`}
          />
          <Button size="sm" variant="outline" asChild>
            <Link href="/stok/barkod">
              <ScanLine className="size-4" aria-hidden />
              Barkod ile Ara
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/stok/etiket">
              <Printer className="size-4" aria-hidden />
              Etiket Yazdır
            </Link>
          </Button>
          {yetkiVar(kullanici, "stok", "duzelt") ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/stok/toplu-fiyat">
                <TrendingUp className="size-4" aria-hidden />
                Toplu Fiyat Güncelle
              </Link>
            </Button>
          ) : null}
          {yetkiVar(kullanici, "stok", "ekle") ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/stok/sayim">
                <ClipboardList className="size-4" aria-hidden />
                Sayım
              </Link>
            </Button>
          ) : null}
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/stok/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Stok Kartı
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <StokFiltre
          q={q}
          depo={depo}
          grup={grup}
          durum={durum}
          depolar={secenekler.depolar}
          urunGruplari={secenekler.urunGruplari}
        />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Package className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q || depo || grup || durum !== "aktif"
                  ? "Bu ölçütlere uyan stok bulunamadı"
                  : "Henüz stok kartı yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                {q || depo || grup || durum !== "aktif"
                  ? "Arama kelimesini veya filtreleri değiştirip tekrar deneyin."
                  : "İlk ürünü eklemek için sağ üstteki Yeni Stok Kartı düğmesini kullanın."}
              </p>
            </div>
          ) : (
            <>
              {/* md ÜSTÜ: tam tablo. Mobil kartlar aynı `kayitlar`
                  dizisinden çiziliyor — ikinci sorgu yok. */}
              <div className="yazdirma-alani hidden max-h-[calc(100svh-16rem)] overflow-auto md:block">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Ürün Adı</th>
                      <th>Barkod</th>
                      <th>Marka</th>
                      <th>Depo</th>
                      <th className="text-right">Miktar</th>
                      <th className="text-right">Satış Fiyatı</th>
                      <th className="text-right">KDV %</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map((s) => {
                      const stokMiktari = Number(s.mevcutMiktar.toString())
                      const minSeviye = Number(s.minSeviye.toString())
                      const kritik = minSeviye > 0 && stokMiktari <= minSeviye
                      return (
                        <tr key={s.id}>
                          <td className="font-mono text-[0.75rem]">
                            <Link href={`/stok/${s.id}`} className="text-primary hover:underline">
                              {s.kod}
                            </Link>
                          </td>
                          <td className="max-w-[22rem] truncate font-medium">
                            <Link href={`/stok/${s.id}`} className="hover:underline">
                              {s.ad}
                            </Link>
                          </td>
                          <td className="font-mono text-[0.75rem] text-muted-foreground">
                            {s.barkod ?? "—"}
                          </td>
                          <td className="text-muted-foreground">{s.uretici ?? "—"}</td>
                          <td className="text-muted-foreground">{s.depo?.ad ?? "—"}</td>
                          <td
                            className={
                              kritik
                                ? "text-right font-medium text-tehlike"
                                : "text-right tabular-nums"
                            }
                            title={kritik ? "Minimum seviyenin altında" : undefined}
                          >
                            {miktar(s.mevcutMiktar)} {s.birim}
                          </td>
                          <td className="text-right tabular-nums">{para(s.satisFiyat)}</td>
                          <td className="text-right tabular-nums text-muted-foreground">
                            {miktar(s.kdvOrani)}
                          </td>
                          <td>
                            <DurumRozeti
                              aktif={s.aktif}
                              silinen={durum === "silinen"}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* md ALTI: satır yerine kart — depocu telefonla stok arıyor */}
              <div className="divide-y divide-border md:hidden">
                {kayitlar.map((s) => {
                  const stokMiktari = Number(s.mevcutMiktar.toString())
                  const minSeviye = Number(s.minSeviye.toString())
                  const kritik = minSeviye > 0 && stokMiktari <= minSeviye
                  return (
                    <Link
                      key={s.id}
                      href={`/stok/${s.id}`}
                      className="block px-4 py-3 active:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{s.ad}</div>
                          <div className="font-mono text-[0.75rem] text-muted-foreground">
                            {s.kod}
                            {s.barkod ? ` · ${s.barkod}` : ""}
                          </div>
                        </div>
                        <DurumRozeti aktif={s.aktif} silinen={durum === "silinen"} />
                      </div>

                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Miktar</dt>
                          <dd
                            className={
                              kritik
                                ? "font-medium tabular-nums text-tehlike"
                                : "tabular-nums"
                            }
                          >
                            {miktar(s.mevcutMiktar)} {s.birim}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Fiyat</dt>
                          <dd className="font-medium tabular-nums">{para(s.satisFiyat)}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Depo</dt>
                          <dd className="truncate">{s.depo?.ad ?? "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-muted-foreground">Marka</dt>
                          <dd className="truncate">{s.uretici ?? "—"}</dd>
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

function DurumRozeti({ aktif, silinen }: { aktif: boolean; silinen: boolean }) {
  if (silinen)
    return (
      <span className="inline-flex rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
        Silinmiş
      </span>
    )
  if (!aktif)
    return (
      <span className="inline-flex rounded-sm bg-uyari-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-uyari">
        Pasif
      </span>
    )
  return (
    <span className="inline-flex rounded-sm bg-basari-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-basari">
      Aktif
    </span>
  )
}
