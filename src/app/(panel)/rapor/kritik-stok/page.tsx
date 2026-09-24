import type { Metadata } from "next"
import Link from "next/link"
import { PackageMinus } from "lucide-react"

import { kritikStokIdleriGetir } from "../../stok/veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Kritik Stok" }
export const dynamic = "force-dynamic"

/**
 * KRİTİK STOK (ADIM 10.10.c) — bilinçli bir tekrar, sıfırdan yazılmadı.
 *
 * `/stok/minimum` ("Minimum Seviye / Kritik Stok") zaten CSV/yazdır araçlı,
 * `kritikStokIdleriGetir()`den (bkz. `stok/veri.ts`) beslenen tam bir ekran
 * olarak duruyor — o SİLİNMEDİ/değiştirilmedi. VKN Aynı Olanlar'daki (HAFIZA
 * 72.2) kararla aynı desen: Raporlar grubunda, rapor toolbar'ıyla, AYNI
 * `kritikStokIdleriGetir()` fonksiyonundan beslenen ince bir kapı açıldı —
 * muhasebeci/patron Raporlar menüsünden çıkmadan görsün diye. Sorgu mantığı
 * KOPYALANMADI, tek kaynaktan (`kritikStokIdleriGetir`) besleniyor; böylece
 * ana sayfadaki kart, `/stok/minimum` ve bu rapor HER ZAMAN aynı sayıyı
 * verir. Ekranda `/stok/minimum`'a da açık bir link var.
 */
export default async function KritikStokRapor() {
  await yetkiliOturum("stok", "gor")

  const idler = await kritikStokIdleriGetir()

  const kayitlarHam = idler.length
    ? await prisma.stok.findMany({
        where: { id: { in: idler } },
        select: {
          id: true,
          kod: true,
          ad: true,
          uretici: true,
          birim: true,
          mevcutMiktar: true,
          minSeviye: true,
          satisFiyat: true,
          depo: { select: { ad: true } },
        },
      })
    : []
  const sira = new Map(idler.map((id, i) => [id, i]))
  const kayitlar = kayitlarHam.sort((a, b) => (sira.get(a.id) ?? 0) - (sira.get(b.id) ?? 0))

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Kritik Stok</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Mevcut miktarı minimum seviyenin altına düşmüş {kayitlar.length} stok kartı —{" "}
            <Link href="/stok/minimum" className="text-primary hover:underline">
              tam ekran (Minimum Seviye)
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol="/rapor/kritik-stok/disa-aktar" />
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <PackageMinus className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Kritik stok yok</p>
            </div>
          ) : (
            <div className="yazdirma-alani overflow-x-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Ürün Adı</th>
                    <th>Marka</th>
                    <th>Depo</th>
                    <th className="text-right">Mevcut</th>
                    <th className="text-right">Min. Seviye</th>
                    <th className="text-right">Eksik</th>
                    <th className="text-right">Satış Fiyatı</th>
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((s) => {
                    const mevcut = Number(s.mevcutMiktar.toString())
                    const min = Number(s.minSeviye.toString())
                    return (
                      <tr key={s.id}>
                        <td className="font-mono text-[0.75rem]">
                          <Link href={`/stok/${s.id}`} className="text-primary hover:underline">
                            {s.kod}
                          </Link>
                        </td>
                        <td className="max-w-[22rem] truncate font-medium">{s.ad}</td>
                        <td className="text-muted-foreground">{s.uretici ?? "—"}</td>
                        <td className="text-muted-foreground">{s.depo?.ad ?? "—"}</td>
                        <td className="text-right font-medium text-tehlike tabular-nums">
                          {miktar(s.mevcutMiktar)} {s.birim}
                        </td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {miktar(s.minSeviye)} {s.birim}
                        </td>
                        <td className="text-right tabular-nums">
                          {miktar(Math.max(0, min - mevcut))} {s.birim}
                        </td>
                        <td className="text-right tabular-nums">{para(s.satisFiyat)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
