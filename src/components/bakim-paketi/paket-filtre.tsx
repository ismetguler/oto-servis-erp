import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Bakım paketi listesi filtresi — işçilik kataloğundaki çubuğun aynısı. */
export function PaketFiltre({ q, durum }: { q: string; durum: string }) {
  return (
    <form
      method="get"
      action="/servis/bakim-paketi"
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
            placeholder="Kod, paket adı, marka, açıklama…"
            className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
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
          <option value="aktif">Aktif paketler</option>
          <option value="pasif">Pasife alınanlar</option>
          <option value="tumu">Aktif + pasif</option>
          <option value="silinen">Silinen paketler</option>
        </select>
      </div>

      <Button type="submit" size="sm">
        Listele
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/servis/bakim-paketi">Temizle</Link>
      </Button>
    </form>
  )
}
