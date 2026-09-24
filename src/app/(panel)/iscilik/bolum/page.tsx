import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { BolumYonetimi } from "@/components/iscilik/bolum-yonetimi"
import { Button } from "@/components/ui/button"
import { tanimDonusYoluGuvenliMi } from "@/lib/donus"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "İşçilik Bölümleri" }
export const dynamic = "force-dynamic"

export default async function IscilikBolumleri({
  searchParams,
}: {
  searchParams: Promise<{ donusYol?: string; donusAlan?: string }>
}) {
  const kullanici = await yetkiliOturum("iscilik", "gor")
  const p = await searchParams
  const donusYol =
    p.donusYol && p.donusAlan && tanimDonusYoluGuvenliMi(p.donusYol) ? p.donusYol : undefined
  const donusAlan = donusYol ? p.donusAlan : undefined

  // Pasif bölümler de listeleniyor: bu ekran zaten onları yönetmek için var.
  const kayitlar = await prisma.tanim.findMany({
    where: { tur: "ISCILIK_BOLUMU" },
    orderBy: [{ sira: "asc" }, { ad: "asc" }],
    select: {
      id: true,
      kod: true,
      ad: true,
      sira: true,
      aktif: true,
      _count: { select: { iscilikler: true } },
    },
  })

  const bolumler = kayitlar.map((b) => ({
    id: b.id,
    kod: b.kod,
    ad: b.ad,
    sira: b.sira,
    aktif: b.aktif,
    kullanim: b._count.iscilikler,
  }))

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/iscilik" aria-label="İşçilik kataloğuna dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">İşçilik Bölümleri</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              İşçilikleri grupladığımız başlıklar (mekanik, kaporta, elektrik…) —{" "}
              {bolumler.length} kayıt
            </p>
          </div>
        </div>
      </div>

      <BolumYonetimi
        bolumler={bolumler}
        duzeltebilir={yetkiVar(kullanici, "iscilik", "duzelt")}
        silebilir={yetkiVar(kullanici, "iscilik", "sil")}
        donusYol={donusYol}
        donusAlan={donusAlan}
      />
    </div>
  )
}
