import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import {
  firmayaGoreGrupla,
  garantiFiltreSorgusu,
  garantiKayitlariGetir,
  garantiListeKosulu,
  garantiVerenleriGetir,
} from "./veri"
import { GARANTI_DURUM_ETIKETI } from "../kabul/sema"
import { GarantiFiltre } from "@/components/kabul/garanti-filtre"
import { DurumRozeti } from "@/components/kabul/kabul-listesi"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Garanti Listesi" }
export const dynamic = "force-dynamic"

const DURUM_SINIFI: Record<string, string> = {
  BEKLIYOR: "bg-uyari-yumusak text-uyari",
  ONAYLANDI: "bg-bilgi-yumusak text-bilgi",
  RED: "bg-tehlike-yumusak text-tehlike",
  ODENDI: "bg-basari-yumusak text-basari",
}

type Aramalar = {
  q?: string
  firma?: string
  durum?: string
  tahsilat?: string
  bas?: string
  bit?: string
}

/**
 * GARANTİ LİSTESİ
 *
 * Garanti kapsamındaki işler, garantiyi ödeyecek firma bazında gruplanıp
 * gösteriliyor: bir firmanın kaç dosyası var, kaç lirası tahsil edildi,
 * kaçı hâlâ bekliyor — servisin firmadan alacağı tek ekranda.
 */
export default async function GarantiListesi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("kabul", "gor")
  const p = await searchParams

  const filtreler = {
    q: (p.q ?? "").trim(),
    firma: p.firma ?? "",
    durum: p.durum ?? "",
    tahsilat: p.tahsilat ?? "",
    bas: p.bas ?? "",
    bit: p.bit ?? "",
  }

  const [kayitlar, firmalar] = await Promise.all([
    garantiKayitlariGetir(garantiListeKosulu(filtreler)),
    garantiVerenleriGetir(),
  ])

  const gruplar = firmayaGoreGrupla(kayitlar)
  const toplam = {
    adet: kayitlar.length,
    genel: gruplar.reduce((t, g) => t + g.genelToplam, 0),
    garanti: gruplar.reduce((t, g) => t + g.garantiToplam, 0),
    bekleyen: gruplar.reduce((t, g) => t + g.bekleyen, 0),
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Garanti Listesi</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Garanti kapsamında açılan işler, garanti veren firma bazında — {toplam.adet}{" "}
            kayıt / {gruplar.length} firma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/servis/garanti/disa-aktar${garantiFiltreSorgusu(filtreler)}`}
          />
        </div>
      </div>

      <div className="yazdirma-disi">
        <GarantiFiltre {...filtreler} firmalar={firmalar} />
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Ozet baslik="Dosya Adedi" deger={String(toplam.adet)} />
          <Ozet baslik="İş Tutarı (KDV dahil)" deger={para(toplam.genel)} />
          <Ozet baslik="Garanti Kapsamı Tutar" deger={para(toplam.garanti)} />
          <Ozet baslik="Tahsil Edilmemiş" deger={para(toplam.bekleyen)} vurgu />
        </div>

        {gruplar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Garanti kaydı bulunamadı</p>
            <p className="max-w-md text-[0.8125rem] text-muted-foreground">
              Bir iş emrinin bu listeye düşmesi için kart türünün GARANTİ seçilmesi ya da
              kabul kartındaki &quot;Garanti / Sigorta&quot; sekmesinde garanti veren
              firmanın girilmesi yeterli.
            </p>
          </div>
        ) : (
          gruplar.map((g) => (
            <div key={g.firmaId ?? "yok"} className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <h2 className="text-[0.875rem] font-semibold">
                  {g.firmaId ? (
                    <Link href={`/cari/${g.firmaId}`} className="hover:underline">
                      {g.firmaAdi}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{g.firmaAdi}</span>
                  )}
                  <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                    {g.kayitlar.length} dosya
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-x-5 text-[0.8125rem]">
                  <span className="text-muted-foreground">
                    İş tutarı{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {para(g.genelToplam)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Garanti{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {para(g.garantiToplam)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Bekleyen{" "}
                    <span className="font-medium tabular-nums text-tehlike">
                      {para(g.bekleyen)}
                    </span>
                  </span>
                </div>
              </div>

              <div className="yazdirma-alani overflow-x-auto">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kabul No</th>
                      <th>Plaka</th>
                      <th>Müşteri</th>
                      <th>Giriş</th>
                      <th>Dosya No</th>
                      <th>Onay No</th>
                      <th>Talep</th>
                      <th>Takip</th>
                      <th>Kart</th>
                      <th className="text-right">Garanti Tutarı</th>
                      <th className="text-right">İş Toplamı</th>
                      <th>Fatura</th>
                      <th>Tahsilat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.kayitlar.map((k) => (
                      <tr key={k.id}>
                        <td className="font-mono text-[0.75rem]">
                          <Link
                            href={`/servis/kabul/${k.id}`}
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
                        <td>
                          <Link href={`/cari/${k.cari.id}`} className="text-primary hover:underline">
                            {k.cari.unvan}
                          </Link>
                        </td>
                        <td className="text-muted-foreground">{tarih(k.girisTarihi)}</td>
                        <td className="font-mono text-[0.75rem]">{k.garantiDosyaNo ?? "—"}</td>
                        <td className="font-mono text-[0.75rem]">{k.garantiOnayNo ?? "—"}</td>
                        <td className="text-muted-foreground">
                          {k.garantiTalepTarihi ? tarih(k.garantiTalepTarihi) : "—"}
                        </td>
                        <td>
                          {k.garantiDurumu ? (
                            <span
                              className={`rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${
                                DURUM_SINIFI[k.garantiDurumu] ?? "bg-muted text-muted-foreground"
                              }`}
                            >
                              {GARANTI_DURUM_ETIKETI[
                                k.garantiDurumu as keyof typeof GARANTI_DURUM_ETIKETI
                              ] ?? k.garantiDurumu}
                            </span>
                          ) : (
                            <span className="text-[0.75rem] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td>
                          <DurumRozeti durum={k.durum} />
                        </td>
                        <td className="text-right tabular-nums">{para(k.garantiTutar)}</td>
                        <td className="text-right font-medium tabular-nums">
                          {para(k.genelToplam)}
                        </td>
                        <td className="text-[0.75rem]">
                          {k.faturaKesildi ? (
                            <span className="text-basari">Kesildi</span>
                          ) : (
                            <span className="text-muted-foreground">Kesilmedi</span>
                          )}
                        </td>
                        <td className="text-[0.75rem]">
                          {k.odendi ? (
                            <span className="text-basari">Tahsil edildi</span>
                          ) : (
                            <span className="text-tehlike">Bekliyor</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Ozet({
  baslik,
  deger,
  vurgu,
}: {
  baslik: string
  deger: string
  vurgu?: boolean
}) {
  return (
    <div className="panel px-3 py-2">
      <p className="text-[0.6875rem] text-muted-foreground">{baslik}</p>
      <p
        className={`text-[1.0625rem] font-semibold tabular-nums ${
          vurgu ? "text-tehlike" : ""
        }`}
      >
        {deger}
      </p>
    </div>
  )
}
