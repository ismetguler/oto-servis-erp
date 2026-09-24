import type { Metadata } from "next"
import Link from "next/link"
import { Banknote, Minus, Plus } from "lucide-react"

import {
  filtreSorgusu,
  ODEME_SEKLI_ADI,
  tahsilatlariGetir,
  tahsilatOzeti,
  TUR_ADI,
  varsayilanAralik,
  type TahsilatFiltreleri,
} from "./veri"
import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TahsilatFiltre } from "@/components/tahsilat/tahsilat-filtre"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Tahsilat Listesi" }
export const dynamic = "force-dynamic"

export default async function TahsilatListesi({
  searchParams,
}: {
  searchParams: Promise<TahsilatFiltreleri>
}) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const p = await searchParams
  const varsayilan = varsayilanAralik()

  const f: TahsilatFiltreleri = {
    tur: p.tur ?? "tumu",
    odeme: p.odeme ?? "tumu",
    kasa: p.kasa ?? "tumu",
    cari: p.cari ?? "",
    bas: p.bas ?? varsayilan.bas,
    bit: p.bit ?? varsayilan.bit,
    q: (p.q ?? "").trim(),
  }

  const [kayitlar, ozet, kasalar] = await Promise.all([
    tahsilatlariGetir(f),
    tahsilatOzeti(f),
    secilebilirKasalar(),
  ])
  const ekleyebilir = yetkiVar(kullanici, "tahsilat", "ekle")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Tahsilat Listesi</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Cariden alınan ve cariye ödenen para · {ozet.adet} fiş · net {para(ozet.net)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/tahsilat/disa-aktar${filtreSorgusu(f)}`} />
          {ekleyebilir ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/tahsilat/odeme">
                  <Minus className="size-4" aria-hidden />
                  Ödeme Girişi
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/tahsilat/yeni">
                  <Plus className="size-4" aria-hidden />
                  Tahsilat Girişi
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <TahsilatFiltre
          tur={f.tur ?? "tumu"}
          odeme={f.odeme ?? "tumu"}
          kasa={f.kasa ?? "tumu"}
          bas={f.bas ?? ""}
          bit={f.bit ?? ""}
          q={f.q ?? ""}
          kasalar={kasalar.map((k) => ({ id: k.id, ad: k.ad }))}
        />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <Kutu etiket="Tahsilat Toplamı" deger={para(ozet.tahsilatToplam)} renk="basari" />
        <Kutu etiket="Ödeme Toplamı" deger={para(ozet.tediyeToplam)} renk="tehlike" />
        <Kutu
          etiket="Net (tahsilat − ödeme)"
          deger={para(ozet.net)}
          renk={ozet.net < 0 ? "tehlike" : "basari"}
        />
      </div>

      <div className="px-4 pb-6">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Banknote className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Bu ölçütlere uyan fiş yok</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Müşteriden alınan para tahsilat, tedarikçiye verilen para ödeme (tediye)
                fişiyle girilir. Fiş kaydedilince cari bakiyesi ve kasa aynı anda güncellenir.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-20rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Fiş No</th>
                    <th>Tür</th>
                    <th>Tarih</th>
                    <th>Cari</th>
                    <th>Ödeme Şekli</th>
                    <th>Kasa</th>
                    <th>Açıklama</th>
                    <th className="text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((k) => (
                    <tr key={k.id}>
                      <td className="font-mono">
                        <Link href={`/tahsilat/${k.id}`} className="hover:underline">
                          {k.fisNo}
                        </Link>
                      </td>
                      <td
                        className={`whitespace-nowrap ${k.tur === "TAHSILAT" ? "text-basari" : "text-tehlike"}`}
                      >
                        {TUR_ADI[k.tur]}
                      </td>
                      <td className="whitespace-nowrap">{tarih(k.tarih)}</td>
                      <td>
                        <Link href={`/cari/${k.cariId}`} className="hover:underline">
                          <span className="font-mono text-muted-foreground">{k.cariKod}</span>{" "}
                          {k.cariUnvan}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{ODEME_SEKLI_ADI[k.odemeSekli]}</td>
                      <td className="text-muted-foreground">
                        {k.kasaId ? (
                          <Link href={`/kasa/${k.kasaId}`} className="hover:underline">
                            {k.kasaAd}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-muted-foreground">{k.aciklama ?? "—"}</td>
                      <td
                        className={`text-right font-medium tabular-nums ${
                          k.tur === "TAHSILAT" ? "text-basari" : "text-tehlike"
                        }`}
                      >
                        {k.tur === "TAHSILAT" ? "" : "−"}
                        {para(k.tutar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} className="text-right font-medium">
                      Net ({kayitlar.length} fiş)
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {para(
                        kayitlar.reduce(
                          (t, k) => t + (k.tur === "TAHSILAT" ? k.tutar : -k.tutar),
                          0
                        )
                      )}
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
