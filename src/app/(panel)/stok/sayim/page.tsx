import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList } from "lucide-react"

import { kullaniciAdiHaritasi } from "./veri"
import { SayimDurumRozeti } from "@/components/stok/sayim-durum-rozeti"
import { Button } from "@/components/ui/button"
import { tarih } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Sayım Fişleri" }
export const dynamic = "force-dynamic"

/** Sayım fişleri listesi — geçmiş: kim ne zaman açtı, kim ne zaman onayladı. */
export default async function SayimFisleri() {
  await yetkiliOturum("stok", "gor")

  const fisler = await prisma.sayimFisi.findMany({
    orderBy: { tarih: "desc" },
    include: {
      depo: { select: { ad: true } },
      _count: { select: { kalemler: true } },
    },
  })

  const kullaniciAdlari = await kullaniciAdiHaritasi(
    fisler.flatMap((f) => [f.olusturanId, f.onaylayanId])
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[1rem] font-semibold">Sayım Fişleri</h1>
        <Button size="sm" asChild>
          <Link href="/stok/sayim/yeni">
            <ClipboardList className="size-4" aria-hidden />
            Yeni Sayım
          </Link>
        </Button>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Fiş No</th>
                <th>Tarih</th>
                <th>Depo</th>
                <th>Ürün Grubu</th>
                <th className="text-right">Kalem</th>
                <th>Durum</th>
                <th>Açan</th>
                <th>Onaylayan</th>
              </tr>
            </thead>
            <tbody>
              {fisler.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/stok/sayim/${f.id}`} className="font-mono text-[0.75rem] text-primary hover:underline">
                      {f.fisNo}
                    </Link>
                  </td>
                  <td className="text-muted-foreground">{tarih(f.tarih)}</td>
                  <td className="text-muted-foreground">{f.depo?.ad ?? "Tüm depolar"}</td>
                  <td className="text-muted-foreground">{f.urunGrubu ?? "—"}</td>
                  <td className="text-right tabular-nums">{f._count.kalemler}</td>
                  <td>
                    <SayimDurumRozeti durum={f.durum} />
                  </td>
                  <td className="text-muted-foreground">
                    {f.olusturanId ? (kullaniciAdlari.get(f.olusturanId) ?? "—") : "—"}
                  </td>
                  <td className="text-muted-foreground">
                    {f.onaylayanId ? (kullaniciAdlari.get(f.onaylayanId) ?? "—") : "—"}
                    {f.onayTarihi ? ` · ${tarih(f.onayTarihi)}` : ""}
                  </td>
                </tr>
              ))}
              {fisler.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    Henüz sayım fişi açılmamış.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
