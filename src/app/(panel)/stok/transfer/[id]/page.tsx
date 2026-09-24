import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { kullaniciAdiHaritasi } from "../veri"
import { TransferFisButonlari } from "@/components/stok/transfer-fis-butonlari"
import { TransferDurumRozeti } from "@/components/stok/transfer-durum-rozeti"
import { Button } from "@/components/ui/button"
import { miktar, tarih } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const fis = await prisma.stokTransferFisi.findUnique({ where: { id: Number(id) }, select: { fisNo: true } })
  return { title: fis ? `Transfer Fişi ${fis.fisNo}` : "Transfer Fişi" }
}

export default async function TransferFisDetay({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("stok", "gor")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const fis = await prisma.stokTransferFisi.findUnique({
    where: { id },
    include: {
      kaynakDepo: { select: { ad: true } },
      hedefDepo: { select: { ad: true } },
      kalemler: {
        include: { stok: { select: { kod: true, ad: true, birim: true } } },
        orderBy: { stok: { ad: "asc" } },
      },
    },
  })
  if (!fis) notFound()

  const kullaniciAdlari = await kullaniciAdiHaritasi([fis.olusturanId, fis.onaylayanId, fis.geriAlanId])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[1rem] font-semibold">
            {fis.fisNo}
            <TransferDurumRozeti durum={fis.durum} />
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {tarih(fis.tarih)} · {fis.kaynakDepo.ad} → {fis.hedefDepo.ad} · Açan:{" "}
            {fis.olusturanId ? (kullaniciAdlari.get(fis.olusturanId) ?? "—") : "—"}
          </p>
          {fis.aciklama ? (
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">{fis.aciklama}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/stok/transfer">Transfer Fişleri</Link>
          </Button>
          {fis.durum === "TASLAK" || fis.durum === "ONAYLANDI" ? (
            <TransferFisButonlari id={fis.id} durum={fis.durum} />
          ) : null}
        </div>
      </div>

      {fis.durum === "ONAYLANDI" ? (
        <p className="rounded-sm border border-basari/30 bg-basari-yumusak px-3 py-2 text-[0.8125rem] text-basari">
          Onaylandı — {fis.onaylayanId ? kullaniciAdlari.get(fis.onaylayanId) : "—"}
          {fis.onayTarihi ? `, ${tarih(fis.onayTarihi)}` : ""}. {fis.kalemler.length} kart {fis.hedefDepo.ad}&apos;na
          taşındı.
        </p>
      ) : null}
      {fis.durum === "IPTAL" ? (
        <p className="rounded-sm border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          Bu fiş iptal edildi, hiçbir stok hareketi işlenmedi.
        </p>
      ) : null}
      {fis.durum === "GERI_ALINDI" ? (
        <p className="rounded-sm border border-border bg-muted px-3 py-2 text-[0.8125rem] text-muted-foreground">
          Bu transfer geri alındı — {fis.geriAlanId ? kullaniciAdlari.get(fis.geriAlanId) : "—"}
          {fis.geriAlmaTarihi ? `, ${tarih(fis.geriAlmaTarihi)}` : ""}. Kartlar {fis.kaynakDepo.ad}&apos;a
          döndü.
        </p>
      ) : null}

      <div className="panel overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-[0.875rem] font-semibold">Taşınan Kartlar ({fis.kalemler.length})</h2>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Ürün Adı</th>
                <th className="text-right">Miktar</th>
              </tr>
            </thead>
            <tbody>
              {fis.kalemler.map((k) => (
                <tr key={k.id}>
                  <td className="font-mono text-[0.75rem]">{k.stok.kod}</td>
                  <td className="max-w-[24rem] truncate font-medium">{k.stok.ad}</td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {miktar(k.miktar)} {k.stok.birim}
                  </td>
                </tr>
              ))}
              {fis.kalemler.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    Kalem yok.
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
