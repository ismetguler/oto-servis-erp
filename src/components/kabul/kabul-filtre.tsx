import Link from "next/link"
import { FiltreKabugu } from "@/components/filtre-kabugu"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

const ALAN =
  "h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

export function KabulFiltre({
  yol,
  q,
  durum,
  bas,
  bit,
  formen,
  fatura,
  formenler,
  /** Açık/Kapalı Onarımlar sayfalarında durum sabit — seçici gizlenir. */
  durumSabit,
}: {
  yol: string
  q: string
  durum: string
  bas: string
  bit: string
  formen: string
  fatura: string
  formenler: { id: number; ad: string; soyad: string | null }[]
  durumSabit?: boolean
}) {
  // Mobilde filtreler katlanır; kullanıcı bir filtre uygulamışsa açık başlar.
  const filtreliMi = Boolean(
    q || bas || bit || formen || (durum !== "" && durum !== "hepsi") || (fatura !== "" && fatura !== "hepsi")
  )

  return (
    <FiltreKabugu filtreliMi={filtreliMi}>
      <form
        method="get"
        action={yol}
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
              placeholder="Kabul no, plaka, müşteri, şikâyet…"
              className={`${ALAN} w-full pl-7`}
            />
          </div>
        </div>

        {durumSabit ? (
          <input type="hidden" name="durum" value={durum} />
        ) : (
          <div className="form-alani">
            <label htmlFor="durum" className="form-etiket">
              Durum
            </label>
            <select id="durum" name="durum" defaultValue={durum} className={ALAN}>
              <option value="hepsi">Tüm kartlar</option>
              <option value="acik">Açık onarımlar</option>
              <option value="kapali">Kapalı (teslim edilmiş)</option>
              <option value="ACIK">Sadece: Açık</option>
              <option value="BEKLEMEDE">Sadece: Beklemede</option>
              <option value="TAMAMLANDI">Sadece: Tamamlandı</option>
              <option value="IPTAL">Sadece: İptal</option>
              <option value="geciken">Teslimatı geçenler</option>
              <option value="silinen">Silinen kartlar</option>
            </select>
          </div>
        )}

        <div className="form-alani">
          <label htmlFor="fatura" className="form-etiket">
            Fatura / Tahsilat
          </label>
          <select id="fatura" name="fatura" defaultValue={fatura} className={ALAN}>
            <option value="">Hepsi</option>
            <option value="kesilmeyen">Faturası kesilmeyenler</option>
            <option value="kesilen">Faturası kesilenler</option>
            <option value="odenmeyen">Tahsilatı yapılmayanlar</option>
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="formen" className="form-etiket">
            Formen
          </label>
          <select id="formen" name="formen" defaultValue={formen} className={ALAN}>
            <option value="">Hepsi</option>
            {formenler.map((f) => (
              <option key={f.id} value={f.id}>
                {[f.ad, f.soyad].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alani">
          <label htmlFor="bas" className="form-etiket">
            Giriş Başlangıç
          </label>
          <input id="bas" name="bas" type="date" defaultValue={bas} className={ALAN} />
        </div>

        <div className="form-alani">
          <label htmlFor="bit" className="form-etiket">
            Giriş Bitiş
          </label>
          <input id="bit" name="bit" type="date" defaultValue={bit} className={ALAN} />
        </div>

        <Button type="submit" size="sm">
          Listele
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={yol}>Temizle</Link>
        </Button>
      </form>
    </FiltreKabugu>
  )
}
