import type { Metadata } from "next"
import Link from "next/link"
import { FilePlus2 } from "lucide-react"

import { alinanSiparisleriGetir } from "./veri"
import { SiparisDurumRozeti } from "@/components/siparis/durum-rozeti"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Alınan Siparişler" }
export const dynamic = "force-dynamic"

type Aramalar = { q?: string; durum?: string; bas?: string; bit?: string }

/** Alınan sipariş listesi — Alış Evrakları listesindeki desenin aynısı. */
export default async function AlinanSiparisler({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("siparis", "gor")
  const f = await searchParams
  const siparisler = await alinanSiparisleriGetir(f)

  const genelToplam = siparisler
    .filter((s) => s.durum !== "IPTAL")
    .reduce((t, s) => t + Number(s.genelToplam.toString()), 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1rem] font-semibold">Alınan Siparişler</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {siparisler.length} sipariş · geçerli toplam {para(genelToplam)}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/siparis/alinan/yeni">
            <FilePlus2 className="size-4" aria-hidden />
            Yeni Sipariş
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-2 panel p-3">
        <FiltreAlani ad="q" etiket="Ara" tip="text" deger={f.q} yerTutucu="sipariş no / cari" />
        <div className="form-alani">
          <label className="form-etiket" htmlFor="durum">
            Durum
          </label>
          <select
            id="durum"
            name="durum"
            defaultValue={f.durum ?? ""}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem]"
          >
            <option value="">Tümü</option>
            <option value="TASLAK">Taslak</option>
            <option value="ONAYLANDI">Onaylandı</option>
            <option value="KISMI_SEVK">Kısmi Sevk</option>
            <option value="TAMAMLANDI">Tamamlandı</option>
            <option value="IPTAL">İptal</option>
          </select>
        </div>
        <FiltreAlani ad="bas" etiket="Başlangıç" tip="date" deger={f.bas} />
        <FiltreAlani ad="bit" etiket="Bitiş" tip="date" deger={f.bit} />
        <Button type="submit" size="sm" variant="secondary">
          Filtrele
        </Button>
      </form>

      <div className="panel overflow-hidden">
        <div className="overflow-auto">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Tarih</th>
                <th>Müşteri</th>
                <th className="text-right">Genel Toplam</th>
                <th className="text-right">Bakiye (kalem)</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {siparisler.map((s) => {
                const bakiyeliKalem = s.kalemler.filter(
                  (k) => Number(k.miktar.toString()) - Number(k.sevkMiktar.toString()) > 0
                ).length
                return (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/siparis/alinan/${s.id}`}
                        className="font-mono text-[0.75rem] text-primary hover:underline"
                      >
                        {s.siparisNo}
                      </Link>
                    </td>
                    <td className="text-muted-foreground">{tarih(s.tarih)}</td>
                    <td>
                      {s.cari.unvan}
                      <span className="ml-1 text-muted-foreground">({s.cari.kod})</span>
                    </td>
                    <td className="text-right tabular-nums">{para(Number(s.genelToplam.toString()), false)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {s.durum === "IPTAL" ? "—" : `${bakiyeliKalem}/${s.kalemler.length} satır`}
                    </td>
                    <td>
                      <SiparisDurumRozeti durum={s.durum} />
                    </td>
                  </tr>
                )
              })}
              {siparisler.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Henüz sipariş oluşturulmamış.
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

function FiltreAlani({
  ad,
  etiket,
  tip,
  deger,
  yerTutucu,
}: {
  ad: string
  etiket: string
  tip: string
  deger?: string
  yerTutucu?: string
}) {
  return (
    <div className="form-alani">
      <label className="form-etiket" htmlFor={ad}>
        {etiket}
      </label>
      <input
        id={ad}
        name={ad}
        type={tip}
        defaultValue={deger ?? ""}
        placeholder={yerTutucu}
        className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem]"
      />
    </div>
  )
}
