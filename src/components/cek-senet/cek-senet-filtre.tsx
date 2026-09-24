import Link from "next/link"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Çek-senet liste filtresi. CSV dışa aktarımı aynı alanları kullanır. */
export function CekSenetFiltre({
  yon,
  tur,
  durum,
  onay,
  vade,
  q,
}: {
  yon: string
  tur: string
  durum: string
  onay: string
  vade: string
  q: string
}) {
  return (
    <form
      method="get"
      action="/cek-senet"
      className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
    >
      <Secim ad="yon" etiket="Yön" deger={yon}>
        <option value="tumu">Alınan + verilen</option>
        <option value="ALINAN">Alınan</option>
        <option value="VERILEN">Verilen</option>
      </Secim>

      <Secim ad="tur" etiket="Kıymet" deger={tur}>
        <option value="tumu">Çek + senet</option>
        <option value="CEK">Çek</option>
        <option value="SENET">Senet</option>
      </Secim>

      <Secim ad="durum" etiket="Durum" deger={durum}>
        <option value="acik">Kapanmamışlar</option>
        <option value="tumu">Tümü</option>
        <option value="PORTFOYDE">Portföyde</option>
        <option value="TAHSILDE">Tahsilde</option>
        <option value="TAHSIL_EDILDI">Tahsil edildi</option>
        <option value="ODENDI">Ödendi</option>
        <option value="KARSILIKSIZ">Karşılıksız</option>
        <option value="CIRO_EDILDI">Ciro edildi</option>
        <option value="IADE_EDILDI">İade edildi</option>
      </Secim>

      <Secim ad="onay" etiket="Onay" deger={onay}>
        <option value="tumu">Tümü</option>
        <option value="BEKLIYOR">Onay bekleyen</option>
        <option value="ONAYLANDI">Onaylanan</option>
        <option value="REDDEDILDI">Reddedilen</option>
      </Secim>

      <Secim ad="vade" etiket="Vade" deger={vade}>
        <option value="tumu">Tüm vadeler</option>
        <option value="gecen">Vadesi geçenler</option>
        <option value="bugun">Bugün vadesi gelenler</option>
        <option value="7">7 gün içinde</option>
        <option value="15">15 gün içinde</option>
        <option value="30">30 gün içinde</option>
      </Secim>

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
            placeholder="Portföy no, çek no, keşideci, banka, cari…"
            className={`${ALAN_SINIFI} pl-7`}
          />
        </div>
      </div>

      <Button type="submit" size="sm">
        Listele
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/cek-senet">Temizle</Link>
      </Button>
    </form>
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
