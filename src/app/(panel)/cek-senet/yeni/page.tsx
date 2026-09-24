import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { CekSenetFormu } from "@/components/cek-senet/cek-senet-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Çek / Senet" }
export const dynamic = "force-dynamic"

export default async function YeniCekSenet({
  searchParams,
}: {
  searchParams: Promise<{ yon?: string }>
}) {
  await yetkiliOturum("tahsilat", "ekle")
  const p = await searchParams
  const yon = p.yon === "VERILEN" ? "VERILEN" : "ALINAN"

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cek-senet" aria-label="Listeye dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Yeni Çek / Senet</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Kayıt portföyde ve onay bekleyerek açılır
            </p>
          </div>
        </div>
      </div>

      <CekSenetFormu varsayilanYon={yon} />
    </div>
  )
}
