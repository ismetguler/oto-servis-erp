import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"

import { cikilanParcalariGetir, cikisKabuluGetir } from "../veri"
import { DurumRozeti } from "@/components/kabul/kabul-listesi"
import { HizliCikis } from "@/components/parca-cikis/hizli-cikis"
import { Button } from "@/components/ui/button"
import { para, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Kabul Parça Çıkışı" }
export const dynamic = "force-dynamic"

/**
 * KABUL PARÇA ÇIKIŞI — 2. adım: hızlı giriş
 *
 * Üst şeritte kartın kim/hangi araç bilgisi duruyor (depocu yanlış karta
 * parça çıkmasın), altında klavyeyle çalışan giriş satırı ve o karta şu ana
 * kadar çıkılmış parçalar var.
 */
export default async function ParcaCikisEkrani({
  params,
}: {
  params: Promise<{ kabulId: string }>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")
  const { kabulId } = await params
  const id = Number(kabulId)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const kabul = await cikisKabuluGetir(id)
  if (!kabul) notFound()

  const parcalar = await cikilanParcalariGetir(id)

  const duzenlenebilir =
    yetkiVar(kullanici, "kabul", "duzelt") && kabul.durum !== "TESLIM_EDILDI"

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild title="Kart seçimine dön">
            <Link href="/servis/parca-cikis" aria-label="Kart seçimine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              {kabul.arac.plaka}
              <span className="ml-2 font-mono text-[0.8125rem] font-normal text-muted-foreground">
                {kabul.kabulNo}
              </span>
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {kabul.cari.unvan} ·{" "}
              {[kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ") || "—"} ·
              Giriş {tarihSaat(kabul.girisTarihi)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[0.6875rem] text-muted-foreground">Parça Toplamı</p>
            <p className="text-[0.9375rem] font-semibold tabular-nums">
              {para(kabul.parcaToplam)}
            </p>
          </div>
          <DurumRozeti durum={kabul.durum} />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/servis/kabul/${kabul.id}`}>
              <FileText className="size-4" aria-hidden />
              Kabul Kartı
            </Link>
          </Button>
        </div>
      </div>

      <HizliCikis kabul={kabul} parcalar={parcalar} duzenlenebilir={duzenlenebilir} />
    </div>
  )
}
