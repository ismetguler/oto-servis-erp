import type { Metadata } from "next"
import Link from "next/link"
import { PackageMinus } from "lucide-react"

import { kritikStokIdleriGetir } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Kritik Stok" }
export const dynamic = "force-dynamic"

export default async function KritikStokListesi() {
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

  // `findMany`'nin `in` filtresi sırayı korumuyor — en kritik önce gelsin
  // diye kritikStokIdleriGetir()'in verdiği sıra burada geri kuruluyor.
  const sira = new Map(idler.map((id, i) => [id, i]))
  const kayitlar = kayitlarHam.sort((a, b) => (sira.get(a.id) ?? 0) - (sira.get(b.id) ?? 0))

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Kritik Stok
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Mevcut miktarı minimum seviyenin altına düşmüş {kayitlar.length} stok kartı
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol="/stok/minimum/disa-aktar" />
        </div>
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <PackageMinus className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Kritik stok yok</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Minimum seviyesi tanımlı hiçbir aktif stok, o seviyenin altına düşmemiş.
              </p>
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
                        <td className="max-w-[22rem] truncate font-medium">
                          <Link href={`/stok/${s.id}`} className="hover:underline">
                            {s.ad}
                          </Link>
                        </td>
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
