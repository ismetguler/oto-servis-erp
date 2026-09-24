import type { Metadata } from "next"
import Link from "next/link"

import { sayimIcinStoklariGetir } from "../veri"
import { SayimFormu } from "@/components/stok/sayim-formu"
import { Button } from "@/components/ui/button"
import { filtreSecenekleriGetir } from "../../veri"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Sayım Fişi" }
export const dynamic = "force-dynamic"

type Aramalar = { depo?: string; grup?: string }

/**
 * Yeni sayım fişi: önce depo/ürün grubu filtresi (GET — Toplu Fiyat
 * Güncelleme'deki desenin aynısı), filtre seçilince aşağıda sayılacak
 * stoklar listelenir. Hiç filtre girilmeden de "Listele" ile TÜM aktif
 * stoklar gelir — filtre zorunlu değil.
 */
export default async function YeniSayimFisi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("stok", "ekle")
  const p = await searchParams
  const depo = p.depo ?? ""
  const grup = p.grup ?? ""

  const [secenekler, kayitlar] = await Promise.all([
    filtreSecenekleriGetir(),
    sayimIcinStoklariGetir(depo ? Number(depo) : null, grup || null),
  ])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[1rem] font-semibold">Yeni Sayım Fişi</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stok/sayim">Sayım Fişleri</Link>
        </Button>
      </div>

      <form
        method="get"
        className="panel flex flex-wrap items-end gap-2 p-3"
      >
        <div className="form-alani">
          <label htmlFor="depo" className="form-etiket">
            Depo
          </label>
          <select
            id="depo"
            name="depo"
            defaultValue={depo}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Tümü</option>
            {secenekler.depolar.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="grup" className="form-etiket">
            Ürün Grubu
          </label>
          <select
            id="grup"
            name="grup"
            defaultValue={grup}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Tümü</option>
            {secenekler.urunGruplari.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        {depo || grup ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/stok/sayim/yeni">Temizle</Link>
          </Button>
        ) : null}
      </form>

      <SayimFormu
        depoId={depo}
        urunGrubu={grup}
        kayitlar={kayitlar.map((k) => ({
          id: k.id,
          kod: k.kod,
          ad: k.ad,
          birim: k.birim,
          mevcutMiktar: Number(k.mevcutMiktar.toString()),
          depoAdi: k.depo?.ad ?? null,
        }))}
      />
    </div>
  )
}
