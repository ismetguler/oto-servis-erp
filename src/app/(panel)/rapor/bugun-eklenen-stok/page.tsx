import type { Metadata } from "next"
import Link from "next/link"
import { PackagePlus } from "lucide-react"

import { bugunEklenenStokVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Bugün Eklenenler" }
export const dynamic = "force-dynamic"

/**
 * BUGÜN EKLENENLER (ADIM 10.13.c) — 10.9 Bugün Açılan Cariler'in stok
 * karşılığı, AYNI DESEN. Gerekçe `veri.ts`teki `bugunEklenenStokVerisi`
 * yorumunda. Tarih aralığı SORGUYU DARALTIR (10.9 ile birebir aynı mantık).
 */
export default async function BugunEklenenStokRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri & { depo?: string; grup?: string }>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }
  const depoId = sp.depo ?? ""
  const urunGrubu = sp.grup ?? ""

  const [satirlar, depolar] = await Promise.all([
    bugunEklenenStokVerisi(filtreler, depoId, urunGrubu),
    prisma.depo.findMany({ where: { aktif: true }, orderBy: { ad: "asc" }, select: { id: true, ad: true } }),
  ])

  const disaAktarParam = new URLSearchParams(raporSorgusu(filtreler).replace(/^\?/, ""))
  if (depoId) disaAktarParam.set("depo", depoId)
  if (urunGrubu) disaAktarParam.set("grup", urunGrubu)
  const disaAktarYol = `/rapor/bugun-eklenen-stok/disa-aktar?${disaAktarParam.toString()}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Bugün Eklenenler</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Seçili aralıkta oluşturulan stok kartları — {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre
          yol="/rapor/bugun-eklenen-stok"
          bas={filtreler.bas}
          bit={filtreler.bit}
          ekAlan={
            <div className="form-alani">
              <label htmlFor="depo" className="form-etiket">
                Depo
              </label>
              <select
                id="depo"
                name="depo"
                defaultValue={depoId}
                className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <option value="">Tüm Depolar</option>
                {depolar.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.ad}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <PackagePlus className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta eklenen stok kartı yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Grup</th>
                  <th>Depo</th>
                  <th className="text-right">Mevcut</th>
                  <th className="text-right">Satış Fiyatı</th>
                  <th>Ekleyen</th>
                  <th>Eklenme Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/stok/${s.id}`} className="text-primary hover:underline">
                        {s.kod}
                      </Link>
                    </td>
                    <td className="max-w-[18rem] truncate font-medium">{s.ad}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.urunGrubu}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.depoAdi}</td>
                    <td className="text-right tabular-nums">{miktar(s.mevcutMiktar)}</td>
                    <td className="text-right tabular-nums">{para(s.satisFiyat)}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.olusturanAdi}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{tarihSaat(s.olusturmaTarihi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
