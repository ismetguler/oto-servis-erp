import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"

import { tanimlariGetir } from "./veri"
import { TanimYonetimi } from "@/components/ayar/tanim-yonetimi"
import { DisaAktarDugmesi } from "@/components/rapor-araclari"
import { cn } from "@/lib/utils"
import { yetkiliOturum } from "@/lib/oturum"
import { GENEL_TANIM_TURLERI, OZEL_EKRANLI_TURLER, TUR_ADLARI } from "@/lib/tanim-turleri"
import { tanimDonusYoluGuvenliMi } from "@/lib/donus"
import { yetkiVar } from "@/lib/yetki"
import type { TanimTur } from "@/generated/prisma/enums"

export const metadata: Metadata = { title: "Listeler ve Tanımlar" }
export const dynamic = "force-dynamic"

/**
 * TANIMLAR — TEK EKRAN
 *
 * `Tanim` tablosundaki, KENDİ ÖZEL ekranı OLMAYAN tüm türlerin (araç
 * markası, yakıt türü, kart türü, masraf türü...) ortak yönetimi. İşçilik
 * Bölümü / Proje burada YÖNETİLMİYOR — 4b/4d'de zaten birer ekranları var,
 * ikinci bir yönetim ekranı açmak yerine sağda link veriliyor (bkz.
 * `lib/tanim-turleri.ts`).
 *
 * Sekme durumu Sorumlu Personel ekranındaki desenle aynı: adres çubuğunda
 * (?tur=...) tutuluyor, istemci state'inde değil.
 */
export default async function TanimlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string; donusYol?: string; donusAlan?: string }>
}) {
  const kullanici = await yetkiliOturum("ayar", "gor")
  const p = await searchParams

  const turParametresi = (p.tur ?? "") as TanimTur
  const tur = GENEL_TANIM_TURLERI.includes(turParametresi)
    ? turParametresi
    : GENEL_TANIM_TURLERI[0]
  if (!tur) notFound()

  // "+ Yeni X" ile bir formdan gelindiyse: tanım eklenince oraya, ilgili
  // alanda yeni değer seçili olarak geri dönülür (bkz. TanimEkleTusu).
  const donusYol =
    p.donusYol && p.donusAlan && tanimDonusYoluGuvenliMi(p.donusYol) ? p.donusYol : undefined
  const donusAlan = donusYol ? p.donusAlan : undefined

  const kayitlar = await tanimlariGetir(tur)

  const duzeltebilir = yetkiVar(kullanici, "ayar", "duzelt")
  const ekleyebilir = yetkiVar(kullanici, "ayar", "ekle")
  const silebilir = yetkiVar(kullanici, "ayar", "sil")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Listeler ve Tanımlar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Formlardaki açılır listelerin ortak yönetimi — {GENEL_TANIM_TURLERI.length} tür
          </p>
        </div>
        <DisaAktarDugmesi
          yol={`/ayar/tanim/disa-aktar?tur=${tur}`}
          etiket={`${TUR_ADLARI[tur]} — Excel`}
        />
      </div>

      <div className="[&>*]:min-w-0 grid grid-cols-1 gap-4 p-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav className="yazdirma-disi panel h-fit p-2">
          <ul className="flex flex-col gap-0.5">
            {GENEL_TANIM_TURLERI.map((t) => (
              <li key={t}>
                <Link
                  href={`/ayar/tanim?tur=${t}`}
                  className={cn(
                    "block rounded-sm px-2.5 py-1.5 text-[0.8125rem] transition-colors",
                    t === tur
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {TUR_ADLARI[t]}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-border pt-3">
            <p className="px-2.5 text-[0.6875rem] font-medium text-muted-foreground">
              Diğer Tanım Ekranları
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {OZEL_EKRANLI_TURLER.map((o) => (
                <li key={o.tur}>
                  <Link
                    href={o.yol}
                    title={o.aciklama}
                    className="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    {TUR_ADLARI[o.tur]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <TanimYonetimi
          key={tur}
          tur={tur}
          baslik={TUR_ADLARI[tur]}
          kayitlar={kayitlar}
          ekleyebilir={ekleyebilir}
          duzeltebilir={duzeltebilir}
          silebilir={silebilir}
          donusYol={donusYol}
          donusAlan={donusAlan}
        />
      </div>
    </div>
  )
}
