import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ROL_ADLARI } from "@/lib/yetki"
import type { Rol } from "@/generated/prisma/enums"

/** Cari listesindeki filtre formuyla aynı desen: düz GET, adres çubuğuna yazılır. */
export function KullaniciFiltre({
  q,
  rol,
  durum,
}: {
  q: string
  rol: string
  durum: string
}) {
  return (
    <form
      method="get"
      action="/ayar/kullanici"
      className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
    >
      <div className="form-alani min-w-[16rem] flex-1">
        <label htmlFor="q" className="form-etiket">
          Ara
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Kod, ad, e-posta…"
            className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <div className="form-alani">
        <label htmlFor="rol" className="form-etiket">
          Rol
        </label>
        <select
          id="rol"
          name="rol"
          defaultValue={rol}
          className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="">Tümü</option>
          {(Object.entries(ROL_ADLARI) as [Rol, string][]).map(([deger, ad]) => (
            <option key={deger} value={deger}>
              {ad}
            </option>
          ))}
        </select>
      </div>

      <div className="form-alani">
        <label htmlFor="durum" className="form-etiket">
          Durum
        </label>
        <select
          id="durum"
          name="durum"
          defaultValue={durum}
          className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="aktif">Aktif kayıtlar</option>
          <option value="pasif">Pasife alınanlar</option>
          <option value="">Tümü</option>
        </select>
      </div>

      <Button type="submit" size="sm">
        Listele
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/ayar/kullanici">Temizle</Link>
      </Button>
    </form>
  )
}
