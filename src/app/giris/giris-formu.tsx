"use client"

import { useActionState, useState } from "react"
import { AlertCircle, Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { girisYap, type GirisDurumu } from "./actions"
import { formGonderimi } from "@/lib/form-gonderim"

const BASLANGIC: GirisDurumu = {}

export function GirisFormu() {
  const [durum, gonder, bekliyor] = useActionState(girisYap, BASLANGIC)
  const [sifreGorunsun, setSifreGorunsun] = useState(false)

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col gap-4">
      {durum.hata ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-tehlike-yumusak px-3 py-2.5 text-[0.8125rem] text-destructive"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{durum.hata}</span>
        </div>
      ) : null}

      <div className="form-alani">
        <Label htmlFor="kod" className="form-etiket">
          Kullanıcı Adı
        </Label>
        <Input
          id="kod"
          name="kod"
          autoComplete="username"
          autoFocus
          required
          maxLength={60}
          spellCheck={false}
          autoCapitalize="none"
          placeholder="ör. admin"
          className="h-10 font-mono tracking-tight"
        />
      </div>

      <div className="form-alani">
        <Label htmlFor="sifre" className="form-etiket">
          Şifre
        </Label>
        <div className="relative">
          <Input
            id="sifre"
            name="sifre"
            type={sifreGorunsun ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={200}
            placeholder="••••••••"
            className="h-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setSifreGorunsun((o) => !o)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={sifreGorunsun ? "Şifreyi gizle" : "Şifreyi göster"}
            tabIndex={-1}
          >
            {sifreGorunsun ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" disabled={bekliyor} className="mt-1 h-10 w-full gap-2">
        {bekliyor ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <LogIn className="size-4" aria-hidden />
        )}
        {bekliyor ? "Giriş yapılıyor…" : "Giriş Yap"}
      </Button>
    </form>
  )
}
