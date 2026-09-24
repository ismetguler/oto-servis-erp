import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Liste filtresi düz bir GET formudur; seçimler adres çubuğuna yazılır
 * (Cari/İşçilik filtrelerindeki desenin aynısı).
 */
export function StokFiltre({
  q,
  depo,
  grup,
  durum,
  depolar,
  urunGruplari,
  aksiyon = "/stok",
}: {
  q: string
  depo: string
  grup: string
  durum: string
  depolar: { id: number; ad: string }[]
  urunGruplari: string[]
  /** Bu bileşen /stok dışındaki ekranlarda da kullanılıyor (toplu fiyat,
   * etiket…) — "Listele" düğmesi kendi sayfasında kalsın diye hedef adres
   * parametrik. Belirtilmezse liste ekranına gider. */
  aksiyon?: string
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(q || depo || grup || (durum !== "" && durum !== "aktif"))

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action={aksiyon}
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
              placeholder="Ürün adı, kod, barkod, üretici kodu, muadil…"
              className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>
        </div>

        <div className="form-alani">
          <label htmlFor="depo" className="form-etiket">
            Depo
          </label>
          <select
            id="depo"
            name="depo"
            defaultValue={depo}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Tümü</option>
            <option value="__yok__">— Deposu girilmemiş —</option>
            {depolar.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="grup" className="form-etiket">
            Ürün Grubu
          </label>
          <select
            id="grup"
            name="grup"
            defaultValue={grup}
            className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Tümü</option>
            {urunGruplari.map((g) => (
              <option key={g} value={g}>
                {g}
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
            <option value="silinen">Silinen kayıtlar</option>
          </select>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={aksiyon}>Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}
