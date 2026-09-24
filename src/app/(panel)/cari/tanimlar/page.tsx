import type { Metadata } from "next"

import { yonetimPlasiyerleriGetir } from "./veri"
import { PlasiyerYonetimi } from "@/components/cari/plasiyer-yonetimi"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Sorumlu Personel" }
export const dynamic = "force-dynamic"

export default async function PlasiyerTanimlari() {
  const kullanici = await yetkiliOturum("cari", "gor")

  const plasiyerler = await yonetimPlasiyerleriGetir()

  const duzeltebilir = yetkiVar(kullanici, "cari", "duzelt")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Sorumlu Personel</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Cari kartında seçilen sorumlu personel listesi — {plasiyerler.length} kayıt
          </p>
        </div>
      </div>

      <div className="p-4">
        <PlasiyerYonetimi plasiyerler={plasiyerler} duzeltebilir={duzeltebilir} />
      </div>
    </div>
  )
}
