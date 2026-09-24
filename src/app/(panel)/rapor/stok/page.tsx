import type { Metadata } from "next"
import { Boxes } from "lucide-react"

import { stokSonDurumVerisi, raporSorgusu, varsayilanRaporAraligi, type RaporTarihFiltreleri } from "../veri"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { TarihAraligiFiltre } from "@/components/rapor/tarih-araligi-filtre"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Son Durum" }
export const dynamic = "force-dynamic"

/**
 * STOK SON DURUM (ADIM 10.10.a) — gerekçe ve tarih aralığının bu raporda
 * neden sorguyu daraltmadığı `veri.ts`teki `stokSonDurumVerisi` yorumunda.
 */
export default async function StokSonDurumRapor({
  searchParams,
}: {
  searchParams: Promise<RaporTarihFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const sp = await searchParams
  const varsayilan = varsayilanRaporAraligi()
  const filtreler = { bas: sp.bas ?? varsayilan.bas, bit: sp.bit ?? varsayilan.bit }

  const ozet = await stokSonDurumVerisi(filtreler)

  const disaAktarYol = `/rapor/stok/disa-aktar${raporSorgusu(filtreler)}`

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Son Durum</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Şu an depo/ürün grubu bazında mevcut miktar ve değer — {ozet.toplamUrunSayisi} kart
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={disaAktarYol} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <TarihAraligiFiltre yol="/rapor/stok" bas={filtreler.bas} bit={filtreler.bit} />
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <OzetKarti etiket="Toplam Kart" deger={String(ozet.toplamUrunSayisi)} />
          <OzetKarti etiket="Toplam Değer" deger={para(ozet.toplamDeger)} vurgu />
          <OzetKarti etiket="Kritik Stok" deger={String(ozet.kritikSayisi)} renk="text-tehlike" />
          <OzetKarti etiket="Sıfır Stok" deger={String(ozet.sifirSayisi)} renk="text-muted-foreground" />
          <OzetKarti etiket="Negatif Stok" deger={String(ozet.negatifSayisi)} renk="text-tehlike" />
          <OzetKarti etiket="Aralıkta Güncellenen" deger={String(ozet.araliktaGuncellenenSayisi)} />
        </div>

        {ozet.toplamUrunSayisi === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Boxes className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[0.875rem] font-medium">Aktif stok kartı yok</p>
          </div>
        ) : (
          <div className="[&>*]:min-w-0 grid gap-4 lg:grid-cols-2">
            <Kirilim baslik="Depo Bazında" satirlar={ozet.depoKirilimi} />
            <Kirilim baslik="Ürün Grubu Bazında" satirlar={ozet.grupKirilimi} />
          </div>
        )}
      </div>
    </div>
  )
}

function OzetKarti({
  etiket,
  deger,
  vurgu,
  renk,
}: {
  etiket: string
  deger: string
  vurgu?: boolean
  renk?: string
}) {
  return (
    <div className="panel px-3 py-2.5">
      <p className="text-[0.75rem] text-muted-foreground">{etiket}</p>
      <p className={`text-[1.0625rem] font-semibold tabular-nums ${vurgu ? "text-primary" : (renk ?? "")}`}>
        {deger}
      </p>
    </div>
  )
}

function Kirilim({
  baslik,
  satirlar,
}: {
  baslik: string
  satirlar: { anahtar: string; urunSayisi: number; toplamDeger: number }[]
}) {
  const toplam = satirlar.reduce((t, s) => t + s.toplamDeger, 0)
  return (
    <div className="panel overflow-auto">
      <div className="border-b border-border px-3 py-2 text-[0.8125rem] font-semibold">{baslik}</div>
      <table className="veri-tablosu">
        <thead>
          <tr>
            <th>Adı</th>
            <th className="text-right">Kart</th>
            <th className="text-right">Toplam Değer</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => (
            <tr key={s.anahtar}>
              <td className="font-medium">{s.anahtar}</td>
              <td className="text-right tabular-nums">{s.urunSayisi}</td>
              <td className="text-right tabular-nums">{para(s.toplamDeger)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td>Toplam</td>
            <td className="text-right tabular-nums">{satirlar.reduce((t, s) => t + s.urunSayisi, 0)}</td>
            <td className="text-right tabular-nums">{para(toplam)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
