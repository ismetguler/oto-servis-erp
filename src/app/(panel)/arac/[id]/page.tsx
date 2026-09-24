import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Barcode, ClipboardList, Pencil, ShieldAlert } from "lucide-react"

import { AracSilDugmesi } from "@/components/arac/arac-sil-dugmesi"
import { Button } from "@/components/ui/button"
import { para, plaka, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Araç Kartı" }
export const dynamic = "force-dynamic"

export default async function AracKarti({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("arac", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const arac = await prisma.arac.findUnique({
    where: { id: kayitId },
    include: {
      cari: { select: { id: true, kod: true, unvan: true, telefon: true, gsm: true } },
      kabuller: {
        where: { silindi: false },
        orderBy: { girisTarihi: "desc" },
        take: 10,
        select: {
          id: true,
          kabulNo: true,
          durum: true,
          girisTarihi: true,
          teslimTarihi: true,
          genelToplam: true,
        },
      },
      _count: { select: { kabuller: true } },
    },
  })
  if (!arac) notFound()

  const duzeltebilir = yetkiVar(kullanici, "arac", "duzelt") && !arac.silindi
  const silebilir = yetkiVar(kullanici, "arac", "sil")
  const cariGorebilir = yetkiVar(kullanici, "cari", "gor")
  const bugun = new Date()

  const takipler: Array<{ etiket: string; tarih: Date | null; uyari?: boolean }> = [
    { etiket: "Trafik Sigortası Bitiş", tarih: arac.trafikSigBitis },
    { etiket: "Kasko Bitiş", tarih: arac.kaskoBitis },
    { etiket: "Garanti Bitiş", tarih: arac.garantiBitis },
    { etiket: "Muayene Bitiş", tarih: arac.muayeneBitis },
    { etiket: "Akü Bitiş", tarih: arac.akuBitis },
    { etiket: "LPG Tank Son Tarih", tarih: arac.lpgTankSonTarih },
  ].map((t) => ({ ...t, uyari: t.tarih ? t.tarih < bugun : false }))

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/arac" aria-label="Araç listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 font-mono text-[1.0625rem] font-semibold tracking-tight">
              {plaka(arac.plaka)}
              {arac.silindi ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  Silinmiş
                </span>
              ) : !arac.aktif ? (
                <span className="rounded-sm bg-uyari-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-uyari">
                  Pasif
                </span>
              ) : null}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {[arac.marka, arac.model, arac.modelYili].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 11.9 — plakayı barkod olarak basan etiket (araç dosyası /
              anahtarlık). Araç için tek şablon olduğundan açılır menü
              değil doğrudan düğme. */}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/baski/arac-barkod/${arac.id}`} target="_blank">
              <Barcode className="size-4" aria-hidden />
              Barkod Yazdır
            </Link>
          </Button>
          {duzeltebilir ? (
            <Button size="sm" asChild>
              <Link href={`/arac/${arac.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
          {silebilir ? (
            <AracSilDugmesi id={arac.id} silinmis={arac.silindi} plaka={arac.plaka} />
          ) : null}
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <Panel baslik="Sahibi">
            {arac.cari ? (
              <>
                <Satir
                  etiket="Cari"
                  deger={
                    cariGorebilir ? (
                      <Link href={`/cari/${arac.cari.id}`} className="text-primary hover:underline">
                        {arac.cari.kod} — {arac.cari.unvan}
                      </Link>
                    ) : (
                      `${arac.cari.kod} — ${arac.cari.unvan}`
                    )
                  }
                />
                <Satir etiket="Telefon" deger={arac.cari.gsm ?? arac.cari.telefon} />
              </>
            ) : (
              <p className="px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
                Sahip cari tanımlı değil.
              </p>
            )}
          </Panel>

          <Panel baslik="Teknik Bilgiler">
            <Satir etiket="Marka / Model" deger={[arac.marka, arac.model].filter(Boolean).join(" ") || null} />
            <Satir etiket="Model Yılı" deger={arac.modelYili?.toString() ?? null} />
            <Satir etiket="Renk" deger={arac.renk} />
            <Satir etiket="Araç Türü" deger={arac.aracTuru} />
            <Satir etiket="Kasa Tipi" deger={arac.kasaTipi} />
            <Satir etiket="Yakıt Türü" deger={arac.yakitTuru} />
            <Satir etiket="Vites" deger={arac.vitesTuru} />
            <Satir etiket="Motor Hacmi" deger={arac.motorHacmi} />
            <Satir etiket="Son KM" deger={arac.sonKm ? arac.sonKm.toLocaleString("tr-TR") : null} />
            <Satir etiket="Şase No" deger={arac.saseNo} tekTip />
          </Panel>

          <Panel baslik="Ruhsat">
            <Satir etiket="Ruhsat Tarihi" deger={arac.ruhsatTarihi ? tarih(arac.ruhsatTarihi) : null} />
            <Satir etiket="Ruhsat Seri No" deger={arac.ruhsatSeriNo} tekTip />
          </Panel>

          {arac.notlar ? (
            <Panel baslik="Notlar">
              <p className="whitespace-pre-wrap px-3.5 py-2.5 text-[0.8125rem]">{arac.notlar}</p>
            </Panel>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="panel overflow-hidden">
            <div className="panel-baslik">
              <h2 className="panel-baslik-yazi flex items-center gap-1.5">
                <ShieldAlert className="size-4" aria-hidden />
                Garanti / Sigorta / Bakım Takibi
              </h2>
            </div>
            <div className="[&>*]:min-w-0 grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {takipler.map((t) => (
                <div key={t.etiket} className="bg-card px-3.5 py-2.5">
                  <div className="text-[0.75rem] text-muted-foreground">{t.etiket}</div>
                  <div
                    className={`mt-0.5 text-[0.875rem] font-medium ${
                      t.uyari ? "text-tehlike" : ""
                    }`}
                  >
                    {t.tarih ? tarih(t.tarih) : "—"}
                    {t.uyari ? " · süresi geçmiş" : ""}
                  </div>
                </div>
              ))}
              <div className="bg-card px-3.5 py-2.5">
                <div className="text-[0.75rem] text-muted-foreground">Sonraki Bakım</div>
                <div className="mt-0.5 text-[0.875rem] font-medium">
                  {arac.sonrakiBakimTarih ? tarih(arac.sonrakiBakimTarih) : "—"}
                  {arac.sonrakiBakimKm ? ` · ${arac.sonrakiBakimKm.toLocaleString("tr-TR")} km` : ""}
                </div>
              </div>
              <div className="bg-card px-3.5 py-2.5">
                <div className="text-[0.75rem] text-muted-foreground">Triger Değişimi</div>
                <div className="mt-0.5 text-[0.875rem] font-medium">
                  {arac.trigerDegisimTarih ? tarih(arac.trigerDegisimTarih) : "—"}
                  {arac.trigerDegisimKm ? ` · ${arac.trigerDegisimKm.toLocaleString("tr-TR")} km` : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-baslik">
              <h2 className="panel-baslik-yazi flex items-center gap-1.5">
                <ClipboardList className="size-4" aria-hidden />
                Servis Geçmişi
              </h2>
              <span className="flex items-center gap-3 text-[0.75rem] text-muted-foreground">
                {arac._count.kabuller} kabul · son 10
                {arac._count.kabuller > 0 ? (
                  <Link
                    href={`/servis/onceki?aracId=${arac.id}`}
                    className="text-primary hover:underline"
                  >
                    Tüm geçmiş
                  </Link>
                ) : null}
              </span>
            </div>
            {arac.kabuller.length === 0 ? (
              <BosDurum
                baslik="Servis geçmişi yok"
                aciklama="Araç Kabul modülü açıldığında iş emirleri burada listelenecek."
              />
            ) : (
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kabul No</th>
                      <th>Giriş</th>
                      <th>Teslim</th>
                      <th>Durum</th>
                      <th className="text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arac.kabuller.map((k) => (
                      <tr key={k.id}>
                        <td className="font-mono text-[0.75rem]">{k.kabulNo}</td>
                        <td>{tarih(k.girisTarihi)}</td>
                        <td>{k.teslimTarihi ? tarih(k.teslimTarihi) : "—"}</td>
                        <td className="text-muted-foreground">{KABUL_DURUM_ADI[k.durum]}</td>
                        <td className="text-right">{para(k.genelToplam)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const KABUL_DURUM_ADI: Record<string, string> = {
  ACIK: "Açık",
  BEKLEMEDE: "Beklemede",
  TAMAMLANDI: "Tamamlandı",
  TESLIM_EDILDI: "Teslim Edildi",
  IPTAL: "İptal",
}

function Panel({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-baslik">
        <h2 className="panel-baslik-yazi">{baslik}</h2>
      </div>
      <dl className="divide-y divide-border/70">{children}</dl>
    </div>
  )
}

function Satir({
  etiket,
  deger,
  tekTip,
}: {
  etiket: string
  deger: React.ReactNode
  tekTip?: boolean
}) {
  return (
    <div className="flex gap-3 px-3.5 py-1.5 text-[0.8125rem]">
      <dt className="w-32 shrink-0 text-muted-foreground">{etiket}</dt>
      <dd className={`min-w-0 flex-1 break-words ${tekTip ? "font-mono" : ""}`}>
        {deger || "—"}
      </dd>
    </div>
  )
}

function BosDurum({ baslik, aciklama }: { baslik: string; aciklama: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
      <p className="text-[0.8125rem] font-medium">{baslik}</p>
      <p className="max-w-sm text-[0.75rem] text-muted-foreground">{aciklama}</p>
    </div>
  )
}
