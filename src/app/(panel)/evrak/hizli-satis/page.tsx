import type { Metadata } from "next"

import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import { HizliSatisEkrani } from "@/components/evrak/hizli-satis-ekrani"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Hızlı Satış" }
export const dynamic = "force-dynamic"

/**
 * HIZLI SATIŞ / PERAKENDE (adım 9.3) — tezgâh üstü satış ekranı.
 *
 * Kendi listesi yok: her giriş "yeni satış" demek, sepet tarayıcıda tutulur
 * (bkz. `components/evrak/hizli-satis-ekrani.tsx`). Tamamlanan satışlar
 * normal Satış Evrakları listesinde (`/evrak/satis`) `tur = PERAKENDE`
 * olarak görünür — ayrı bir liste ekranı açmaya gerek yok.
 */
export default async function HizliSatisSayfasi() {
  await yetkiliOturum("evrak", "ekle")
  const kasalar = await secilebilirKasalar()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Hızlı Satış</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Tezgâh üstü / perakende satış — barkod okut, tahsil et
          </p>
        </div>
      </div>

      <HizliSatisEkrani kasalar={kasalar} />
    </div>
  )
}
