import type { Metadata } from "next"

import { BarkodArama } from "@/components/stok/barkod-arama"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Barkod ile Ara" }
export const dynamic = "force-dynamic"

export default async function StokBarkodAra() {
  await yetkiliOturum("stok", "gor")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Barkod ile Ara</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Kabul Parça Çıkışı ekranındaki okuma motoruyla aynı — barkod okutun ya da stok
            kodu/ürün adı yazın
          </p>
        </div>
      </div>

      <BarkodArama />
    </div>
  )
}
