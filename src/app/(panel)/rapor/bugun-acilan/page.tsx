import type { Metadata } from "next"
import Link from "next/link"
import { UserPlus } from "lucide-react"

import { bugunAcilanCarilerVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { CARI_TUR_ADLARI } from "../../cari/sema"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Bugün Açılan Cariler" }
export const dynamic = "force-dynamic"

/**
 * BUGÜN AÇILAN CARİLER (ADIM 10.9.a)
 *
 * 10.1-10.8'in tamamı CariHareket ya da Evrak'a bakıyordu; bu rapor
 * doğrudan `Cari.olusturmaTarihi`'ne bakan ilk rapor — "hangi cari ne zaman
 * açıldı" sorusu. Gerekçe ve `/cari?durum=bugun` hızlı filtresinden farkı
 * `veri.ts`teki `bugunAcilanCarilerVerisi` yorumunda.
 */
export default async function BugunAcilanCarilerRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri & { turu?: string }>
}) {
  await yetkiliOturum("cari", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }
  const turu = sp.turu ?? ""

  const satirlar = await bugunAcilanCarilerVerisi(filtreler, turu)

  const disaAktarParam = new URLSearchParams(raporSorgusu(filtreler).replace(/^\?/, ""))
  if (turu) disaAktarParam.set("turu", turu)
  const disaAktarYol = `/rapor/bugun-acilan/disa-aktar?${disaAktarParam.toString()}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Bugün Açılan Cariler</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Tarih aralığında açılmış cari kartları — {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre
          yol="/rapor/bugun-acilan"
          bas={filtreler.bas}
          bit={filtreler.bit}
          ekAlan={
            <div className="form-alani">
              <label htmlFor="turu" className="form-etiket">
                Tür
              </label>
              <select
                id="turu"
                name="turu"
                defaultValue={turu}
                className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <option value="">Tümü</option>
                {Object.entries(CARI_TUR_ADLARI).map(([deger, etiket]) => (
                  <option key={deger} value={deger}>
                    {etiket}
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
            <UserPlus className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta açılmış cari yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th className="w-28">Kod</th>
                  <th>Ünvan</th>
                  <th className="w-24">Tür</th>
                  <th className="w-32">Telefon</th>
                  <th className="w-32">VKN</th>
                  <th className="w-36">Oluşturan</th>
                  <th className="w-40">Oluşturma</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">
                      <Link href={`/cari/${s.id}`} className="text-primary hover:underline">
                        {s.kod}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] truncate font-medium">{s.unvan}</td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {CARI_TUR_ADLARI[s.turu as keyof typeof CARI_TUR_ADLARI] ?? s.turu}
                    </td>
                    <td className="whitespace-nowrap">{s.telefon || "—"}</td>
                    <td className="font-mono text-[0.75rem] whitespace-nowrap">{s.vergiNo || "—"}</td>
                    <td className="whitespace-nowrap">{s.olusturanAdi}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{tarihSaat(s.olusturmaTarihi)}</td>
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
