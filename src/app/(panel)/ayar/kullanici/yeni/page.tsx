import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { KullaniciFormu } from "@/components/ayar/kullanici-formu"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Yeni Kullanıcı" }

export default async function YeniKullanici() {
  await yetkiliOturum("ayar", "ekle")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/ayar/kullanici" aria-label="Kullanıcı listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Yeni Kullanıcı
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Sisteme giriş yapacak yeni bir hesap açın
            </p>
          </div>
        </div>
      </div>

      <KullaniciFormu />
    </div>
  )
}
