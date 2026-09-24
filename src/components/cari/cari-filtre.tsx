import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { CARI_TUR_ADLARI } from "@/app/(panel)/cari/sema"
import { Button } from "@/components/ui/button"

/**
 * Liste filtresi düz bir GET formudur; seçimler adres çubuğuna yazılır.
 * Böylece filtrelenmiş liste yer imine eklenebilir, birine link olarak
 * gönderilebilir ve geri tuşu beklendiği gibi çalışır.
 */
export function CariFiltre({
  q,
  tur,
  durum,
  plasiyer,
  plasiyerler,
}: {
  q: string
  tur: string
  durum: string
  plasiyer: string
  plasiyerler: { id: number; unvan: string }[]
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(q || tur || plasiyer || (durum !== "" && durum !== "aktif"))

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action="/cari"
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
              placeholder="Ünvan, kod, vergi no, telefon…"
              className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>
        </div>

        <div className="form-alani">
          <label htmlFor="tur" className="form-etiket">
            Tür
          </label>
          <select
            id="tur"
            name="tur"
            defaultValue={tur}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Tümü</option>
            {Object.entries(CARI_TUR_ADLARI).map(([deger, ad]) => (
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
            <option value="borclu">Bakiyesi olanlar</option>
            <option value="karaliste">Kara liste</option>
            <option value="bugun">Bugün açılanlar</option>
            <option value="silinen">Silinen kayıtlar</option>
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="plasiyer" className="form-etiket">
            Sorumlu Personel
          </label>
          <select
            id="plasiyer"
            name="plasiyer"
            defaultValue={plasiyer}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Tümü</option>
            <option value="__yok__">— Sorumlu personel girilmemiş —</option>
            {plasiyerler.map((p) => (
              <option key={p.id} value={p.id}>
                {p.unvan}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cari">Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}
