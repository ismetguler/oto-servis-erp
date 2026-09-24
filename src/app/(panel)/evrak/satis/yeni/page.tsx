import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { faturalanacakKabulGetir, kabulunFaturasi, satisCarileriGetir } from "../veri"
import { EvrakFormu } from "@/components/evrak/evrak-formu"
import { para, plaka as plakaBicim } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Satış Faturası" }
export const dynamic = "force-dynamic"

/**
 * Yeni satış faturası. `?kabulId=` ile gelindiğinde ekran "kabulden faturaya
 * dönüştürme" (adım 9.2) kipine geçer: cari kilitlenir, kart satırları
 * önizlemede gösterilir ve kaydetme anında faturaya kopyalanır. Fatura no
 * yine ELLE giriliyor (9.1'deki karar; otomatik numaratör yok).
 */
export default async function YeniSatisFaturasi({
  searchParams,
}: {
  searchParams: Promise<{ kabulId?: string }>
}) {
  await yetkiliOturum("evrak", "ekle")
  const { kabulId } = await searchParams
  const kayitId = kabulId ? Number(kabulId) : 0

  const cariler = await satisCarileriGetir()
  if (!kayitId) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-[1rem] font-semibold">Yeni Satış Faturası</h1>
        <div className="panel p-4">
          <EvrakFormu cariler={cariler} />
        </div>
      </div>
    )
  }

  if (!Number.isInteger(kayitId)) notFound()
  const kabul = await faturalanacakKabulGetir(kayitId)
  if (!kabul || kabul.silindi) notFound()

  // Aynı kuralların sunucu tarafındaki tek kaynağı `evrakKaydet`; burada
  // sadece kullanıcı boşuna form doldurmasın diye erkenden söyleniyor.
  const mevcutFatura = await kabulunFaturasi(kabul.id)
  const engel = mevcutFatura
    ? `Bu kabul kartı zaten faturalanmış: ${mevcutFatura.evrakNo}.`
    : kabul.durum !== "TESLIM_EDILDI"
      ? "Yalnız teslim edilmiş kabul kartı faturaya dönüştürülebilir."
      : kabul.kalemler.length === 0
        ? "Satırı olmayan kabul kartı faturalandırılamaz."
        : null

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-[1rem] font-semibold">Kabulden Fatura — {kabul.kabulNo}</h1>
        <p className="text-[0.8125rem] text-muted-foreground">
          {kabul.cari.unvan} ({kabul.cari.kod}) · {plakaBicim(kabul.arac.plaka)} ·{" "}
          {[kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ") || "—"}
        </p>
      </div>

      {engel ? (
        <div className="rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {engel}
        </div>
      ) : null}

      <div className="panel p-4">
        <EvrakFormu
          cariler={cariler}
          kabul={{
            id: kabul.id,
            kabulNo: kabul.kabulNo,
            cariId: kabul.cariId,
            cariUnvan: `${kabul.cari.unvan} (${kabul.cari.kod})`,
            satirSayisi: kabul.kalemler.length,
            genelToplam: Number(kabul.genelToplam.toString()),
            kilitli: engel !== null,
          }}
        />
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Faturaya kopyalanacak satırlar</th>
              <th className="px-3 py-2 text-right font-medium">Miktar</th>
              <th className="px-3 py-2 text-right font-medium">Birim Fiyat</th>
              <th className="px-3 py-2 text-right font-medium">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {kabul.kalemler.map((k) => (
              <tr key={k.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-1.5">{k.aciklama}</td>
                <td className="px-3 py-1.5 text-right">
                  {Number(k.miktar.toString())} {k.birim}
                </td>
                <td className="px-3 py-1.5 text-right">{para(Number(k.birimFiyat.toString()))}</td>
                <td className="px-3 py-1.5 text-right">{para(Number(k.toplam.toString()))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
