import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ekspertizGetir } from "../veri"
import { DONANIM_SATIRLARI, ISCILIK_SATIRLARI } from "../sema"
import { AracSemasi, type PanelSecimi } from "@/components/ekspertiz/arac-semasi"
import { EkspertizIslemleri } from "@/components/ekspertiz/ekspertiz-islemleri"
import { DurumRozeti } from "@/components/ekspertiz/ekspertiz-listesi"
import { Button } from "@/components/ui/button"
import { miktar, para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Ekspertiz Kartı" }
export const dynamic = "force-dynamic"

export default async function EkspertizDetayi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const k = await ekspertizGetir(kayitId)
  if (!k) notFound()

  const iscilikDolu = ISCILIK_SATIRLARI.filter((s) => k[s.ad] > 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/servis/ekspertiz" aria-label="Ekspertiz listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              {k.ekspertizNo}
              <DurumRozeti durum={k.durum} />
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {plakaBicim(k.arac.plaka)} · {k.cari.unvan}
              {k.matbuNo ? ` · Matbu No: ${k.matbuNo}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <EkspertizIslemleri
          id={k.id}
          ekspertizNo={k.ekspertizNo}
          durum={k.durum}
          genelToplam={k.genelToplam}
          kabul={k.kabul}
          duzeltebilir={yetkiVar(kullanici, "kabul", "duzelt")}
          silebilir={yetkiVar(kullanici, "kabul", "sil")}
          kabulAcabilir={yetkiVar(kullanici, "kabul", "ekle")}
        />

        {/* --- dosya bilgileri --- */}
        <Kutu baslik="Dosya Bilgileri">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8125rem] sm:grid-cols-3 lg:grid-cols-4">
            <Satir etiket="Müşteri" deger={k.cari.unvan} />
            <Satir
              etiket="Araç"
              deger={`${plakaBicim(k.arac.plaka)} — ${[k.arac.marka, k.arac.model, k.arac.modelYili].filter(Boolean).join(" ")}`}
            />
            <Satir etiket="Km" deger={k.km?.toLocaleString("tr-TR")} />
            <Satir etiket="Başlangıç Tarihi" deger={tarih(k.baslangicTarihi)} />
            <Satir etiket="Teslim Tarihi" deger={tarih(k.teslimTarihi)} />
            <Satir etiket="Sigorta" deger={k.sigortaAdi} />
            <Satir etiket="Eksper" deger={k.eksperAdi} />
            <Satir etiket="Poliçe No" deger={k.policeNo} />
            <Satir etiket="Dosya No" deger={k.dosyaNo} />
            <Satir etiket="H.D. No" deger={k.hdNo} />
            <Satir etiket="Şöför T.C." deger={k.soforTc} />
            <Satir etiket="T.C. Kimlik No" deger={k.tcKimlikNo} />
            <Satir etiket="Karşı Araç Tel" deger={k.karsiAracTel} />
            <Satir etiket="Karşı Araç T.C." deger={k.karsiAracTc} />
          </dl>
          {k.notlar ? (
            <p className="mt-3 border-t pt-2 text-[0.8125rem] whitespace-pre-wrap">
              {k.notlar}
            </p>
          ) : null}
        </Kutu>

        {/* --- donanım --- */}
        <Kutu baslik="Donanım">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[0.8125rem] sm:grid-cols-3 lg:grid-cols-5">
            {DONANIM_SATIRLARI.map((s) => {
              const deger = k[s.ad]
              return (
                <li key={s.ad} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{s.etiket}</span>
                  <span
                    className={
                      deger === true
                        ? "font-medium text-basari"
                        : deger === false
                          ? "font-medium"
                          : "text-muted-foreground"
                    }
                  >
                    {deger === true ? "Var" : deger === false ? "Yok" : "—"}
                  </span>
                </li>
              )
            })}
          </ul>
        </Kutu>

        {/* --- parçalar --- */}
        <Kutu baslik={`Parçalar (${k.kalemler.length})`}>
          {k.kalemler.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              Parça satırı girilmemiş.
            </p>
          ) : (
            <div className="tablo-sarmal">
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr className="border-b text-[0.75rem] text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-medium">Parça İsmi</th>
                    <th className="px-2 py-1.5 text-right font-medium">Adet</th>
                    <th className="px-2 py-1.5 text-left font-medium">Birim</th>
                    <th className="px-2 py-1.5 text-right font-medium">Birim Fiyat</th>
                    <th className="px-2 py-1.5 text-right font-medium">KDV %</th>
                    <th className="px-2 py-1.5 text-right font-medium">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {k.kalemler.map((kalem) => (
                    <tr key={kalem.id} className="border-b border-border/60">
                      <td className="px-2 py-1.5">{kalem.aciklama}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {miktar(kalem.miktar)}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{kalem.birim}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {para(kalem.birimFiyat)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {kalem.kdvOrani}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                        {para(kalem.toplam)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Kutu>

        {/* --- işçilik --- */}
        <Kutu baslik="İşçilik">
          {iscilikDolu.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              İşçilik tutarı girilmemiş.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[0.8125rem] sm:grid-cols-3 lg:grid-cols-5">
              {iscilikDolu.map((s) => (
                <Satir key={s.ad} etiket={s.etiket} deger={para(k[s.ad])} />
              ))}
            </dl>
          )}
        </Kutu>

        {/* --- şema --- */}
        <Kutu baslik="Boya / Değişen Parça">
          <AracSemasi baslangic={k.panelSecimi as PanelSecimi} saltOkunur />
        </Kutu>

        {/* --- toplamlar --- */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-muted/40 px-3 py-2 text-[0.8125rem]">
          <Ozet etiket="Parça" deger={k.parcaToplam} />
          <Ozet etiket="İşçilik" deger={k.iscilikToplam} />
          <Ozet etiket="Ara Toplam" deger={k.araToplam} />
          <Ozet etiket="KDV" deger={k.kdvToplam} />
          <Ozet etiket="Genel Toplam" deger={k.genelToplam} vurgulu />
        </div>

        <p className="text-[0.75rem] text-muted-foreground">
          BU EKSPERTİZ BİR ÖN TAHMİNDİR, KESİN SONUÇ ONARIM NETİCESİ BELLİ
          OLACAKTIR. Bu kart cari, kasa veya stok hareketi oluşturmaz.
        </p>
      </div>
    </div>
  )
}

function Kutu({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-3">
      <h2 className="mb-2 text-[0.8125rem] font-semibold">{baslik}</h2>
      {children}
    </section>
  )
}

function Satir({ etiket, deger }: { etiket: string; deger?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{etiket}</dt>
      <dd className="text-right font-medium">{deger || "—"}</dd>
    </div>
  )
}

function Ozet({
  etiket,
  deger,
  vurgulu,
}: {
  etiket: string
  deger: number
  vurgulu?: boolean
}) {
  return (
    <span className={vurgulu ? "font-semibold" : undefined}>
      <span className="text-muted-foreground">{etiket}: </span>
      <span className="tabular-nums">{para(deger)}</span>
    </span>
  )
}
