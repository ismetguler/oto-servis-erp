import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { kullaniciFormVerisi, kullaniciYetkiIstisnalari } from "../../veri"
import { KullaniciDurumDugmesi } from "@/components/ayar/kullanici-durum-dugmesi"
import { KullaniciFormu } from "@/components/ayar/kullanici-formu"
import { SifreSifirla } from "@/components/ayar/sifre-sifirla"
import { YetkiIstisnalari } from "@/components/ayar/yetki-istisnalari"
import { Button } from "@/components/ui/button"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Kullanıcı Düzenle" }

export default async function KullaniciDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const oturumSahibi = await yetkiliOturum("ayar", "duzelt")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const kullanici = await kullaniciFormVerisi(kayitId)
  if (!kullanici) notFound()

  const durumDegistirebilir = yetkiVar(oturumSahibi, "ayar", "duzelt")
  const istisnaMap = await kullaniciYetkiIstisnalari(kullanici.id)
  const istisnalar = Object.fromEntries(
    Array.from(istisnaMap.entries()).map(([sayfaKodu, k]) => [
      sayfaKodu,
      {
        gorebilir: k.gorebilir,
        ekleyebilir: k.ekleyebilir,
        duzeltebilir: k.duzeltebilir,
        silebilir: k.silebilir,
      },
    ])
  )

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
              {[kullanici.ad, kullanici.soyad].filter(Boolean).join(" ")}
            </h1>
            <p className="font-mono text-[0.8125rem] text-muted-foreground">
              {kullanici.kod}
            </p>
          </div>
        </div>

        {durumDegistirebilir ? (
          <div className="flex items-center gap-2">
            <SifreSifirla kullaniciId={kullanici.id} kod={kullanici.kod} />
            <KullaniciDurumDugmesi id={kullanici.id} aktif={kullanici.aktif} kod={kullanici.kod} />
          </div>
        ) : null}
      </div>

      <KullaniciFormu baslangic={kullanici} />

      <div className="mt-4">
        <YetkiIstisnalari kullaniciId={kullanici.id} rol={kullanici.rol} istisnalar={istisnalar} />
      </div>
    </div>
  )
}
