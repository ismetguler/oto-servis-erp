import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

const DURUMLAR: [string, string][] = [
  ["ACIK", "Açık"],
  ["BEKLEMEDE", "Beklemede"],
  ["TAMAMLANDI", "Tamamlandı"],
  ["TESLIM_EDILDI", "Teslim edildi"],
  ["IPTAL", "İptal"],
]

export function ProjeRaporFiltre({
  proje,
  q,
  durum,
  bas,
  bit,
  projeler,
}: {
  proje: string
  q: string
  durum: string
  bas: string
  bit: string
  projeler: string[]
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(proje || q || durum || bas || bit)

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action="/servis/proje/rapor"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani min-w-[14rem]">
          <label htmlFor="proje" className="form-etiket">
            Proje
          </label>
          <select id="proje" name="proje" defaultValue={proje} className={`${ALAN} w-full`}>
            <option value="">Tüm projeler</option>
            {projeler.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="__yok__">— Projesi girilmemiş —</option>
          </select>
        </div>

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
              placeholder="Plaka, kabul no, müşteri, filo şirketi…"
              className={`${ALAN} w-full pl-7`}
            />
          </div>
        </div>

        <div className="form-alani">
          <label htmlFor="durum" className="form-etiket">
            Kart Durumu
          </label>
          <select id="durum" name="durum" defaultValue={durum} className={ALAN}>
            <option value="">Tümü</option>
            {DURUMLAR.map(([deger, etiket]) => (
              <option key={deger} value={deger}>
                {etiket}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Giriş (baş.)
          </label>
          <input id="bas" name="bas" type="date" defaultValue={bas} className={ALAN} />
        </div>

        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Giriş (bit.)
          </label>
          <input id="bit" name="bit" type="date" defaultValue={bit} className={ALAN} />
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/servis/proje/rapor">Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}
