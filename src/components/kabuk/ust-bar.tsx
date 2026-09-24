"use client"

import { useEffect, useState } from "react"
import { Building2, ChevronDown, LogOut, Menu, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Modul } from "@/lib/yetki"
import { useMenuDurum } from "./menu-durum"
import { HizliArama } from "./hizli-arama"
import { cikisYap } from "./actions"

type Props = {
  firmaUnvan: string
  kullaniciAd: string
  kullaniciKod: string
  rolAdi: string
  izinliModuller: Modul[]
}

export function UstBar({
  firmaUnvan,
  kullaniciAd,
  kullaniciKod,
  rolAdi,
  izinliModuller,
}: Props) {
  const { ac } = useMenuDurum()
  // Hızlı arama paneli: masaüstündeki kutu da mobildeki büyüteç de bunu açar
  // (12.7'ye kadar ikisi de ölüydü). Ctrl/Cmd+K de aynı paneli açıyor.
  const [aramaAcik, setAramaAcik] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card px-3 md:gap-3 md:px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={ac}
        aria-label="Menüyü aç"
        className="-ml-1 size-10 shrink-0 md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      <div className="hidden min-w-0 items-center gap-2 text-[0.8125rem] sm:flex">
        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium" title={firmaUnvan}>
          {firmaUnvan}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setAramaAcik(true)}
        aria-label="Hızlı arama"
        className="relative ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-background px-2.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-accent md:flex"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Plaka, cari, stok ara…</span>
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setAramaAcik(true)}
        aria-label="Ara"
        className="ml-auto size-10 shrink-0 md:hidden"
      >
        <Search className="size-5" aria-hidden />
      </Button>

      <Tarih />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 shrink-0 gap-2 px-2 text-[0.8125rem] font-normal"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
              {basHarfler(kullaniciAd)}
            </span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block font-medium">{kullaniciAd}</span>
              <span className="block text-[0.6875rem] text-muted-foreground">
                {rolAdi}
              </span>
            </span>
            <ChevronDown
              className="hidden size-3.5 text-muted-foreground sm:block"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-[0.8125rem] font-medium">{kullaniciAd}</div>
            <div className="font-mono text-[0.75rem] text-muted-foreground">
              {kullaniciKod}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={cikisYap}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[0.8125rem] text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-4" aria-hidden />
              Çıkış Yap
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <HizliArama
        acik={aramaAcik}
        acikDegistir={setAramaAcik}
        izinliModuller={izinliModuller}
      />
    </header>
  )
}

/**
 * Tarih sunucuda ve tarayıcıda farklı çıkabildiği için (saat dilimi),
 * ilk çizimde boş bırakılıp bağlandıktan sonra yazılıyor. Böylece
 * "hydration" uyarısı almıyoruz.
 */
function Tarih() {
  const [metin, setMetin] = useState("")

  useEffect(() => {
    const yaz = () =>
      setMetin(
        new Date().toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          weekday: "long",
        })
      )
    yaz()
    const zamanlayici = setInterval(yaz, 60_000)
    return () => clearInterval(zamanlayici)
  }, [])

  return (
    <span className="hidden whitespace-nowrap text-[0.8125rem] text-muted-foreground lg:block">
      {metin}
    </span>
  )
}

function basHarfler(ad: string) {
  return ad
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase("tr-TR"))
    .join("")
}
