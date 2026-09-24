import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { sayilmayanStoklariGetir, kullaniciAdiHaritasi } from "../veri"
import { SayimFisButonlari } from "@/components/stok/sayim-fis-butonlari"
import { SayimDurumRozeti } from "@/components/stok/sayim-durum-rozeti"
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
  const fis = await prisma.sayimFisi.findUnique({ where: { id: Number(id) }, select: { fisNo: true } })
  return { title: fis ? `Sayım Fişi ${fis.fisNo}` : "Sayım Fişi" }
}

export default async function SayimFisDetay({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("stok", "gor")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const fis = await prisma.sayimFisi.findUnique({
    where: { id },
    include: {
      depo: { select: { ad: true } },
      kalemler: {
        include: { stok: { select: { kod: true, ad: true, birim: true } } },
        orderBy: { stok: { ad: "asc" } },
      },
    },
  })
  if (!fis) notFound()

  const [kullaniciAdlari, sayilmayanlar] = await Promise.all([
    kullaniciAdiHaritasi([fis.olusturanId, fis.onaylayanId]),
    sayilmayanStoklariGetir({ id: fis.id, depoId: fis.depoId, urunGrubu: fis.urunGrubu }),
  ])

  const farkliSatirlar = fis.kalemler.filter((k) => Number(k.fark.toString()) !== 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[1rem] font-semibold">
            {fis.fisNo}
            <SayimDurumRozeti durum={fis.durum} />
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {tarih(fis.tarih)} · {fis.depo?.ad ?? "Tüm depolar"}
            {fis.urunGrubu ? ` · ${fis.urunGrubu}` : ""} · Açan:{" "}
            {fis.olusturanId ? (kullaniciAdlari.get(fis.olusturanId) ?? "—") : "—"}
          </p>
          {fis.aciklama ? (
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">{fis.aciklama}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/stok/sayim">Sayım Fişleri</Link>
          </Button>
          {fis.durum === "TASLAK" ? <SayimFisButonlari id={fis.id} /> : null}
        </div>
      </div>

      {fis.durum === "ONAYLANDI" ? (
        <p className="rounded-sm border border-basari/30 bg-basari-yumusak px-3 py-2 text-[0.8125rem] text-basari">
          Onaylandı — {fis.onaylayanId ? kullaniciAdlari.get(fis.onaylayanId) : "—"}
          {fis.onayTarihi ? `, ${tarih(fis.onayTarihi)}` : ""}. {farkliSatirlar.length} kalemde
          fark stok hareketi olarak işlendi.
        </p>
      ) : null}
      {fis.durum === "IPTAL" ? (
        <p className="rounded-sm border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          Bu fiş iptal edildi, hiçbir stok hareketi işlenmedi.
        </p>
      ) : null}

      <div className="panel overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-[0.875rem] font-semibold">
            Sayılan Kalemler ({fis.kalemler.length})
          </h2>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Ürün Adı</th>
                <th className="text-right">Sistem Miktarı</th>
                <th className="text-right">Sayılan Miktar</th>
                <th className="text-right">Fark</th>
              </tr>
            </thead>
            <tbody>
              {fis.kalemler.map((k) => {
                const fark = Number(k.fark.toString())
                return (
                  <tr key={k.id}>
                    <td className="font-mono text-[0.75rem]">{k.stok.kod}</td>
                    <td className="max-w-[24rem] truncate font-medium">{k.stok.ad}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {miktar(k.sistemMiktar)} {k.stok.birim}
                    </td>
                    <td className="text-right tabular-nums">
                      {miktar(k.sayilanMiktar)} {k.stok.birim}
                    </td>
                    <td className="text-right tabular-nums">
                      {fark === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <span className={fark > 0 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                          {fark > 0 ? "+" : ""}
                          {miktar(fark)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {fis.kalemler.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Kalem yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-[0.875rem] font-semibold">
            Sayılmayan Stoklar ({sayilmayanlar.length})
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Fişin filtresine uyan ama bu fişte satırı olmayan stoklar.
          </p>
        </div>
        <div className="max-h-[20rem] overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Ürün Adı</th>
                <th className="text-right">Sistem Miktarı</th>
              </tr>
            </thead>
            <tbody>
              {sayilmayanlar.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-[0.75rem]">{s.kod}</td>
                  <td className="max-w-[24rem] truncate font-medium">{s.ad}</td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {miktar(s.mevcutMiktar)} {s.birim}
                  </td>
                </tr>
              ))}
              {sayilmayanlar.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    Filtredeki tüm stoklar sayılmış.
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
