import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { FileOutput, Pencil } from "lucide-react"
import Link from "next/link"

import { siparisDetayiGetir } from "../veri"
import { Button } from "@/components/ui/button"
import { VerilenButonlari } from "@/components/siparis/verilen-butonlari"
import { SiparisDurumRozeti } from "@/components/siparis/durum-rozeti"
import { SiparisYazdirMenu } from "@/components/siparis/yazdir-menu"
import { VerilenKalemTablosu } from "@/components/siparis/verilen-kalem-tablosu"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Sipariş" }
export const dynamic = "force-dynamic"

export default async function VerilenSiparisDetay({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("siparis", "gor")
  const { id } = await params
  const siparis = await siparisDetayiGetir(Number(id))
  if (!siparis || siparis.silindi || siparis.tip !== "VERILEN") notFound()

  const duzenlenebilir = siparis.durum === "TASLAK"
  // Faturaya dönüştürme (adım 9.7): yalnız onaylanmış/kısmi sevk edilmiş
  // siparişte, hâlâ bakiyesi olan (miktar > sevkMiktar) satır varken anlamlı.
  const kalanVar = siparis.kalemler.some(
    (k) => Number(k.miktar.toString()) > Number(k.sevkMiktar.toString())
  )
  const donusturulebilir = (siparis.durum === "ONAYLANDI" || siparis.durum === "KISMI_SEVK") && kalanVar

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[1rem] font-semibold">{siparis.siparisNo}</h1>
            <SiparisDurumRozeti durum={siparis.durum} />
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">
            {siparis.cari.unvan} ({siparis.cari.kod}) · {tarih(siparis.tarih)}
            {siparis.teslimTarihi ? ` · teslim ${tarih(siparis.teslimTarihi)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {duzenlenebilir ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/siparis/verilen/${siparis.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Kartı Düzenle
              </Link>
            </Button>
          ) : null}
          {donusturulebilir ? (
            <Button size="sm" asChild>
              <Link href={`/siparis/verilen/${siparis.id}/faturala`}>
                <FileOutput className="size-4" aria-hidden />
                Faturaya Dönüştür
              </Link>
            </Button>
          ) : null}
          <SiparisYazdirMenu id={siparis.id} />
          <VerilenButonlari id={siparis.id} durum={siparis.durum} />
        </div>
      </div>

      {siparis.aciklama ? (
        <p className="panel px-3 py-2 text-[0.8125rem] text-muted-foreground">{siparis.aciklama}</p>
      ) : null}

      <VerilenKalemTablosu
        siparisId={siparis.id}
        duzenlenebilir={duzenlenebilir}
        kalemler={siparis.kalemler.map((k) => ({
          id: k.id,
          sira: k.sira,
          stokId: k.stokId,
          aciklama: k.aciklama,
          birim: k.birim,
          miktar: Number(k.miktar.toString()),
          birimFiyat: Number(k.birimFiyat.toString()),
          kdvOrani: Number(k.kdvOrani.toString()),
          sevkMiktar: Number(k.sevkMiktar.toString()),
        }))}
      />

      <p className="text-[0.75rem] text-muted-foreground">
        Cari güncel bakiye: <strong className="text-foreground">{para(Number(siparis.cari.bakiye.toString()))}</strong>
      </p>
    </div>
  )
}
