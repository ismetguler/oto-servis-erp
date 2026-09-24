import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList } from "lucide-react"

import { envanterVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { miktar, para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Depo Envanteri" }
export const dynamic = "force-dynamic"

/**
 * ENVANTER (ADIM 10.10.b) — Stok Son Durum'un özet/kırılımından farkı ve
 * tarih aralığının burada neden sorguyu daraltmadığı `veri.ts`teki
 * `envanterVerisi` yorumunda.
 */
export default async function EnvanterRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri & { depo?: string }>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }
  const depoId = sp.depo ?? ""

  const [satirlar, depolar] = await Promise.all([
    envanterVerisi(filtreler, depoId || undefined),
    prisma.depo.findMany({ where: { aktif: true }, orderBy: { ad: "asc" }, select: { id: true, ad: true } }),
  ])

  const toplamDeger = satirlar.reduce((t, s) => t + s.toplamDeger, 0)

  const disaAktarParam = new URLSearchParams(raporSorgusu(filtreler).replace(/^\?/, ""))
  if (depoId) disaAktarParam.set("depo", depoId)
  const disaAktarYol = `/rapor/envanter/disa-aktar?${disaAktarParam.toString()}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Depo Envanteri</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Her stok kartının tam dökümü — {satirlar.length} kayıt, toplam {para(toplamDeger)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre
          yol="/rapor/envanter"
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
            <ClipboardList className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Aktif stok kartı yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ürün Adı</th>
                  <th>Depo</th>
                  <th>Raf</th>
                  <th className="text-right">Mevcut</th>
                  <th className="text-right">Birim Maliyet</th>
                  <th className="text-right">Toplam Değer</th>
                  <th className="w-32">Aralıkta Güncellendi</th>
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
                    <td className="text-muted-foreground whitespace-nowrap">{s.depoAdi}</td>
                    <td className="text-muted-foreground whitespace-nowrap">{s.rafYeri || "—"}</td>
                    <td className="text-right tabular-nums">
                      {miktar(s.mevcutMiktar)} {s.birim}
                    </td>
                    <td className="text-right tabular-nums">{para(s.ortalamaMaliyet)}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.toplamDeger)}</td>
                    <td className="text-muted-foreground">{s.araliktaGuncellendi ? "Evet" : "Hayır"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={6}>Toplam</td>
                  <td className="text-right tabular-nums">{para(toplamDeger)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
