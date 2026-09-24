import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { belgeEtiketiCoz, belgeNoHaritalari, donemBasiBakiye } from "./veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { gunSonu, miktar, para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Stok Hareket Dökümü" }
export const dynamic = "force-dynamic"

const HAREKET_ADI: Record<string, string> = {
  GIRIS: "Giriş",
  CIKIS: "Çıkış",
  DEVIR: "Devir",
  SAYIM: "Sayım Farkı",
  TRANSFER: "Transfer",
}

/** Çıkış hareketleri miktarı düşürür, diğerleri arttırır (stok/actions.ts'teki mevcutMiktar mantığıyla aynı). */
function isaretliMiktar(tur: string, miktar: number) {
  return tur === "CIKIS" ? -miktar : miktar
}

/** Varsayılan aralık: içinde bulunduğumuz yılın başından bugüne. */
function varsayilanAralik() {
  const bugun = new Date()
  return {
    bas: `${bugun.getFullYear()}-01-01`,
    bit: bugun.toISOString().slice(0, 10),
  }
}

export default async function StokHareketleri({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  await yetkiliOturum("stok", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const varsayilan = varsayilanAralik()
  const s = await searchParams
  const bas = s.bas || varsayilan.bas
  const bit = s.bit || varsayilan.bit

  const baslangic = new Date(`${bas}T00:00:00`)
  const bitis = gunSonu(new Date(`${bit}T00:00:00`))

  const stok = await prisma.stok.findUnique({
    where: { id: kayitId },
    select: { id: true, kod: true, ad: true, birim: true, mevcutMiktar: true },
  })
  if (!stok) notFound()

  const [devir, hareketler] = await Promise.all([
    // Dönem başı bakiyesi: DEVIR satırı olan kartta önceki hareketlerin neti,
    // olmayan (eski) kartta mevcutMiktar'dan geriye türetilmiş değer — Z5-B.
    donemBasiBakiye(kayitId, baslangic, Number(stok.mevcutMiktar.toString())),
    prisma.stokHareket.findMany({
      where: { stokId: kayitId, tarih: { gte: baslangic, lte: bitis } },
      orderBy: [{ tarih: "asc" }, { id: "asc" }],
      select: {
        id: true,
        tarih: true,
        tur: true,
        miktar: true,
        birimFiyat: true,
        tutar: true,
        kabulId: true,
        evrakId: true,
        aciklama: true,
        kullaniciId: true,
      },
    }),
  ])

  // StokHareket'te Kullanici'ya Prisma ilişkisi tanımlı değil (yalnız
  // kullaniciId sütunu var), bu yüzden ad-soyad ayrı bir sorguyla eşleniyor.
  const kullaniciIdler = [...new Set(hareketler.map((h) => h.kullaniciId).filter((v): v is number => v != null))]
  const kullanicilar = kullaniciIdler.length
    ? await prisma.kullanici.findMany({
        where: { id: { in: kullaniciIdler } },
        select: { id: true, ad: true, soyad: true },
      })
    : []
  const kullaniciAdiMap = new Map(kullanicilar.map((k) => [k.id, `${k.ad} ${k.soyad ?? ""}`.trim()]))

  const { kabulNolari, evrakNolari } = await belgeNoHaritalari(hareketler)

  const satirlar = hareketler.reduce<
    Array<{
      id: number
      tarih: Date
      tur: string
      isaretliMiktar: number
      birimFiyat: number
      tutar: number
      belgeEtiketi: string
      belgeYolu: string | null
      kullaniciAdi: string
      kalan: number
    }>
  >((liste, h) => {
    const im = isaretliMiktar(h.tur, Number(h.miktar.toString()))
    const onceki = liste.at(-1)?.kalan ?? devir
    liste.push({
      id: h.id,
      tarih: h.tarih,
      tur: h.tur,
      isaretliMiktar: im,
      birimFiyat: Number(h.birimFiyat.toString()),
      tutar: Number(h.tutar.toString()),
      belgeEtiketi: belgeEtiketiCoz(h, kabulNolari, evrakNolari),
      belgeYolu: h.kabulId ? `/servis/kabul/${h.kabulId}` : null,
      kullaniciAdi: h.kullaniciId ? (kullaniciAdiMap.get(h.kullaniciId) ?? "—") : "—",
      kalan: onceki + im,
    })
    return liste
  }, [])

  const kapanis = satirlar.at(-1)?.kalan ?? devir
  const toplamGiris = satirlar.filter((h) => h.isaretliMiktar > 0).reduce((t, h) => t + h.isaretliMiktar, 0)
  const toplamCikis = satirlar.filter((h) => h.isaretliMiktar < 0).reduce((t, h) => t - h.isaretliMiktar, 0)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="yazdirma-disi">
            <Link href={`/stok/${stok.id}`} aria-label="Stok kartına dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Stok Hareket Dökümü
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {stok.ad} · <span className="font-mono">{stok.kod}</span> · Şu an{" "}
              {miktar(stok.mevcutMiktar)} {stok.birim}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/stok/${stok.id}/hareketler/disa-aktar?bas=${bas}&bit=${bit}`}
          />
        </div>
      </div>

      <form
        method="get"
        className="yazdirma-disi flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Başlangıç
          </label>
          <input
            id="bas"
            name="bas"
            type="date"
            defaultValue={bas}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Bitiş
          </label>
          <input
            id="bit"
            name="bit"
            type="date"
            defaultValue={bit}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
        <Button type="submit" size="sm">
          Getir
        </Button>
      </form>

      <div className="p-4">
        <div className="panel overflow-hidden">
          <div className="yazdirma-alani overflow-x-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-32">Tarih</th>
                  <th className="w-24">Tür</th>
                  <th>Belge</th>
                  <th className="w-32">Kullanıcı</th>
                  <th className="w-28 text-right">Giriş</th>
                  <th className="w-28 text-right">Çıkış</th>
                  <th className="w-28 text-right">Tutar</th>
                  <th className="w-28 text-right">Kalan</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-secondary/40 font-medium">
                  <td>{tarih(baslangic)}</td>
                  <td className="text-muted-foreground">Devir</td>
                  <td>Önceki dönemden devreden miktar</td>
                  <td />
                  <td className="text-right">{devir > 0 ? miktar(devir) : "—"}</td>
                  <td className="text-right">{devir < 0 ? miktar(Math.abs(devir)) : "—"}</td>
                  <td />
                  <td className="text-right">{miktar(devir)}</td>
                </tr>

                {satirlar.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      Bu tarih aralığında hareket yok.
                    </td>
                  </tr>
                ) : (
                  satirlar.map((h) => (
                    <tr key={h.id}>
                      <td>{tarih(h.tarih)}</td>
                      <td className="text-muted-foreground">{HAREKET_ADI[h.tur] ?? h.tur}</td>
                      <td className="max-w-[20rem] truncate">
                        {h.belgeYolu ? (
                          <Link href={h.belgeYolu} className="text-primary hover:underline">
                            {h.belgeEtiketi}
                          </Link>
                        ) : (
                          h.belgeEtiketi
                        )}
                      </td>
                      <td className="text-muted-foreground">{h.kullaniciAdi}</td>
                      <td className="text-right">
                        {h.isaretliMiktar > 0 ? miktar(h.isaretliMiktar) : "—"}
                      </td>
                      <td className="text-right">
                        {h.isaretliMiktar < 0 ? miktar(Math.abs(h.isaretliMiktar)) : "—"}
                      </td>
                      <td className="text-right">{h.tutar ? para(h.tutar) : "—"}</td>
                      <td className="text-right font-medium">{miktar(h.kalan)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Dönem Toplamı
                  </td>
                  <td className="px-3 py-2 text-right">{miktar(toplamGiris)}</td>
                  <td className="px-3 py-2 text-right">{miktar(toplamCikis)}</td>
                  <td />
                  <td className="px-3 py-2 text-right">{miktar(kapanis)} {stok.birim}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
