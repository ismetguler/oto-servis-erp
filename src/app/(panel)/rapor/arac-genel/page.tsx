import type { Metadata } from "next"
import Link from "next/link"
import { Car } from "lucide-react"

import {
  aracGenelVerisi,
  raporSorgusu,
  varsayilanRaporAraligi,
  type RaporTarihFiltreleri,
} from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Araç Genel Durum" }
export const dynamic = "force-dynamic"

/**
 * ARAÇ GENEL (ADIM 10.3)
 *
 * Araç bazında genel özet — Cari mizanının araç karşılığı. Araç
 * modülündeki garanti/sigorta raporundan farkı: bu TÜM araçların genel
 * istatistiği (kaç kez kabul, toplam harcama, son giriş/teslim), o rapor
 * tekil garanti/sigorta takibiydi. Hesap yöntemi rapor/veri.ts'de açıklanıyor.
 */
export default async function AracGenel({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("rapor", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const satirlar = await aracGenelVerisi(filtreler)

  const toplam = satirlar.reduce(
    (t, s) => ({ kabulSayisi: t.kabulSayisi + s.kabulSayisi, genelToplam: t.genelToplam + s.genelToplam }),
    { kabulSayisi: 0, genelToplam: 0 }
  )

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Araç Genel Durum</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Araç bazında kabul sayısı, toplam harcama, giriş/teslim geçmişi — {satirlar.length} araç
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/rapor/arac-genel/disa-aktar${raporSorgusu(filtreler)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/arac-genel" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4">
        {satirlar.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Car className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Bu aralıkta teslimatı olan araç yok</p>
          </div>
        ) : (
          <div className="panel overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Plaka</th>
                  <th>Marka/Model</th>
                  <th>Müşteri</th>
                  <th className="text-right">Kabul Sayısı</th>
                  <th className="text-right">Toplam Harcama</th>
                  <th>İlk Kayıt</th>
                  <th>Son Giriş</th>
                  <th>Son Teslim</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium whitespace-nowrap">
                      <Link href={`/arac/${s.id}`} className="text-primary hover:underline">
                        {plakaBicim(s.plaka)}
                      </Link>
                    </td>
                    <td>{s.markaModel}</td>
                    <td className="max-w-[14rem] truncate">{s.musteri}</td>
                    <td className="text-right tabular-nums">{s.kabulSayisi}</td>
                    <td className="text-right tabular-nums font-medium">{para(s.genelToplam)}</td>
                    <td className="whitespace-nowrap">{tarih(s.ilkKayitTarihi)}</td>
                    <td className="whitespace-nowrap">{tarih(s.sonGirisTarihi)}</td>
                    <td className="whitespace-nowrap">{tarih(s.sonTeslimTarihi)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td colSpan={3} className="text-right">
                    Dönem toplamı
                  </td>
                  <td className="text-right tabular-nums">{toplam.kabulSayisi}</td>
                  <td className="text-right tabular-nums">{para(toplam.genelToplam)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
