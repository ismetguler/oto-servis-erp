import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { stokGirisFisiGetir } from "../veri"
import { GirisFisButonlari } from "@/components/stok/giris-fis-butonlari"
import { Button } from "@/components/ui/button"
import { miktar, para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Stok Giriş Fişi" }
export const dynamic = "force-dynamic"

const DURUM_ADI: Record<string, string> = {
  TASLAK: "Taslak",
  ONAYLANDI: "Uygulandı",
  GERI_ALINDI: "Geri Alındı",
}

export default async function StokGirisFisi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("stok", "gor")
  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const fis = await stokGirisFisiGetir(kayitId)
  if (!fis) notFound()

  const islemYapabilir = yetkiVar(kullanici, "stok", "duzelt") || yetkiVar(kullanici, "stok", "sil")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stok/giris" aria-label="Listeye dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 font-mono text-[1.0625rem] font-semibold tracking-tight">
              {fis.fisNo}
              <span className="rounded-sm bg-muted px-1.5 py-0.5 font-sans text-[0.6875rem] font-medium text-muted-foreground">
                {DURUM_ADI[fis.durum] ?? fis.durum}
              </span>
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {tarih(fis.tarih)}
              {fis.depoAdi ? ` · ${fis.depoAdi}` : ""}
              {fis.saticiAdi ? ` · Satıcı: ${fis.saticiAdi}` : ""}
              {fis.aciklama ? ` · ${fis.aciklama}` : ""}
            </p>
          </div>
        </div>
        {islemYapabilir ? <GirisFisButonlari id={fis.id} durum={fis.durum} /> : null}
      </div>

      <div className="p-4">
        {fis.durum === "GERI_ALINDI" ? (
          <p className="mb-3 rounded-md border border-uyari/30 bg-uyari-yumusak px-3 py-2 text-[0.8125rem] text-uyari">
            Bu fiş geri alındı — stok bakiyeleri girişten önceki hâline döndürüldü.
          </p>
        ) : null}

        <div className="panel overflow-hidden">
          <div className="tablo-sarmal">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th className="text-right">Miktar</th>
                  <th className="text-right">Alış Fiyatı</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {fis.kalemler.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <Link href={`/stok/${k.stokId}`} className="hover:underline">
                        <span className="font-mono text-muted-foreground">{k.kod}</span> — {k.ad}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">
                      {miktar(k.miktar)} {k.birim}
                    </td>
                    <td className="text-right tabular-nums">{para(k.birimFiyat)}</td>
                    <td className="text-right tabular-nums">{para(k.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right">
                    Genel Toplam ({fis.kalemler.length} kalem)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{para(fis.toplamTutar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
