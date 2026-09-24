import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, FileCheck2, Plus, ShieldQuestion } from "lucide-react"

import {
  cekSenetleriGetir,
  cekSenetOzeti,
  filtreSorgusu,
  ONAY_ADI,
  TUR_ADI,
  YON_ADI,
  type CekSenetFiltreleri,
} from "./veri"
import { CekSenetFiltre } from "@/components/cek-senet/cek-senet-filtre"
import { DurumRozeti } from "@/components/cek-senet/durum-rozeti"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Çek / Senet Listesi" }
export const dynamic = "force-dynamic"

export default async function CekSenetListesi({
  searchParams,
}: {
  searchParams: Promise<CekSenetFiltreleri>
}) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const p = await searchParams

  const f: CekSenetFiltreleri = {
    yon: p.yon ?? "tumu",
    tur: p.tur ?? "tumu",
    durum: p.durum ?? "acik",
    onay: p.onay ?? "tumu",
    vade: p.vade ?? "tumu",
    q: (p.q ?? "").trim(),
  }

  const [kayitlar, ozet] = await Promise.all([cekSenetleriGetir(f), cekSenetOzeti(f)])
  const ekleyebilir = yetkiVar(kullanici, "tahsilat", "ekle")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Çek / Senet Listesi</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Alınan ve verilen kıymetli evrak · {ozet.adet} kayıt · toplam {para(ozet.toplam)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/cek-senet/disa-aktar${filtreSorgusu(f)}`} />
          <Button variant="outline" size="sm" asChild>
            <Link href="/cek-senet/onay">
              <ShieldQuestion className="size-4" aria-hidden />
              Onay İşlemleri
              {ozet.onayBekleyen > 0 ? (
                <span className="ml-1 rounded-full bg-uyari px-1.5 text-[0.6875rem] font-semibold text-white">
                  {ozet.onayBekleyen}
                </span>
              ) : null}
            </Link>
          </Button>
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/cek-senet/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Kayıt
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <CekSenetFiltre
          yon={f.yon ?? "tumu"}
          tur={f.tur ?? "tumu"}
          durum={f.durum ?? "acik"}
          onay={f.onay ?? "tumu"}
          vade={f.vade ?? "tumu"}
          q={f.q ?? ""}
        />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-4">
        <Kutu etiket="Alınan Toplam" deger={para(ozet.alinanToplam)} renk="basari" />
        <Kutu etiket="Verilen Toplam" deger={para(ozet.verilenToplam)} renk="tehlike" />
        <Kutu
          etiket="Vadesi Geçen"
          deger={`${ozet.vadesiGecen} adet · ${para(ozet.vadesiGecenTutar)}`}
          renk={ozet.vadesiGecen > 0 ? "tehlike" : undefined}
        />
        <Kutu
          etiket="Onay Bekleyen"
          deger={`${ozet.onayBekleyen} adet`}
          renk={ozet.onayBekleyen > 0 ? "uyari" : undefined}
        />
      </div>

      <div className="px-4 pb-6">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <FileCheck2 className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Bu ölçütlere uyan kayıt yok</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Müşteriden alınan çek/senetleri ve tedarikçiye verilenleri buradan takip
                edersiniz; vade geldiğinde tahsil ya da ödeme işlenir.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-20rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Portföy No</th>
                    <th>Yön / Tür</th>
                    <th>Cari</th>
                    <th>Keşideci / Banka</th>
                    <th>Belge No</th>
                    <th>Vade</th>
                    <th className="text-right">Kalan Gün</th>
                    <th>Durum</th>
                    <th>Onay</th>
                    <th className="text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((k) => (
                    <tr key={k.id}>
                      <td className="font-mono">
                        <Link href={`/cek-senet/${k.id}`} className="hover:underline">
                          {k.portfoyNo}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        <span
                          className={k.yon === "ALINAN" ? "text-basari" : "text-tehlike"}
                        >
                          {YON_ADI[k.yon]}
                        </span>{" "}
                        <span className="text-muted-foreground">{TUR_ADI[k.tur]}</span>
                      </td>
                      <td>
                        {k.cariId ? (
                          <Link href={`/cari/${k.cariId}`} className="hover:underline">
                            {k.cariUnvan}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-muted-foreground">
                        {k.borclu ?? "—"}
                        {k.banka ? (
                          <span className="ml-1 text-[0.75rem]">/ {k.banka}</span>
                        ) : null}
                      </td>
                      <td className="font-mono text-[0.75rem]">{k.belgeNo ?? "—"}</td>
                      <td className="whitespace-nowrap">{tarih(k.vadeTarihi)}</td>
                      <td className="text-right tabular-nums">
                        {k.kalanGun === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : k.kalanGun < 0 ? (
                          <span className="inline-flex items-center gap-1 text-tehlike">
                            <AlertTriangle className="size-3.5" aria-hidden />
                            {Math.abs(k.kalanGun)} gün geçti
                          </span>
                        ) : k.kalanGun <= 7 ? (
                          <span className="text-uyari">{k.kalanGun} gün</span>
                        ) : (
                          `${k.kalanGun} gün`
                        )}
                      </td>
                      <td>
                        <DurumRozeti durum={k.durum} />
                      </td>
                      <td>
                        <span
                          className={
                            k.onayDurumu === "ONAYLANDI"
                              ? "text-basari"
                              : k.onayDurumu === "REDDEDILDI"
                                ? "text-tehlike"
                                : "text-uyari"
                          }
                        >
                          {ONAY_ADI[k.onayDurumu]}
                        </span>
                      </td>
                      <td className="text-right font-medium tabular-nums">{para(k.tutar)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={9} className="text-right font-medium">
                      Toplam ({kayitlar.length} kayıt)
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {para(kayitlar.reduce((t, k) => t + k.tutar, 0))}
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

function Kutu({
  etiket,
  deger,
  renk,
}: {
  etiket: string
  deger: string
  renk?: "basari" | "tehlike" | "uyari"
}) {
  return (
    <div className="panel p-3">
      <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{etiket}</p>
      <p
        className={`mt-0.5 text-[1.0625rem] font-semibold tabular-nums ${
          renk === "basari"
            ? "text-basari"
            : renk === "tehlike"
              ? "text-tehlike"
              : renk === "uyari"
                ? "text-uyari"
                : ""
        }`}
      >
        {deger}
      </p>
    </div>
  )
}
