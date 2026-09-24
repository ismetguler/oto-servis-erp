"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { sifreSifirla, type SifreSifirlaDurumu } from "@/app/(panel)/ayar/kullanici/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * ŞİFRE SIFIRLAMA — kart üstünde ayrı düğme + açılır form, düzenleme
 * formunun BİR PARÇASI DEĞİL (11.1 kapsam maddesi). Aynı işlem kilitli bir
 * hesabı da açar: `hataliGirisSayisi`/`kilitBitis` sunucuda sıfırlanıyor.
 *
 * Kara Liste işlemindeki desenle aynı: `useActionState` yerine elle
 * `useTransition` — başarı sonrası kapatma/yenileme bir efekt değil,
 * doğrudan transition callback'inde yapılıyor.
 */
export function SifreSifirla({ kullaniciId, kod }: { kullaniciId: number; kod: string }) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [durum, setDurum] = useState<SifreSifirlaDurumu>({})
  const [bekliyor, basla] = useTransition()

  function gonder(form: FormData) {
    basla(async () => {
      const sonuc = await sifreSifirla({}, form)
      setDurum(sonuc)
      if (sonuc.basarili) {
        toast.success(sonuc.basarili)
        setAcik(false)
        router.refresh()
      }
    })
  }

  if (!acik) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDurum({})
          setAcik(true)
        }}
      >
        <KeyRound className="size-4" aria-hidden />
        Şifre Sıfırla
      </Button>
    )
  }

  return (
    <form
      onSubmit={(olay) => formGonderimi(olay, gonder)}
      className="w-full min-w-[16rem] max-md:min-w-0 rounded-md border border-border bg-card p-3"
    >
      <input type="hidden" name="kullaniciId" value={kullaniciId} />

      <p className="mb-2 text-[0.8125rem] font-medium">
        &ldquo;{kod}&rdquo; için yeni şifre belirleniyor
      </p>

      <input
        name="yeniSifre"
        type="text"
        autoComplete="off"
        autoFocus
        required
        placeholder="En az 6 karakter"
        className={cn(
          "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          durum.alanHatalari?.yeniSifre && "border-tehlike"
        )}
      />
      {durum.alanHatalari?.yeniSifre ? (
        <p className="mt-1 text-[0.75rem] text-tehlike">{durum.alanHatalari.yeniSifre}</p>
      ) : null}
      {durum.hata && !durum.alanHatalari ? (
        <p className="mt-1 text-[0.75rem] text-tehlike">{durum.hata}</p>
      ) : null}

      <p className="mt-1 text-[0.75rem] text-muted-foreground">
        Kaydedince hesabın hatalı giriş sayacı ve varsa kilidi de sıfırlanır.
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAcik(false)}
          disabled={bekliyor}
        >
          <X className="size-4" aria-hidden />
          Vazgeç
        </Button>
      </div>
    </form>
  )
}
