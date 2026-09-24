import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightLeft } from "lucide-react"

import { kullaniciAdiHaritasi } from "./veri"
import { TransferDurumRozeti } from "@/components/stok/transfer-durum-rozeti"
import { Button } from "@/components/ui/button"
import { tarih } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Depo Transferleri" }
export const dynamic = "force-dynamic"

/** Transfer fişleri listesi — geçmiş: kim, ne zaman, hangi depodan hangisine taşıdı. */
export default async function TransferFisleri() {
  await yetkiliOturum("stok", "gor")

  const fisler = await prisma.stokTransferFisi.findMany({
    orderBy: { tarih: "desc" },
    include: {
      kaynakDepo: { select: { ad: true } },
      hedefDepo: { select: { ad: true } },
      _count: { select: { kalemler: true } },
    },
  })

  const kullaniciAdlari = await kullaniciAdiHaritasi(
    fisler.flatMap((f) => [f.olusturanId, f.onaylayanId, f.geriAlanId])
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[1rem] font-semibold">Depo Transferleri</h1>
        <Button size="sm" asChild>
          <Link href="/stok/transfer/yeni">
            <ArrowRightLeft className="size-4" aria-hidden />
            Yeni Transfer
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
                <th>Kaynak Depo</th>
                <th>Hedef Depo</th>
                <th className="text-right">Kart</th>
                <th>Durum</th>
                <th>Açan</th>
                <th>Onaylayan</th>
              </tr>
            </thead>
            <tbody>
              {fisler.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/stok/transfer/${f.id}`} className="font-mono text-[0.75rem] text-primary hover:underline">
                      {f.fisNo}
                    </Link>
                  </td>
                  <td className="text-muted-foreground">{tarih(f.tarih)}</td>
                  <td className="text-muted-foreground">{f.kaynakDepo.ad}</td>
                  <td className="text-muted-foreground">{f.hedefDepo.ad}</td>
                  <td className="text-right tabular-nums">{f._count.kalemler}</td>
                  <td>
                    <TransferDurumRozeti durum={f.durum} />
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
                    Henüz transfer fişi oluşturulmamış.
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
