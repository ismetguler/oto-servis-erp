import type { Metadata } from "next"
import Link from "next/link"
import { Receipt } from "lucide-react"

import {
  personelSecenekleriGetir,
  satisFiltreSorgusu,
  satisTahsilatGetir,
  varsayilanDonem,
} from "./veri"
import { DonemFiltre } from "@/components/personel/donem-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { para, plaka, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * PERSONEL SATIŞ - TAHSİLAT RAPORU
 *
 * Kural ve gerekçeleri `veri.ts` başında. Ekran yalnız gösterim yapıyor;
 * dönem filtresi komisyon raporuyla ortak bileşenden geliyor ki müdür iki
 * raporu aynı dönem için yan yana okuyabilsin.
 */
export const metadata: Metadata = { title: "Satış-Tahsilat Raporu" }
export const dynamic = "force-dynamic"

type Aramalar = { bas?: string; bit?: string; personel?: string }

export default async function SatisTahsilatRaporu({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("cari", "gor")
  const p = await searchParams
  const varsayilan = varsayilanDonem()

  const filtreler = {
    bas: p.bas ?? varsayilan.bas,
    bit: p.bit ?? varsayilan.bit,
    personel: p.personel ?? "",
  }

  const [kayitlar, personeller] = await Promise.all([
    satisTahsilatGetir(filtreler),
    personelSecenekleriGetir(),
  ])

  const toplam = {
    satis: kayitlar.reduce((t, k) => t + k.satis, 0),
    tahsilat: kayitlar.reduce((t, k) => t + k.tahsilat, 0),
    kalan: kayitlar.reduce((t, k) => t + k.kalan, 0),
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Satış-Tahsilat Raporu
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Üstlenilen işlerin cirosu ve tahsilatı — {tarih(filtreler.bas)} /{" "}
            {tarih(filtreler.bit)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/personel/satis-tahsilat/disa-aktar${satisFiltreSorgusu(filtreler)}`}
          />
        </div>
      </div>

      <div className="yazdirma-disi">
        <DonemFiltre
          yol="/personel/satis-tahsilat"
          bas={filtreler.bas}
          bit={filtreler.bit}
          personel={filtreler.personel}
          personeller={personeller}
        />
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Ozet baslik="Personel" deger={String(kayitlar.length)} />
          <Ozet baslik="Satış (KDV dahil)" deger={para(toplam.satis)} />
          <Ozet baslik="Tahsil Edilen" deger={para(toplam.tahsilat)} vurgu />
          <Ozet baslik="Kalan" deger={para(toplam.kalan)} />
        </div>

        <p className="rounded-sm border border-border bg-muted/40 px-3 py-2 text-[0.75rem] text-muted-foreground">
          Satış, kartın <strong>KDV dahil genel toplamı</strong>dır (parça + işçilik).
          Bir kart birden çok ustaya atanmışsa tutar eşit bölünür. Tahsilat yalnızca
          <strong> karta bağlı</strong> fişlerden gelir; cariye toplu girilen tahsilat
          hangi işe ait olduğu bilinmediği için buraya yansımaz.
        </p>

        {kayitlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Receipt className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu dönemde kayıt yok</p>
            <p className="max-w-md text-[0.8125rem] text-muted-foreground">
              Kartın bu listeye düşmesi için teslim edilmiş olması ve üzerinde en az bir
              personel atanmış olması gerekiyor.
            </p>
          </div>
        ) : (
          <>
            <div className="panel overflow-hidden">
              <div className="yazdirma-alani overflow-x-auto">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Personel</th>
                      <th>Görev</th>
                      <th className="text-right">İş</th>
                      <th className="text-right">Satış</th>
                      <th className="text-right">Tahsilat</th>
                      <th className="text-right">Kalan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map((k) => (
                      <tr key={k.personelId}>
                        <td className="font-mono text-[0.75rem]">{k.kod}</td>
                        <td className="font-medium">
                          <Link
                            href={`/personel/${k.personelId}`}
                            className="text-primary hover:underline"
                          >
                            {k.unvan}
                          </Link>
                        </td>
                        <td className="text-muted-foreground">{k.gorevi ?? "—"}</td>
                        <td className="text-right tabular-nums">{k.isAdedi}</td>
                        <td className="text-right tabular-nums">{para(k.satis)}</td>
                        <td className="text-right tabular-nums">{para(k.tahsilat)}</td>
                        <td
                          className={`text-right font-semibold tabular-nums ${
                            k.kalan > 0 ? "text-tehlike" : ""
                          }`}
                        >
                          {para(k.kalan)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>TOPLAM</td>
                      <td className="text-right tabular-nums">{para(toplam.satis)}</td>
                      <td className="text-right tabular-nums">{para(toplam.tahsilat)}</td>
                      <td className="text-right tabular-nums">{para(toplam.kalan)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {kayitlar.map((k) => (
              <div key={k.personelId} className="panel overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <h2 className="text-[0.875rem] font-semibold">
                    {k.unvan}
                    <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                      {k.isAdedi} iş
                    </span>
                  </h2>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    Kalan{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {para(k.kalan)}
                    </span>
                  </span>
                </div>
                <div className="yazdirma-alani overflow-x-auto">
                  <table className="veri-tablosu">
                    <thead>
                      <tr>
                        <th>Teslim</th>
                        <th>Kabul No</th>
                        <th>Plaka</th>
                        <th>Müşteri</th>
                        <th className="text-right">Pay</th>
                        <th className="text-right">Satış</th>
                        <th className="text-right">Tahsilat</th>
                        <th className="text-right">Kalan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {k.satirlar.map((s) => (
                        <tr key={s.kabulId}>
                          <td className="text-muted-foreground">{tarih(s.tarih)}</td>
                          <td className="font-mono text-[0.75rem]">
                            <Link
                              href={`/servis/kabul/${s.kabulId}`}
                              className="text-primary hover:underline"
                            >
                              {s.kabulNo}
                            </Link>
                          </td>
                          <td className="font-medium">{plaka(s.plaka)}</td>
                          <td>{s.musteri}</td>
                          <td className="text-right tabular-nums text-muted-foreground">
                            {s.paydas > 1 ? `1/${s.paydas}` : "tam"}
                          </td>
                          <td className="text-right tabular-nums">{para(s.satis)}</td>
                          <td className="text-right tabular-nums">{para(s.tahsilat)}</td>
                          <td className="text-right tabular-nums">
                            {para(s.satis - s.tahsilat)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Ozet({
  baslik,
  deger,
  vurgu = false,
}: {
  baslik: string
  deger: string
  vurgu?: boolean
}) {
  return (
    <div className="panel px-3 py-2">
      <div className="text-[0.75rem] text-muted-foreground">{baslik}</div>
      <div
        className={`text-[1.0625rem] font-semibold tabular-nums ${
          vurgu ? "text-primary" : ""
        }`}
      >
        {deger}
      </div>
    </div>
  )
}
