import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

type Secenek = { id: number; kod: string; ad: string }

/** Kasa defteri filtre çubuğu. CSV dışa aktarımı da aynı alanları kullanır. */
export function DefterFiltre({
  kasalar,
  kasa,
  q,
  tur,
  bas,
  bit,
}: {
  kasalar: Secenek[]
  kasa: string
  q: string
  tur: string
  bas: string
  bit: string
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(kasa || q || tur || bas || bit)

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action="/kasa/defter"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani">
          <label htmlFor="kasa" className="form-etiket">
            Kasa
          </label>
          <select id="kasa" name="kasa" defaultValue={kasa} className={ALAN_SINIFI}>
            <option value="tumu">Tüm kasalar</option>
            {kasalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kod} — {k.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Başlangıç
          </label>
          <input id="bas" name="bas" type="date" defaultValue={bas} className={ALAN_SINIFI} />
        </div>

        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Bitiş
          </label>
          <input id="bit" name="bit" type="date" defaultValue={bit} className={ALAN_SINIFI} />
        </div>

        <div className="form-alani">
          <label htmlFor="tur" className="form-etiket">
            Yön
          </label>
          <select id="tur" name="tur" defaultValue={tur} className={ALAN_SINIFI}>
            <option value="tumu">Giriş + çıkış</option>
            <option value="giris">Sadece giriş</option>
            <option value="cikis">Sadece çıkış</option>
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
              placeholder="Açıklama, belge no, masraf türü, cari…"
              className={`${ALAN_SINIFI} pl-7`}
            />
          </div>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kasa/defter">Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
