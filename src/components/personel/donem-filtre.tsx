import { Button } from "@/components/ui/button"

/**
 * PERSONEL RAPORLARI — ORTAK DÖNEM FİLTRESİ
 *
 * Satış-Tahsilat raporunda kullanılıyor (tarih aralığı + personel filtresi).
 * Sunucu bileşeni — `method=get`
 * ile çalışıyor, JavaScript kapalıyken bile filtreleniyor.
 */

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

export function DonemFiltre({
  yol,
  bas,
  bit,
  personel,
  personeller,
  ekAlan,
}: {
  yol: string
  bas: string
  bit: string
  personel: string
  personeller: { id: number; unvan: string }[]
  /** Ekranın kendine özel ek filtresi (ör. hareket türü). */
  ekAlan?: React.ReactNode
}) {
  return (
    <form
      method="get"
      action={yol}
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

      <div className="form-alani min-w-[12rem]">
        <label htmlFor="personel" className="form-etiket">
          Personel
        </label>
        <select
          id="personel"
          name="personel"
          defaultValue={personel}
          className={`${ALAN} w-full`}
        >
          <option value="">Tüm personel</option>
          {personeller.map((p) => (
            <option key={p.id} value={p.id}>
              {p.unvan}
            </option>
          ))}
        </select>
      </div>

      {ekAlan}

      <Button type="submit" size="sm" className="h-8">
        Getir
      </Button>
    </form>
  )
}
