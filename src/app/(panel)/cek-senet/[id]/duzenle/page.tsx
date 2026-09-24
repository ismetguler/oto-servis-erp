import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { CekSenetFormu } from "@/components/cek-senet/cek-senet-formu"
import { Button } from "@/components/ui/button"
import { sayi } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Çek / Senet Düzenle" }
export const dynamic = "force-dynamic"

/** Tarih girdilerinin istediği YYYY-AA-GG biçimi. */
function gunMetni(d: Date | null): string {
  if (!d) return ""
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default async function CekSenetDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await yetkiliOturum("tahsilat", "duzelt")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const cek = await prisma.cekSenet.findUnique({
    where: { id },
    include: { cari: { select: { id: true, kod: true, unvan: true } } },
  })
  if (!cek || cek.silindi) notFound()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/cek-senet/${cek.id}`} aria-label="Karta dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Çek / Senet Düzenle</h1>
            <p className="text-[0.8125rem] text-muted-foreground">{cek.portfoyNo}</p>
          </div>
        </div>
      </div>

      <CekSenetFormu
        baslangic={{
          id: cek.id,
          portfoyNo: cek.portfoyNo,
          tur: cek.tur,
          yon: cek.yon,
          cari: cek.cari,
          tutar: sayi(cek.tutar),
          paraBirimi: cek.paraBirimi,
          vadeTarihi: gunMetni(cek.vadeTarihi),
          kesideTarihi: gunMetni(cek.kesideTarihi),
          kesideYeri: cek.kesideYeri,
          borclu: cek.borclu,
          banka: cek.banka,
          bankaSube: cek.bankaSube,
          hesapNo: cek.hesapNo,
          belgeNo: cek.belgeNo,
          aciklama: cek.aciklama,
        }}
      />
    </div>
  )
}
