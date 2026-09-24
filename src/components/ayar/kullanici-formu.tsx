"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Loader2, Save, X } from "lucide-react"

import { kullaniciDuzenle, kullaniciEkle, type KullaniciFormDurumu } from "@/app/(panel)/ayar/kullanici/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { TelefonGirdi } from "@/components/ui/telefon-girdi"
import { ROL_ADLARI } from "@/lib/yetki"
import type { Rol } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"

export type KullaniciBaslangic = {
  id: number
  kod: string
  ad: string
  soyad: string | null
  email: string | null
  telefon: string | null
  rol: string
}

/**
 * Ekle ve düzenle aynı bileşeni kullanıyor — Cari formundaki desenle aynı
 * gerekçe. Ayrım `baslangic`'in varlığından: doluysa düzenleme action'ı ve
 * salt-okunur kod, boşsa ekleme action'ı ve kod/ilk şifre alanları.
 */
export function KullaniciFormu({ baslangic }: { baslangic?: KullaniciBaslangic }) {
  const duzenleme = Boolean(baslangic)
  const [durum, gonder, bekliyor] = useActionState<KullaniciFormDurumu, FormData>(
    duzenleme ? kullaniciDuzenle : kullaniciEkle,
    {}
  )

  const hata = (alan: string) => durum.alanHatalari?.[alan]

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="[&>*]:min-w-0 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Alan ad="kod" etiket="Kullanıcı Adı" zorunlu={!duzenleme} hata={hata("kod")}
          ipucu={duzenleme ? "Giriş kimliği — sonradan değiştirilemez" : "Boşluksuz, giriş için kullanılacak (ör. ahmet)"}
        >
          {duzenleme ? (
            <div className="flex h-8 items-center rounded-sm border border-dashed border-input bg-muted px-2 font-mono text-[0.8125rem] text-muted-foreground">
              {baslangic!.kod}
            </div>
          ) : (
            <Girdi name="kod" placeholder="ör. ahmet" required autoFocus className="font-mono" />
          )}
        </Alan>

        <Alan ad="ad" etiket="Ad" zorunlu hata={hata("ad")}>
          <Girdi name="ad" defaultValue={baslangic?.ad} required autoFocus={duzenleme} />
        </Alan>

        <Alan ad="soyad" etiket="Soyad" hata={hata("soyad")}>
          <Girdi name="soyad" defaultValue={baslangic?.soyad ?? ""} />
        </Alan>

        <Alan ad="email" etiket="E-Posta" hata={hata("email")}>
          <Girdi name="email" type="email" defaultValue={baslangic?.email ?? ""} />
        </Alan>

        <Alan ad="telefon" etiket="Telefon" hata={hata("telefon")}>
          <TelefonGirdi name="telefon" defaultValue={baslangic?.telefon} />
        </Alan>

        <Alan ad="rol" etiket="Rol" zorunlu hata={hata("rol")}>
          <Secim name="rol" defaultValue={baslangic?.rol ?? "SERVIS_DANISMANI"}>
            {(Object.entries(ROL_ADLARI) as [Rol, string][]).map(([deger, ad]) => (
              <option key={deger} value={deger}>
                {ad}
              </option>
            ))}
          </Secim>
        </Alan>

        {!duzenleme ? (
          <Alan ad="sifre" etiket="İlk Şifre" zorunlu hata={hata("sifre")} ipucu="En az 6 karakter">
            <Girdi name="sifre" type="text" autoComplete="off" required />
          </Alan>
        ) : null}
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Button variant="outline" size="sm" asChild>
          <Link href={duzenleme ? `/ayar/kullanici/${baslangic!.id}/duzenle` : "/ayar/kullanici"}>
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  ipucu,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  children: React.ReactNode
}) {
  return (
    <div className="form-alani">
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
      {children}
      {hata ? (
        <p className="text-[0.75rem] text-tehlike">{hata}</p>
      ) : ipucu ? (
        <p className="text-[0.6875rem] text-muted-foreground">{ipucu}</p>
      ) : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

function Girdi({
  name,
  className,
  ...kalan
}: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

function Secim({
  name,
  className,
  ...kalan
}: React.ComponentProps<"select"> & { name: string }) {
  return <select id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}
