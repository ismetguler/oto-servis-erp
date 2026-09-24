import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

type Secenek = { id: number; kod: string; ad: string }

/** Stok hareket dökümü filtre çubuğu. CSV dışa aktarımı da aynı alanları kullanır. */
export function HareketFiltre({
  stoklar,
  stok,
  q,
  tur,
  bas,
  bit,
}: {
  stoklar: Secenek[]
  stok: string
  q: string
  tur: string
  bas: string
  bit: string
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(stok || q || tur || bas || bit)

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action="/stok/hareket"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani min-w-[14rem]">
          <label htmlFor="stok" className="form-etiket">
            Stok Kartı
          </label>
          <select id="stok" name="stok" defaultValue={stok} className={ALAN_SINIFI}>
            <option value="tumu">Tüm kartlar</option>
            {stoklar.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kod} — {s.ad}
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
            Tür
          </label>
          <select id="tur" name="tur" defaultValue={tur} className={ALAN_SINIFI}>
            <option value="tumu">Tümü</option>
            <option value="GIRIS">Giriş</option>
            <option value="CIKIS">Çıkış</option>
            <option value="DEVIR">Devir</option>
            <option value="SAYIM">Sayım Farkı</option>
            <option value="TRANSFER">Transfer</option>
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
              placeholder="Stok kodu, ad, açıklama…"
              className={`${ALAN_SINIFI} pl-7`}
            />
          </div>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stok/hareket">Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
