"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"

import {
  yetkiIstisnasiKaldir,
  yetkiIstisnasiKaydet,
  type YetkiIstisnasiDurumu,
} from "@/app/(panel)/ayar/kullanici/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MODUL_ADLARI, MODULLER, ROL_ADLARI, ROL_MATRISI, type Islem, type Modul } from "@/lib/yetki"

type IstisnaKaydi = {
  gorebilir: boolean
  ekleyebilir: boolean
  duzeltebilir: boolean
  silebilir: boolean
}

const ISLEMLER: { key: keyof IstisnaKaydi; islem: Islem; kisa: string }[] = [
  { key: "gorebilir", islem: "gor", kisa: "Gör" },
  { key: "ekleyebilir", islem: "ekle", kisa: "Ekle" },
  { key: "duzeltebilir", islem: "duzelt", kisa: "Düzelt" },
  { key: "silebilir", islem: "sil", kisa: "Sil" },
]

function rolVarsayilani(rol: string, modul: Modul): IstisnaKaydi {
  const izinler = ROL_MATRISI[rol as keyof typeof ROL_MATRISI]?.[modul] ?? []
  return {
    gorebilir: izinler.includes("gor"),
    ekleyebilir: izinler.includes("ekle"),
    duzeltebilir: izinler.includes("duzelt"),
    silebilir: izinler.includes("sil"),
  }
}

/**
 * MODÜL BAZLI İSTİSNALAR (adım 11.2) — kullanıcı kartının ALT PANELİ,
 * `KullaniciFormu`dan (ad/soyad/email/rol) bağımsız kendi mini-form'larıyla
 * çalışır (Şifre Sıfırlama'daki desenin aynısı). Her modül satırı önce
 * rolden gelen varsayılanı salt bilgi olarak, sonra varsa istisnayı
 * düzenlenebilir gösterir.
 */
export function YetkiIstisnalari({
  kullaniciId,
  rol,
  istisnalar,
}: {
  kullaniciId: number
  rol: string
  istisnalar: Record<string, IstisnaKaydi>
}) {
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight">Modül Bazlı İstisnalar</h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          Varsayılan olarak rol ({ROL_ADLARI[rol as keyof typeof ROL_ADLARI] ?? rol}) yetkisi
          geçerlidir. Belirli bir modülde farklı davranması gerekiyorsa buradan istisna eklenir.
        </p>
      </div>

      <div className="divide-y divide-border">
        {MODULLER.map((modul) => (
          <ModulSatiri
            key={modul}
            kullaniciId={kullaniciId}
            modul={modul}
            varsayilan={rolVarsayilani(rol, modul)}
            istisna={istisnalar[modul] ?? null}
          />
        ))}
      </div>
    </div>
  )
}

function IzinRozetleri({ kayit }: { kayit: IstisnaKaydi }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ISLEMLER.map(({ key, kisa }) => (
        <span
          key={key}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium",
            kayit[key] ? "bg-basari-yumusak text-basari" : "bg-muted text-muted-foreground"
          )}
        >
          {kisa} {kayit[key] ? "✓" : "✗"}
        </span>
      ))}
    </div>
  )
}

function ModulSatiri({
  kullaniciId,
  modul,
  varsayilan,
  istisna,
}: {
  kullaniciId: number
  modul: Modul
  varsayilan: IstisnaKaydi
  istisna: IstisnaKaydi | null
}) {
  const router = useRouter()
  const [duzenleAcik, setDuzenleAcik] = useState(false)
  const [bekliyor, basla] = useTransition()

  function kaldir() {
    if (!confirm(`"${MODUL_ADLARI[modul]}" istisnası kaldırılsın mı? Kullanıcı rolün varsayılanına döner.`)) return
    basla(async () => {
      const sonuc = await yetkiIstisnasiKaldir(kullaniciId, modul)
      if (sonuc.hata) toast.error(sonuc.hata)
      else {
        toast.success("İstisna kaldırıldı.")
        router.refresh()
      }
    })
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[10rem] max-md:min-w-0 max-md:flex-1">
          <p className="text-[0.8125rem] font-medium">{MODUL_ADLARI[modul]}</p>
          <p className="mt-1 text-[0.6875rem] text-muted-foreground">Rol varsayılanı</p>
          <div className="mt-1">
            <IzinRozetleri kayit={varsayilan} />
          </div>
        </div>

        <div className="min-w-[10rem] max-md:min-w-0 max-md:flex-1">
          {istisna ? (
            <>
              <p className="text-[0.6875rem] text-muted-foreground">Kişiye özel istisna</p>
              <div className="mt-1">
                <IzinRozetleri kayit={istisna} />
              </div>
            </>
          ) : (
            <p className="text-[0.8125rem] text-muted-foreground">İstisna yok, rol geçerli.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {istisna ? (
            <Button variant="ghost" size="sm" onClick={kaldir} disabled={bekliyor}>
              {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
              İstisnayı Kaldır
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setDuzenleAcik((d) => !d)}>
            <Pencil className="size-4" aria-hidden />
            {istisna ? "Düzenle" : "İstisna Ekle"}
          </Button>
        </div>
      </div>

      {duzenleAcik ? (
        <IstisnaFormu
          kullaniciId={kullaniciId}
          modul={modul}
          baslangic={istisna ?? varsayilan}
          onKapat={() => setDuzenleAcik(false)}
        />
      ) : null}
    </div>
  )
}

function IstisnaFormu({
  kullaniciId,
  modul,
  baslangic,
  onKapat,
}: {
  kullaniciId: number
  modul: Modul
  baslangic: IstisnaKaydi
  onKapat: () => void
}) {
  const router = useRouter()
  const [kayit, setKayit] = useState<IstisnaKaydi>(baslangic)
  const [durum, setDurum] = useState<YetkiIstisnasiDurumu>({})
  const [bekliyor, basla] = useTransition()

  // "Görebilir" kapatılınca diğer üçü anlamsız (gör=false iken zaten hepsi
  // false sayılıyor) — kullanıcı bu tutarsız kombinasyonu kuramasın diye
  // otomatik kapatılıp devre dışı bırakılıyor.
  function gorebilirDegisti(deger: boolean) {
    setKayit((k) => ({
      gorebilir: deger,
      ekleyebilir: deger && k.ekleyebilir,
      duzeltebilir: deger && k.duzeltebilir,
      silebilir: deger && k.silebilir,
    }))
  }

  function kaydet() {
    basla(async () => {
      const form = new FormData()
      form.set("kullaniciId", String(kullaniciId))
      form.set("sayfaKodu", modul)
      if (kayit.gorebilir) form.set("gorebilir", "on")
      if (kayit.ekleyebilir) form.set("ekleyebilir", "on")
      if (kayit.duzeltebilir) form.set("duzeltebilir", "on")
      if (kayit.silebilir) form.set("silebilir", "on")

      const sonuc = await yetkiIstisnasiKaydet({}, form)
      setDurum(sonuc)
      if (!sonuc.hata) {
        toast.success("İstisna kaydedildi.")
        onKapat()
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap gap-4">
        {ISLEMLER.map(({ key, kisa }) => (
          <label
            key={key}
            className={cn(
              "flex items-center gap-1.5 text-[0.8125rem]",
              key !== "gorebilir" && !kayit.gorebilir && "opacity-40"
            )}
          >
            <input
              type="checkbox"
              checked={kayit[key]}
              disabled={key !== "gorebilir" && !kayit.gorebilir}
              onChange={(e) =>
                key === "gorebilir"
                  ? gorebilirDegisti(e.target.checked)
                  : setKayit((k) => ({ ...k, [key]: e.target.checked }))
              }
            />
            {kisa}
          </label>
        ))}
      </div>

      {durum.hata ? <p className="mt-2 text-[0.75rem] text-tehlike">{durum.hata}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" size="sm" onClick={kaydet} disabled={bekliyor}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onKapat} disabled={bekliyor}>
          Vazgeç
        </Button>
      </div>
    </div>
  )
}
