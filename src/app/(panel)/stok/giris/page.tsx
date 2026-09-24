import type { Metadata } from "next"
import Link from "next/link"
import { PackagePlus, Plus } from "lucide-react"

import { stokGirisleriGetir } from "./veri"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Stok Girişi" }
export const dynamic = "force-dynamic"

const DURUM_ADI: Record<string, string> = {
  TASLAK: "Taslak",
  ONAYLANDI: "Uygulandı",
  GERI_ALINDI: "Geri Alındı",
}
const DURUM_SINIF: Record<string, string> = {
  TASLAK: "bg-uyari-yumusak text-uyari",
  ONAYLANDI: "bg-basari-yumusak text-basari",
  GERI_ALINDI: "bg-muted text-muted-foreground",
}

export default async function StokGirisiListesi() {
  const kullanici = await yetkiliOturum("stok", "gor")
  const fisler = await stokGirisleriGetir()
  const ekleyebilir = yetkiVar(kullanici, "stok", "ekle")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Girişi</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Fatura olmadan depoya mal girişi — {fisler.length} fiş
          </p>
        </div>
        {ekleyebilir ? (
          <Button size="sm" asChild>
            <Link href="/stok/giris/yeni">
              <Plus className="size-4" aria-hidden />
              Yeni Giriş
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {fisler.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <PackagePlus className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Henüz stok girişi yok</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Barkot/koddan mevcut ürünü seçip miktar ve alış fiyatını girerek
                depoya mal girişi yapın.
              </p>
            </div>
          ) : (
            <div className="tablo-sarmal">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Fiş No</th>
                    <th>Tarih</th>
                    <th>Depo</th>
                    <th>Satıcı</th>
                    <th>Açıklama</th>
                    <th className="text-right">Kalem</th>
                    <th className="text-right">Tutar</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {fisler.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/stok/giris/${f.id}`} className="font-mono text-primary hover:underline">
                          {f.fisNo}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{tarih(f.tarih)}</td>
                      <td>{f.depoAdi ?? "—"}</td>
                      <td className="max-w-[12rem] truncate">{f.saticiAdi ?? "—"}</td>
                      <td className="max-w-[16rem] truncate text-muted-foreground">
                        {f.aciklama ?? "—"}
                      </td>
                      <td className="text-right tabular-nums">{f.kalemSayisi}</td>
                      <td className="text-right tabular-nums">{para(f.toplamTutar)}</td>
                      <td>
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${
                            DURUM_SINIF[f.durum] ?? ""
                          }`}
                        >
                          {DURUM_ADI[f.durum] ?? f.durum}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
