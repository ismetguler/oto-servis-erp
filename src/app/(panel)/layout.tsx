import { MenuDurumSaglayici } from "@/components/kabuk/menu-durum"
import { UstIlerlemeCubugu } from "@/components/kabuk/ust-ilerleme-cubugu"
import { UstBar } from "@/components/kabuk/ust-bar"
import { YanMenu } from "@/components/kabuk/yan-menu"
import { oturumZorunlu } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { MODULLER, ROL_ADLARI, yetkiVar, type Modul } from "@/lib/yetki"

/**
 * Panelin ortak çerçevesi: sol menü + üst bar.
 * Bu grubun altındaki HER sayfa girişi zorunlu kılar; oturum yoksa
 * `oturumZorunlu` doğrudan /giris'e yönlendirir.
 */
export default async function PanelDuzeni({
  children,
}: {
  children: React.ReactNode
}) {
  const kullanici = await oturumZorunlu()

  const [firma, acikOnarim] = await Promise.all([
    prisma.firma.findFirst({ select: { unvan: true, logo: true } }),
    prisma.kabul.count({
      where: { silindi: false, durum: { in: ["ACIK", "BEKLEMEDE"] } },
    }),
  ])

  // İkon bileşenleri sunucudan istemciye geçemediği için menüyü istemci
  // tarafında filtreliyoruz; buradan sadece "hangi modüllere yetkisi var" gidiyor.
  const izinliModuller: Modul[] = MODULLER.filter((m) => yetkiVar(kullanici, m, "gor"))

  return (
    <MenuDurumSaglayici>
      <UstIlerlemeCubugu />
      <div className="flex min-h-svh bg-background">
        <YanMenu
          izinliModuller={izinliModuller}
          sayaclar={{ acikOnarim }}
          firmaLogo={firma?.logo ?? null}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <UstBar
            firmaUnvan={firma?.unvan ?? "Firma tanımlı değil"}
            kullaniciAd={kullanici.tamAd}
            kullaniciKod={kullanici.kod}
            rolAdi={ROL_ADLARI[kullanici.rol]}
            izinliModuller={izinliModuller}
          />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </MenuDurumSaglayici>
  )
}
