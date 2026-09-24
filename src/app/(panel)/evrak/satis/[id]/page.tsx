import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil } from "lucide-react"

import { evrakDetayiGetir } from "../veri"
import { Button } from "@/components/ui/button"
import { EvrakButonlari } from "@/components/evrak/evrak-butonlari"
import { EvrakDurumRozeti } from "@/components/evrak/durum-rozeti"
import { KalemTablosu } from "@/components/evrak/kalem-tablosu"
import { EvrakYazdirMenu } from "@/components/evrak/yazdir-menu"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Satış Faturası" }
export const dynamic = "force-dynamic"

export default async function FaturaDetay({ params }: { params: Promise<{ id: string }> }) {
  await yetkiliOturum("evrak", "gor")
  const { id } = await params
  const evrak = await evrakDetayiGetir(Number(id))
  // PERAKENDE (Hızlı Satış, adım 9.3) aynı Evrak/EvrakKalem şemasını
  // kullanıyor — kart görünümü SATIS ile birebir aynı, ayrı bir sayfa
  // açılmadı. Fark yalnız listede "Tür" sütununda görünüyor.
  if (
    !evrak ||
    evrak.silindi ||
    (evrak.tur !== "SATIS" && evrak.tur !== "PERAKENDE" && evrak.tur !== "IADE_SATIS")
  )
    notFound()

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
          {/* Kabulden dönüştürülmüş fatura (adım 9.2): kaynağa geri dönüş. */}
          {evrak.kabul ? (
            <p className="text-[0.75rem] text-muted-foreground">
              Kaynak servis kartı:{" "}
              <Link
                href={`/servis/kabul/${evrak.kabul.id}`}
                className="text-foreground underline underline-offset-2"
              >
                {evrak.kabul.kabulNo}
              </Link>{" "}
              · parçalar bu kartta stoktan düşüldüğü için fatura kesilirken stoğa
              yeniden dokunulmaz.
            </p>
          ) : null}
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
              <Link href={`/evrak/satis/${evrak.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Kartı Düzenle
              </Link>
            </Button>
          ) : null}
          <EvrakYazdirMenu id={evrak.id} tur={evrak.tur} />
          <EvrakButonlari
            id={evrak.id}
            durum={evrak.durum}
            kabulden={evrak.kabul !== null}
            iade={evrak.tur === "IADE_SATIS"}
          />
        </div>
      </div>

      {evrak.aciklama ? (
        <p className="panel px-3 py-2 text-[0.8125rem] text-muted-foreground">{evrak.aciklama}</p>
      ) : null}

      <KalemTablosu
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
