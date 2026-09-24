import type { Metadata } from "next"
import Link from "next/link"

import { transferDepolariGetir, transferIcinStoklariGetir } from "../veri"
import { TransferFormu } from "@/components/stok/transfer-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Transfer Fişi" }
export const dynamic = "force-dynamic"

type Aramalar = { kaynak?: string; hedef?: string }

/**
 * Yeni transfer fişi: önce kaynak/hedef depo seçimi (GET — Sayım'daki
 * depo/ürün grubu filtresinin aynı deseni), ikisi de seçilince aşağıda
 * kaynak depodaki kartlar checkbox ile listelenir.
 */
export default async function YeniTransferFisi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("stok", "ekle")
  const p = await searchParams
  const kaynak = p.kaynak ?? ""
  const hedef = p.hedef ?? ""

  const [depolar, kayitlar] = await Promise.all([
    transferDepolariGetir(),
    transferIcinStoklariGetir(kaynak ? Number(kaynak) : null),
  ])

  const aynıDepo = kaynak !== "" && kaynak === hedef

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[1rem] font-semibold">Yeni Transfer Fişi</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stok/transfer">Transfer Fişleri</Link>
        </Button>
      </div>

      <form method="get" className="panel flex flex-wrap items-end gap-2 p-3">
        <div className="form-alani">
          <label htmlFor="kaynak" className="form-etiket">
            Kaynak Depo
          </label>
          <select
            id="kaynak"
            name="kaynak"
            defaultValue={kaynak}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Seçiniz</option>
            {depolar.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="hedef" className="form-etiket">
            Hedef Depo
          </label>
          <select
            id="hedef"
            name="hedef"
            defaultValue={hedef}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Seçiniz</option>
            {depolar.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        {kaynak || hedef ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/stok/transfer/yeni">Temizle</Link>
          </Button>
        ) : null}
      </form>

      {aynıDepo ? (
        <p className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-[0.8125rem] text-destructive">
          Kaynak ve hedef depo aynı olamaz.
        </p>
      ) : null}

      {kaynak && hedef && !aynıDepo ? (
        <TransferFormu
          kaynakDepoId={kaynak}
          hedefDepoId={hedef}
          kayitlar={kayitlar.map((k) => ({
            id: k.id,
            kod: k.kod,
            ad: k.ad,
            birim: k.birim,
            mevcutMiktar: Number(k.mevcutMiktar.toString()),
          }))}
        />
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">
          Devam etmek için kaynak ve hedef depoyu seçip &quot;Listele&quot;ye tıklayın.
        </p>
      )}
    </div>
  )
}
