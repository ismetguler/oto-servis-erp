import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, Pencil } from "lucide-react"

import { paketKalemleriGetir } from "../veri"
import { PaketKalemleri } from "@/components/bakim-paketi/paket-kalemleri"
import { Button } from "@/components/ui/button"
import { tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Bakım Paketi" }
export const dynamic = "force-dynamic"

export default async function BakimPaketiKarti({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const { id } = await params
  const paketId = Number(id)
  if (!Number.isInteger(paketId)) notFound()

  const paket = await prisma.bakimPaketi.findUnique({ where: { id: paketId } })
  if (!paket) notFound()

  const kalemler = await paketKalemleriGetir(paketId)
  const duzeltebilir = yetkiVar(kullanici, "kabul", "duzelt") && !paket.silindi
  const uyarili = kalemler.filter((k) => k.uyari)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/servis/bakim-paketi" aria-label="Paket listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              <span className="font-mono text-[0.875rem] text-muted-foreground">{paket.kod}</span>
              {paket.ad}
              {paket.silindi ? (
                <span className="rounded-sm bg-tehlike-yumusak px-1.5 py-0.5 text-[0.6875rem] text-tehlike">
                  SİLİNDİ
                </span>
              ) : !paket.aktif ? (
                <span className="rounded-sm bg-uyari-yumusak px-1.5 py-0.5 text-[0.6875rem] text-uyari">
                  PASİF
                </span>
              ) : null}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {[
                paket.km ? `${paket.km.toLocaleString("tr-TR")} km` : null,
                paket.marka,
                paket.aracTuru,
              ]
                .filter(Boolean)
                .join(" · ") || "Tüm araçlar için"}
            </p>
          </div>
        </div>
        {duzeltebilir ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/servis/bakim-paketi/${paket.id}/duzenle`}>
              <Pencil className="size-4" aria-hidden />
              Paketi Düzenle
            </Link>
          </Button>
        ) : null}
      </div>

      {paket.aciklama ? (
        <div className="px-4 pt-4">
          <p className="whitespace-pre-wrap rounded-sm bg-muted/40 p-3 text-[0.8125rem]">
            {paket.aciklama}
          </p>
        </div>
      ) : null}

      {uyarili.length > 0 ? (
        <div className="px-4 pt-4">
          <div className="flex items-start gap-2 rounded-md border border-uyari/30 bg-uyari-yumusak px-3 py-2 text-[0.8125rem] text-uyari">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {uyarili.length} satırda sorun var (silinmiş/pasif katalog kaydı veya fiyatsız
              satır). Paket yine de uygulanabilir; bu satırlar 0 fiyatla düşebilir.
            </span>
          </div>
        </div>
      ) : null}

      <div className="p-4">
        <PaketKalemleri
          paketId={paket.id}
          kalemler={kalemler}
          duzenlenebilir={duzeltebilir}
        />
      </div>

      <div className="border-t border-border px-4 py-2.5 text-[0.75rem] text-muted-foreground yazdirma-disi">
        Oluşturma: {tarihSaat(paket.olusturmaTarihi)} · Son güncelleme:{" "}
        {tarihSaat(paket.guncellemeTarihi)}
      </div>
    </div>
  )
}
