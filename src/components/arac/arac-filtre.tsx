import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

export function AracFiltre({
  q,
  marka,
  durum,
  markalar,
}: {
  q: string
  marka: string
  durum: string
  markalar: { id: number; ad: string }[]
}) {
  return (
    <form
      method="get"
      action="/arac"
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
            placeholder="Plaka, şase no, marka, model, sahibi…"
            className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <div className="form-alani">
        <label htmlFor="marka" className="form-etiket">
          Marka
        </label>
        <select
          id="marka"
          name="marka"
          defaultValue={marka}
          className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="">Tüm markalar</option>
          {markalar.map((m) => (
            <option key={m.id} value={m.ad}>
              {m.ad}
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
          <option value="sigortasi-bitmis">Sigorta/kasko süresi geçmiş</option>
          <option value="muayenesi-gelen">Muayenesi geçmiş</option>
          <option value="garantisi-bitmis">Garantisi bitmiş</option>
          <option value="silinen">Silinen kayıtlar</option>
        </select>
      </div>

      <Button type="submit" size="sm">
        Listele
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/arac">Temizle</Link>
      </Button>
    </form>
  )
}
