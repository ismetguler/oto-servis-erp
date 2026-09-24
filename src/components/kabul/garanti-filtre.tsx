import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { GARANTI_DURUM_ETIKETI, GARANTI_DURUMLARI } from "@/app/(panel)/servis/kabul/sema"
import { Button } from "@/components/ui/button"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

export function GarantiFiltre({
  q,
  firma,
  durum,
  tahsilat,
  bas,
  bit,
  firmalar,
}: {
  q: string
  firma: string
  durum: string
  tahsilat: string
  bas: string
  bit: string
  firmalar: { id: number; unvan: string }[]
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(q || firma || durum || tahsilat || bas || bit)

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action="/servis/garanti"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani min-w-[14rem] flex-1">
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
              placeholder="Plaka, kabul no, dosya / onay no…"
              className={`${ALAN} w-full pl-7`}
            />
          </div>
        </div>

        <div className="form-alani">
          <label htmlFor="firma" className="form-etiket">
            Garanti Veren
          </label>
          <select id="firma" name="firma" defaultValue={firma} className={ALAN}>
            <option value="">Tüm firmalar</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.unvan}
              </option>
            ))}
            <option value="yok">Firma girilmemiş</option>
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="durum" className="form-etiket">
            Takip Durumu
          </label>
          <select id="durum" name="durum" defaultValue={durum} className={ALAN}>
            <option value="">Hepsi</option>
            {GARANTI_DURUMLARI.map((d) => (
              <option key={d} value={d}>
                {GARANTI_DURUM_ETIKETI[d]}
              </option>
            ))}
            <option value="girilmemis">Durumu girilmemiş</option>
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="tahsilat" className="form-etiket">
            Tahsilat
          </label>
          <select id="tahsilat" name="tahsilat" defaultValue={tahsilat} className={ALAN}>
            <option value="">Hepsi</option>
            <option value="odenmeyen">Tahsil edilmemiş</option>
            <option value="odenen">Tahsil edilmiş</option>
            <option value="faturasiz">Faturası kesilmemiş</option>
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Giriş — Başlangıç
          </label>
          <input id="bas" name="bas" type="date" defaultValue={bas} className={ALAN} />
        </div>

        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Bitiş
          </label>
          <input id="bit" name="bit" type="date" defaultValue={bit} className={ALAN} />
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/servis/garanti">Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}
