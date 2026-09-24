import type { Metadata } from "next"
import Link from "next/link"
import { HandCoins } from "lucide-react"

import {
  kartTuruSecenekleri,
  servisTahsilatVerisi,
  type ServisTahsilatFiltre,
} from "./veri"
import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { HizliTahsilat } from "@/components/tahsilat/hizli-tahsilat"
import { Button } from "@/components/ui/button"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Onarım Tahsilatları" }
export const dynamic = "force-dynamic"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

const DURUM_ADI: Record<string, string> = {
  yapilmayan: "Tahsilatı Yapılmayan",
  yapilan: "Tahsilatı Yapılan",
  tumu: "Tümü",
}

export default async function OnarimTahsilatlari({
  searchParams,
}: {
  searchParams: Promise<ServisTahsilatFiltre>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")
  const p = await searchParams
  // SA-3.4: "Ödeme Al" kısayolu — tahsilat ekleme yetkisi olan kullanıcıya
  // her satırda hızlı tahsilat modali. Yetki yoksa kasa listesi de çekilmez.
  const odemeAlabilir = yetkiVar(kullanici, "tahsilat", "ekle")

  const f: ServisTahsilatFiltre = {
    durum: p.durum === "yapilan" || p.durum === "tumu" ? p.durum : "yapilmayan",
    bas: p.bas ?? "",
    bit: p.bit ?? "",
    kartTuru: p.kartTuru ?? "tumu",
    q: (p.q ?? "").trim(),
  }

  const [{ satirlar, toplam }, kartTurleri, kasalar] = await Promise.all([
    servisTahsilatVerisi(f),
    kartTuruSecenekleri(),
    odemeAlabilir ? secilebilirKasalar() : Promise.resolve([]),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Onarım Tahsilatları
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {DURUM_ADI[f.durum ?? "yapilmayan"]} — {satirlar.length} kayıt · kalan{" "}
            {para(toplam.kalan)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
        </div>
      </div>

      <div className="yazdirma-disi flex flex-wrap gap-1.5 border-b border-border bg-card px-4 py-2.5">
        {(["yapilmayan", "yapilan", "tumu"] as const).map((d) => {
          const aktif = (f.durum ?? "yapilmayan") === d
          const sp = new URLSearchParams()
          sp.set("durum", d)
          if (f.bas) sp.set("bas", f.bas)
          if (f.bit) sp.set("bit", f.bit)
          if (f.kartTuru && f.kartTuru !== "tumu") sp.set("kartTuru", f.kartTuru)
          if (f.q) sp.set("q", f.q)
          return (
            <Button
              key={d}
              asChild
              size="sm"
              variant={aktif ? "default" : "outline"}
              className="h-8"
            >
              <Link href={`/servis/tahsilat?${sp.toString()}`}>{DURUM_ADI[d]}</Link>
            </Button>
          )
        })}
      </div>

      <form
        method="get"
        className="yazdirma-disi flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <input type="hidden" name="durum" value={f.durum} />
        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Giriş — Baş.
          </label>
          <input id="bas" name="bas" type="date" defaultValue={f.bas} className={ALAN} />
        </div>
        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Giriş — Bit.
          </label>
          <input id="bit" name="bit" type="date" defaultValue={f.bit} className={ALAN} />
        </div>
        <div className="form-alani">
          <label htmlFor="kartTuru" className="form-etiket">
            Kart Türü
          </label>
          <select
            id="kartTuru"
            name="kartTuru"
            defaultValue={f.kartTuru}
            className={ALAN}
          >
            <option value="tumu">Tümü</option>
            {kartTurleri.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="form-alani">
          <label htmlFor="q" className="form-etiket">
            Cari / Plaka / Kabul No
          </label>
          <input
            id="q"
            name="q"
            defaultValue={f.q}
            placeholder="Ara…"
            className={`${ALAN} w-48`}
          />
        </div>
        <Button type="submit" size="sm" className="h-8">
          Getir
        </Button>
      </form>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <HandCoins className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu ölçütlere uyan onarım yok</p>
            <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
              Tutarı olan onarım kartları listelenir. Tahsilat girildikçe
              &ldquo;yapılmayan&rdquo; görünümünden düşer.
            </p>
          </div>
        ) : (
          <div className="panel yazdirma-alani overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kart No</th>
                  <th>Plaka</th>
                  <th>Giriş Tarihi</th>
                  <th>Kart Türü</th>
                  <th>Ünvan</th>
                  <th className="text-right">Tutar</th>
                  <th className="text-right">Tahsilat</th>
                  <th className="text-right">Kalan</th>
                  <th className="text-right">Gün</th>
                  <th>Fatura No</th>
                  {odemeAlabilir ? (
                    <th className="yazdirma-disi text-right">İşlem</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link
                        href={`/servis/kabul/${s.id}`}
                        className="text-primary hover:underline"
                      >
                        {s.kabulNo}
                      </Link>
                    </td>
                    <td className="font-mono font-medium whitespace-nowrap">
                      {plakaBicim(s.plaka)}
                    </td>
                    <td className="whitespace-nowrap">{tarih(s.girisTarihi)}</td>
                    <td className="text-muted-foreground">{s.kartTuru ?? "—"}</td>
                    <td className="max-w-[16rem] truncate">
                      <Link
                        href={`/cari/${s.cariId}`}
                        className="text-primary hover:underline"
                      >
                        {s.unvan}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{para(s.tutar)}</td>
                    <td className="text-right tabular-nums text-basari">
                      {para(s.tahsilat)}
                    </td>
                    <td className="text-right tabular-nums font-medium text-tehlike">
                      {para(s.kalan)}
                    </td>
                    <td className="text-right tabular-nums">
                      {s.gun === null ? "—" : `${s.gun} gün`}
                    </td>
                    <td className="font-mono text-[0.75rem]">{s.faturaNo ?? "—"}</td>
                    {odemeAlabilir ? (
                      <td className="yazdirma-disi text-right">
                        {s.kalan > 0.005 ? (
                          <HizliTahsilat
                            kart={{
                              kabulId: s.id,
                              kabulNo: s.kabulNo,
                              cariUnvan: s.unvan,
                              genelToplam: s.tutar,
                              tahsilEdilen: s.tahsilat,
                              kalan: s.kalan,
                              karaListe: s.karaListe,
                              karaListeNedeni: s.karaListeNedeni,
                            }}
                            kasalar={kasalar}
                            etiket="Ödeme Al"
                          />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right">
                    Genel Toplam ({satirlar.length} onarım)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {para(toplam.tutar)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {para(toplam.tahsilat)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {para(toplam.kalan)}
                  </td>
                  <td colSpan={odemeAlabilir ? 3 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
