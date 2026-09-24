import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"

import { LOG_ISLEM_ADLARI } from "@/app/(panel)/ayar/log/sema"
import { Button } from "@/components/ui/button"
import type { LogIslem } from "@/generated/prisma/enums"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

/** İşlem Kayıtları'nın adres çubuğundan gelen filtresi — düz GET formu (bkz. CariFiltre). */
export function LogFiltre({
  bas,
  bit,
  kullaniciId,
  tablo,
  islem,
  kullanicilar,
  tablolar,
}: {
  bas: string
  bit: string
  kullaniciId: string
  tablo: string
  islem: string
  kullanicilar: { id: number; ad: string }[]
  tablolar: string[]
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(bas || bit || kullaniciId || tablo || islem)

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action="/ayar/log"
        className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-4 py-2.5"
      >
        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Başlangıç
          </label>
          <input id="bas" name="bas" type="date" defaultValue={bas} className={ALAN} />
        </div>

        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Bitiş
          </label>
          <input id="bit" name="bit" type="date" defaultValue={bit} className={ALAN} />
        </div>

        <div className="form-alani">
          <label htmlFor="kullaniciId" className="form-etiket">
            Kullanıcı
          </label>
          <select id="kullaniciId" name="kullaniciId" defaultValue={kullaniciId} className={ALAN}>
            <option value="">Tümü</option>
            {kullanicilar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="tablo" className="form-etiket">
            Tablo
          </label>
          <select id="tablo" name="tablo" defaultValue={tablo} className={ALAN}>
            <option value="">Tümü</option>
            {tablolar.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="islem" className="form-etiket">
            İşlem Türü
          </label>
          <select id="islem" name="islem" defaultValue={islem} className={ALAN}>
            <option value="">Tümü</option>
            {Object.entries(LOG_ISLEM_ADLARI).map(([deger, ad]) => (
              <option key={deger} value={deger as LogIslem}>
                {ad}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ayar/log">Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}
