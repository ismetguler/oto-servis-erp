import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

export function IscilikFiltre({
  q,
  bolum,
  durum,
  bolumler,
}: {
  q: string
  bolum: string
  durum: string
  bolumler: { id: number; ad: string }[]
}) {
  return (
    <form
      method="get"
      action="/iscilik"
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
            placeholder="Kod, işçilik adı, açıklama…"
            className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <div className="form-alani">
        <label htmlFor="bolum" className="form-etiket">
          Bölüm
        </label>
        <select
          id="bolum"
          name="bolum"
          defaultValue={bolum}
          className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="">Tüm bölümler</option>
          {bolumler.map((b) => (
            <option key={b.id} value={b.id}>
              {b.ad}
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
          <option value="tumu">Aktif + pasif</option>
          <option value="silinen">Silinen kayıtlar</option>
        </select>
      </div>

      <Button type="submit" size="sm">
        Listele
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/iscilik">Temizle</Link>
      </Button>
    </form>
  )
}
