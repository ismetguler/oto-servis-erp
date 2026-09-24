import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Tahsilat/ödeme liste filtresi. CSV dışa aktarımı aynı alanları kullanır. */
export function TahsilatFiltre({
  tur,
  odeme,
  kasa,
  bas,
  bit,
  q,
  kasalar,
}: {
  tur: string
  odeme: string
  kasa: string
  bas: string
  bit: string
  q: string
  kasalar: { id: number; ad: string }[]
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(tur || odeme || kasa || bas || bit || q)

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action="/tahsilat"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <Secim ad="tur" etiket="Tür" deger={tur}>
          <option value="tumu">Tahsilat + ödeme</option>
          <option value="TAHSILAT">Tahsilat</option>
          <option value="TEDIYE">Ödeme (tediye)</option>
        </Secim>

        <Secim ad="odeme" etiket="Ödeme Şekli" deger={odeme}>
          <option value="tumu">Tümü</option>
          <option value="NAKIT">Nakit</option>
          <option value="KREDI_KARTI">Kredi Kartı</option>
          <option value="HAVALE">Havale / EFT</option>
          <option value="CEK">Çek</option>
          <option value="SENET">Senet</option>
          <option value="MAHSUP">Mahsup</option>
        </Secim>

        <Secim ad="kasa" etiket="Kasa" deger={kasa}>
          <option value="tumu">Tüm kasalar</option>
          {kasalar.map((k) => (
            <option key={k.id} value={k.id}>
              {k.ad}
            </option>
          ))}
        </Secim>

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
              placeholder="Fiş no, cari, açıklama…"
              className={`${ALAN_SINIFI} pl-7`}
            />
          </div>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tahsilat">Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}

function Secim({
  ad,
  etiket,
  deger,
  children,
}: {
  ad: string
  etiket: string
  deger: string
  children: React.ReactNode
}) {
  return (
    <div className="form-alani">
      <label htmlFor={ad} className="form-etiket">
        {etiket}
      </label>
      <select id={ad} name={ad} defaultValue={deger} className={ALAN_SINIFI}>
        {children}
      </select>
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
