import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen } from "lucide-react"

import {
  defterSorgusu,
  defterVerisi,
  HAREKET_TUR_ADI,
  masrafTurleri,
  secilebilirKasalar,
  varsayilanAralik,
  type DefterFiltreleri,
} from "../veri"
import { DefterFiltre } from "@/components/kasa/defter-filtre"
import { HareketFormu } from "@/components/kasa/hareket-formu"
import { HareketSilDugmesi } from "@/components/kasa/hareket-sil-dugmesi"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Kasa Defteri" }
export const dynamic = "force-dynamic"

export default async function KasaDefteri({
  searchParams,
}: {
  searchParams: Promise<DefterFiltreleri>
}) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const p = await searchParams
  const v = varsayilanAralik()

  const f: DefterFiltreleri = {
    kasa: p.kasa ?? "tumu",
    q: (p.q ?? "").trim(),
    tur: p.tur ?? "tumu",
    bas: p.bas && p.bas !== "" ? p.bas : v.bas,
    bit: p.bit && p.bit !== "" ? p.bit : v.bit,
  }

  const [defter, kasalar, masraflar] = await Promise.all([
    defterVerisi(f),
    secilebilirKasalar(),
    masrafTurleri(),
  ])

  const ekleyebilir = yetkiVar(kullanici, "tahsilat", "ekle") && kasalar.length > 0
  const silebilir = yetkiVar(kullanici, "tahsilat", "sil")
  const seciliKasa = defter.tekKasa ? kasalar.find((k) => k.id === Number(f.kasa)) : undefined

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Kasa Defteri</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {seciliKasa ? `${seciliKasa.kod} — ${seciliKasa.ad}` : "Tüm kasalar"} ·{" "}
            {tarih(f.bas)} – {tarih(f.bit)} · {defter.satirlar.length} satır
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/kasa/defter/disa-aktar${defterSorgusu(f)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <DefterFiltre
          kasalar={kasalar}
          kasa={f.kasa ?? "tumu"}
          q={f.q ?? ""}
          tur={f.tur ?? "tumu"}
          bas={f.bas ?? ""}
          bit={f.bit ?? ""}
        />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-4">
        <Kutu etiket="Devreden" deger={para(defter.devreden)} />
        <Kutu etiket="Dönem Girişi" deger={para(defter.girisToplam)} renk="basari" />
        <Kutu etiket="Dönem Çıkışı" deger={para(defter.cikisToplam)} renk="tehlike" />
        <Kutu
          etiket="Dönem Sonu"
          deger={para(defter.kapanis)}
          renk={defter.kapanis < 0 ? "tehlike" : undefined}
          vurgulu
        />
      </div>

      {ekleyebilir ? (
        <div className="yazdirma-disi px-4 pb-4">
          <details className="panel">
            <summary className="cursor-pointer px-4 py-2.5 text-[0.875rem] font-semibold">
              Kasaya Giriş / Çıkış Ekle
            </summary>
            <div className="border-t border-border p-4">
              <HareketFormu
                kasalar={kasalar}
                masraflar={masraflar}
                varsayilanKasaId={seciliKasa?.id}
              />
            </div>
          </details>
        </div>
      ) : null}

      <div className="px-4 pb-4">
        <div className="panel overflow-hidden">
          {defter.satirlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <BookOpen className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Bu aralıkta hareket yok</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Tarih aralığını genişletin ya da yukarıdan yeni bir kasa hareketi ekleyin.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-20rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    {defter.tekKasa ? null : <th>Kasa</th>}
                    <th>Tür</th>
                    <th>Açıklama</th>
                    <th>Cari</th>
                    <th>Belge</th>
                    <th className="text-right">Giriş</th>
                    <th className="text-right">Çıkış</th>
                    {defter.tekKasa ? <th className="text-right">Bakiye</th> : null}
                    {silebilir ? <th className="yazdirma-disi w-12"></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {defter.tekKasa ? (
                    <tr className="bg-muted/40">
                      <td colSpan={6} className="font-medium">
                        Devreden bakiye
                      </td>
                      <td></td>
                      <td></td>
                      <td className="text-right font-semibold tabular-nums">
                        {para(defter.devreden)}
                      </td>
                      {silebilir ? <td className="yazdirma-disi"></td> : null}
                    </tr>
                  ) : null}

                  {defter.satirlar.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{tarih(s.tarih)}</td>
                      {defter.tekKasa ? null : <td>{s.kasaAdi}</td>}
                      <td className="whitespace-nowrap text-muted-foreground">
                        {HAREKET_TUR_ADI[s.tur]}
                      </td>
                      <td>
                        {s.aciklama ?? "—"}
                        {/* Virman açıklaması zaten iki kasayı da yazıyor; karşı
                            kasa adını tekrar parantezle eklemek mükerrer oluyordu. */}
                        {s.karsiKasaAdi && !s.virman ? (
                          <span className="ml-1 text-[0.75rem] text-muted-foreground">
                            ({s.karsiKasaAdi})
                          </span>
                        ) : null}
                        {s.masrafTuru ? (
                          <span className="ml-1 rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                            {s.masrafTuru}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground">
                        {s.cariId ? (
                          <Link href={`/cari/${s.cariId}`} className="hover:underline">
                            {s.cariUnvan}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="font-mono text-[0.75rem] text-muted-foreground">
                        {s.belgeNo ?? "—"}
                      </td>
                      <td className="text-right tabular-nums text-basari">
                        {s.giris > 0 ? para(s.giris) : "—"}
                      </td>
                      <td className="text-right tabular-nums text-tehlike">
                        {s.cikis > 0 ? para(s.cikis) : "—"}
                      </td>
                      {defter.tekKasa ? (
                        <td
                          className={`text-right tabular-nums ${s.yuruyenBakiye < 0 ? "text-tehlike" : ""}`}
                        >
                          {para(s.yuruyenBakiye)}
                        </td>
                      ) : null}
                      {silebilir ? (
                        <td className="yazdirma-disi">
                          {s.tur === "ACILIS" ? null : (
                            <HareketSilDugmesi
                              id={s.id}
                              virman={s.virman}
                              aciklama={`${tarih(s.tarih)} — ${s.aciklama ?? ""}`}
                            />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={defter.tekKasa ? 6 : 7} className="text-right font-medium">
                      Dönem toplamı
                    </td>
                    <td className="text-right font-semibold tabular-nums text-basari">
                      {para(defter.girisToplam)}
                    </td>
                    <td className="text-right font-semibold tabular-nums text-tehlike">
                      {para(defter.cikisToplam)}
                    </td>
                    {defter.tekKasa ? (
                      <td className="text-right font-semibold tabular-nums">
                        {para(defter.kapanis)}
                      </td>
                    ) : null}
                    {silebilir ? <td className="yazdirma-disi"></td> : null}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {defter.gunler.length > 0 ? (
        <div className="px-4 pb-6">
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Gün Sonu Dökümü</h2>
              <p className="text-[0.75rem] text-muted-foreground">
                Her günün kapanışı, devreden bakiye üzerine işlenerek hesaplanır
              </p>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Gün</th>
                    <th className="text-right">Giriş</th>
                    <th className="text-right">Çıkış</th>
                    <th className="text-right">Gün Sonu Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {defter.gunler.map((g) => (
                    <tr key={g.gun}>
                      <td className="whitespace-nowrap">{tarih(g.gun)}</td>
                      <td className="text-right tabular-nums text-basari">{para(g.giris)}</td>
                      <td className="text-right tabular-nums text-tehlike">{para(g.cikis)}</td>
                      <td
                        className={`text-right font-medium tabular-nums ${g.kapanis < 0 ? "text-tehlike" : ""}`}
                      >
                        {para(g.kapanis)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Kutu({
  etiket,
  deger,
  renk,
  vurgulu,
}: {
  etiket: string
  deger: string
  renk?: "basari" | "tehlike"
  vurgulu?: boolean
}) {
  return (
    <div className={`panel p-3 ${vurgulu ? "border-primary/40" : ""}`}>
      <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{etiket}</p>
      <p
        className={`mt-0.5 text-[1.125rem] font-semibold tabular-nums ${
          renk === "basari" ? "text-basari" : renk === "tehlike" ? "text-tehlike" : ""
        }`}
      >
        {deger}
      </p>
    </div>
  )
}
