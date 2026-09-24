import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Pencil } from "lucide-react"
import Link from "next/link"

import { evrakDetayiGetir } from "../veri"
import { Button } from "@/components/ui/button"
import { AlisButonlari } from "@/components/evrak/alis-butonlari"
import { EvrakDurumRozeti } from "@/components/evrak/durum-rozeti"
import { AlisKalemTablosu } from "@/components/evrak/alis-kalem-tablosu"
import { EvrakYazdirMenu } from "@/components/evrak/yazdir-menu"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Alış Faturası" }
export const dynamic = "force-dynamic"

export default async function FaturaDetay({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("evrak", "gor")
  const { id } = await params
  const evrak = await evrakDetayiGetir(Number(id))
  if (!evrak || evrak.silindi || (evrak.tur !== "ALIS" && evrak.tur !== "IADE_ALIS")) notFound()

  const duzenlenebilir = evrak.durum === "TASLAK"

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[1rem] font-semibold">{evrak.evrakNo}</h1>
            <EvrakDurumRozeti durum={evrak.durum} />
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">
            {evrak.cari.unvan} ({evrak.cari.kod}) · {tarih(evrak.tarih)}
            {evrak.vadeTarihi ? ` · vade ${tarih(evrak.vadeTarihi)}` : ""}
          </p>
          {/* Siparişten dönüştürülmüş fatura (adım 9.7): kaynağa geri dönüş. */}
          {evrak.siparis ? (
            <p className="text-[0.75rem] text-muted-foreground">
              Kaynak sipariş:{" "}
              <Link
                href={`/siparis/${evrak.siparis.tip === "ALINAN" ? "alinan" : "verilen"}/${evrak.siparis.id}`}
                className="text-foreground underline underline-offset-2"
              >
                {evrak.siparis.siparisNo}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {duzenlenebilir ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/evrak/alis/${evrak.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Kartı Düzenle
              </Link>
            </Button>
          ) : null}
          <EvrakYazdirMenu id={evrak.id} tur={evrak.tur} />
          <AlisButonlari id={evrak.id} durum={evrak.durum} iade={evrak.tur === "IADE_ALIS"} />
        </div>
      </div>

      {evrak.aciklama ? (
        <p className="panel px-3 py-2 text-[0.8125rem] text-muted-foreground">{evrak.aciklama}</p>
      ) : null}

      <AlisKalemTablosu
        evrakId={evrak.id}
        duzenlenebilir={duzenlenebilir}
        kalemler={evrak.kalemler.map((k) => ({
          id: k.id,
          sira: k.sira,
          stokId: k.stokId,
          aciklama: k.aciklama,
          birim: k.birim,
          miktar: Number(k.miktar.toString()),
          birimFiyat: Number(k.birimFiyat.toString()),
          kdvOrani: Number(k.kdvOrani.toString()),
        }))}
      />

      <p className="text-[0.75rem] text-muted-foreground">
        Cari güncel bakiye: <strong className="text-foreground">{para(Number(evrak.cari.bakiye.toString()))}</strong>
      </p>
    </div>
  )
}
