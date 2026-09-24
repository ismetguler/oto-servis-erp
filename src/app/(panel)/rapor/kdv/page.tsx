import type { Metadata } from "next"
import Link from "next/link"
import { Receipt } from "lucide-react"

import {
  kdvOzetiVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "KDV Özeti" }
export const dynamic = "force-dynamic"

/**
 * KDV ÖZETİ (ADIM 10.8.a)
 *
 * Ekranda muhasebe terimi KULLANILMIYOR (matrah / hesaplanan / indirilecek /
 * devreden): raporu okuyan kişi esnaf, muhasebeci değil. Aynı rakamlar
 * "müşteriden aldığınız KDV", "satıcıya ödediğiniz KDV", "devlete ödenecek"
 * diye anlatılıyor. Resmî terimler yalnız Excel çıktısında, muhasebeciye
 * gidecek dosyada duruyor.
 *
 * Hesabın gerekçesi `rapor/veri.ts`teki `kdvOzetiVerisi` yorumunda.
 */
export default async function KdvOzetiRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await kdvOzetiVerisi(filtreler)
  const toplam = satirlar.reduce(
    (t, s) => ({
      alisFaturaSayisi: t.alisFaturaSayisi + s.alisFaturaSayisi,
      alisKdv: t.alisKdv + s.alisKdv,
      satisFaturaSayisi: t.satisFaturaSayisi + s.satisFaturaSayisi,
      satisKdv: t.satisKdv + s.satisKdv,
    }),
    { alisFaturaSayisi: 0, alisKdv: 0, satisFaturaSayisi: 0, satisKdv: 0 }
  )
  const fark = toplam.satisKdv - toplam.alisKdv
  const odemeVar = fark > 0
  const faturaVar = toplam.alisFaturaSayisi + toplam.satisFaturaSayisi > 0

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">KDV Özeti</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Hangi ay devlete ne kadar KDV ödeyeceğinizi gösterir
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/kdv/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <HizliDonemler secili={filtreler} />
        <TarihAraligiFiltre yol="/rapor/kdv" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kutu
            etiket="Müşterilerden aldığınız KDV"
            deger={para(toplam.satisKdv)}
            altBilgi={`${toplam.satisFaturaSayisi} satış faturası`}
          />
          <Kutu
            etiket="Satıcılara ödediğiniz KDV"
            deger={para(toplam.alisKdv)}
            altBilgi={`${toplam.alisFaturaSayisi} alış faturası`}
          />
          {/*
            Fark eksiyse devletten para geri alınmaz, sonraki aya sayılır —
            kutuda "ödeme yok" yazması bunun için (eksi rakam gösterirsek
            "devlet bana borçlu" diye okunur).
          */}
          <Kutu
            etiket={odemeVar ? "Devlete ödeyeceğiniz KDV" : "Bu dönem ödeme yok"}
            deger={odemeVar ? para(fark) : "—"}
            altBilgi={
              odemeVar
                ? "Müşteriden alınan − satıcıya ödenen"
                : fark < 0
                  ? `${para(Math.abs(fark))} sonraki aya sayılacak`
                  : undefined
            }
            renk={odemeVar ? "text-tehlike" : "text-basari"}
            vurgulu
          />
        </div>

        {!faturaVar ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Receipt className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu tarihler arasında fatura yok</p>
            <p className="max-w-md text-[0.8125rem] text-muted-foreground">
              Yukarıdan başka bir ay seçin. Taslakta bekleyen ve iptal edilen faturalar bu
              hesaba girmez.
            </p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <div className="tablo-sarmal">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Ay</th>
                    <th className="w-56 text-right">Müşterilerden aldığınız KDV</th>
                    <th className="w-56 text-right">Satıcılara ödediğiniz KDV</th>
                    <th className="w-48 text-right">Devlete ödenecek</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((s) => (
                    <tr key={s.ay}>
                      <td className="whitespace-nowrap font-medium">{s.ayEtiketi}</td>
                      <td className="text-right tabular-nums">{para(s.satisKdv)}</td>
                      <td className="text-right tabular-nums">{para(s.alisKdv)}</td>
                      <td className="text-right font-medium tabular-nums">
                        {s.fark > 0 ? (
                          para(s.fark)
                        ) : (
                          <span className="font-normal text-muted-foreground">
                            {s.fark < 0 ? "ödeme yok" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                    <td className="px-3 py-2">Toplam</td>
                    <td className="px-3 py-2 text-right">{para(toplam.satisKdv)}</td>
                    <td className="px-3 py-2 text-right">{para(toplam.alisKdv)}</td>
                    <td className="px-3 py-2 text-right">
                      {odemeVar ? para(fark) : "ödeme yok"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="panel px-4 py-3">
          <p className="mb-2 text-[0.8125rem] font-semibold">Bu rapor ne anlatıyor?</p>
          <ul className="flex flex-col gap-1.5 text-[0.8125rem] text-muted-foreground">
            <li>
              Müşteriye fatura kestiğinizde ondan KDV alırsınız. O para sizin değil,
              devletindir.
            </li>
            <li>
              Satıcıdan fatura aldığınızda siz KDV ödersiniz. Ödediğiniz bu KDV&apos;yi
              düşebilirsiniz.
            </li>
            <li>
              İkisinin farkı, o ay devlete ödeyeceğiniz KDV&apos;dir. Ödediğiniz daha
              fazlaysa devlet para geri vermez, fark sonraki aya sayılır.
            </li>
            <li>
              Hesaba yalnız kesilmiş faturalar girer — taslakta bekleyen, iptal edilen ve
              henüz faturaya dönmemiş servis kartları sayılmaz.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/** Tarih kutularıyla uğraşmadan tek tıkla ay seçimi. */
function HizliDonemler({ secili }: { secili: { bas: string; bit: string } }) {
  const bicim = (g: Date) =>
    `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`
  const bugun = new Date()
  const y = bugun.getFullYear()
  const a = bugun.getMonth()

  const donemler = [
    { ad: "Bu ay", bas: new Date(y, a, 1), bit: new Date(y, a + 1, 0) },
    { ad: "Geçen ay", bas: new Date(y, a - 1, 1), bit: new Date(y, a, 0) },
    { ad: "Bu yıl", bas: new Date(y, 0, 1), bit: new Date(y, 11, 31) },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
      <span className="text-[0.75rem] font-medium text-muted-foreground">Dönem:</span>
      {donemler.map((d) => {
        const bas = bicim(d.bas)
        const bit = bicim(d.bit)
        const aktif = secili.bas === bas && secili.bit === bit
        return (
          <Link
            key={d.ad}
            href={`/rapor/kdv?bas=${bas}&bit=${bit}`}
            className={`rounded-sm border px-2.5 py-1 text-[0.8125rem] transition-colors ${
              aktif
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent"
            }`}
          >
            {d.ad}
          </Link>
        )
      })}
    </div>
  )
}

function Kutu({
  etiket,
  deger,
  altBilgi,
  renk,
  vurgulu,
}: {
  etiket: string
  deger: string
  altBilgi?: string
  renk?: string
  vurgulu?: boolean
}) {
  return (
    <div className={`panel px-3 py-2.5 ${vurgulu ? "border-primary/40" : ""}`}>
      <p className="text-[0.75rem] text-muted-foreground">{etiket}</p>
      <p className={`text-[1.25rem] font-semibold tabular-nums ${renk ?? ""}`}>{deger}</p>
      {altBilgi ? <p className="text-[0.6875rem] text-muted-foreground">{altBilgi}</p> : null}
    </div>
  )
}
