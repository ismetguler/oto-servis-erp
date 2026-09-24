import type { Metadata } from "next"

import { EtiketFormu } from "@/components/stok/etiket-formu"
import { StokFiltre } from "@/components/stok/stok-filtre"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { filtreSecenekleriGetir, stokListeKosulu } from "../veri"

export const metadata: Metadata = { title: "Barkod Etiketi Yazdır" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 200

type Aramalar = {
  q?: string
  depo?: string
  grup?: string
  durum?: string
  id?: string
}

/**
 * Filtre + seçim deseni toplu fiyat güncellemedeki ile birebir aynı
 * (`stokListeKosulu`, 200 kayda kadar tek seferde). Tek fark: burada
 * fiyat değil barkod/ad basılıyor, bu yüzden barkodu olmayan kartlar da
 * listede kalıyor — kod alanı barkod yerine geçebiliyor.
 */
export default async function StokEtiketYazdir({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("stok", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const depo = p.depo ?? ""
  const grup = p.grup ?? ""
  const durum = p.durum === "silinen" ? "aktif" : (p.durum ?? "aktif")
  // Kart sayfasındaki "Etiket Yazdır" düğmesi buraya ?id= ile gelir —
  // filtreyle aramaya gerek kalmadan doğrudan o kart ön seçili görünsün.
  const onSecili = Number(p.id)

  const kosul = stokListeKosulu({ q, depo, grup, durum })

  const [kayitlar, secenekler] = await Promise.all([
    prisma.stok.findMany({
      where: kosul,
      orderBy: { ad: "asc" },
      take: SAYFA_BOYU,
      select: { id: true, kod: true, ad: true, barkod: true },
    }),
    filtreSecenekleriGetir(),
  ])

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi yazdirma-disi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Barkod Etiketi Yazdır
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Filtreleyip seçtiğiniz kartlar için etiket basın —
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
          aksiyon="/stok/etiket"
        />
      </div>

      {kayitlar.length === 0 ? (
        <p className="yazdirma-disi px-4 py-16 text-center text-[0.8125rem] text-muted-foreground">
          Bu ölçütlere uyan stok bulunamadı.
        </p>
      ) : (
        <EtiketFormu
          kayitlar={kayitlar.map((k) => ({ id: k.id, kod: k.kod, ad: k.ad, barkod: k.barkod }))}
          onSecili={Number.isInteger(onSecili) ? onSecili : undefined}
        />
      )}
    </div>
  )
}
