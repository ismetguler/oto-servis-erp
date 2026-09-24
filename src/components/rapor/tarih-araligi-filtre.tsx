import { Button } from "@/components/ui/button"

/**
 * RAPORLAR — ORTAK TARİH ARALIĞI FİLTRESİ
 *
 * ADIM 10'daki 13 raporun çoğu tek ölçüt kullanıyor: tarih aralığı.
 * `components/personel/donem-filtre.tsx`'teki desenin sadeleştirilmişi —
 * personel/proje gibi ek seçenek gerekmeyen raporlar burayı kullanır.
 * Sunucu bileşeni — `method=get`, JavaScript kapalıyken de çalışır.
 */

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

export function TarihAraligiFiltre({
  yol,
  bas,
  bit,
  ekAlan,
}: {
  yol: string
  bas: string
  bit: string
  /** Ekranın kendine özel ek filtresi (ör. durum). */
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

      {ekAlan}

      <Button type="submit" size="sm" className="h-8">
        Getir
      </Button>
    </form>
  )
}
