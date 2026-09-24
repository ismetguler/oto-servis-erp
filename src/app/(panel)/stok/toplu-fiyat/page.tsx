import type { Metadata } from "next"

import { stokListeKosulu } from "../veri"
import { StokFiltre } from "@/components/stok/stok-filtre"
import { TopluFiyatFormu } from "@/components/stok/toplu-fiyat-formu"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { filtreSecenekleriGetir } from "../veri"

export const metadata: Metadata = { title: "Toplu Fiyat Güncelleme" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 200

type Aramalar = {
  q?: string
  depo?: string
  grup?: string
  durum?: string
}

/**
 * Filtre GET formu, listeleme sayfasındaki (`/stok`) ile aynı bileşen ve
 * koşul (`stokListeKosulu`) — filtrelenmiş sonuç ayrı bir mantıkla
 * hesaplansaydı iki ekran birbirini tutmayabilirdi. Sayfalama yok (200
 * kayda kadar tek seferde), toplu işlemde "sonraki sayfa" akışı seçimi
 * karmaşıklaştırır; ihtiyaç doğarsa filtrelerle daraltılır.
 */
export default async function TopluFiyatGuncelleme({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("stok", "duzelt")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const depo = p.depo ?? ""
  const grup = p.grup ?? ""
  // "silinen" bu ekranda anlamsız (soft-delete edilmiş karta fiyat
  // güncellenmez) — StokFiltre bileşeni ortak olduğu için seçenek görünür
  // kalıyor ama burada aktife düşürülüyor.
  const durum = p.durum === "silinen" ? "aktif" : (p.durum ?? "aktif")

  const kosul = stokListeKosulu({ q, depo, grup, durum })

  const [kayitlar, secenekler] = await Promise.all([
    prisma.stok.findMany({
      where: kosul,
      orderBy: { ad: "asc" },
      take: SAYFA_BOYU,
      select: {
        id: true,
        kod: true,
        ad: true,
        satisFiyat: true,
        alisFiyat: true,
      },
    }),
    filtreSecenekleriGetir(),
  ])

  const gosterim = kayitlar.map((k) => ({
    id: k.id,
    kod: k.kod,
    ad: k.ad,
    fiyatlar: {
      satisFiyat: Number(k.satisFiyat.toString()),
      alisFiyat: Number(k.alisFiyat.toString()),
    },
  }))

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Toplu Fiyat Güncelleme
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Filtreleyip seçtiğiniz kartların fiyatını yüzde veya sabit tutarla artırın / azaltın —
            {" "}{kayitlar.length} kayıt listelendi
          </p>
        </div>
      </div>

      <div className="yazdirma-disi">
        <StokFiltre
          q={q}
          depo={depo}
          grup={grup}
          durum={durum}
          depolar={secenekler.depolar}
          urunGruplari={secenekler.urunGruplari}
          aksiyon="/stok/toplu-fiyat"
        />
      </div>

      {gosterim.length === 0 ? (
        <p className="px-4 py-16 text-center text-[0.8125rem] text-muted-foreground">
          Bu ölçütlere uyan stok bulunamadı.
        </p>
      ) : (
        <TopluFiyatFormu kayitlar={gosterim} />
      )}
    </div>
  )
}
