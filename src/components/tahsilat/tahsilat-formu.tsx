"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, Save, Search, X } from "lucide-react"

import {
  tahsilatCariAra,
  tahsilatKaydet,
  type TahsilatFormDurumu,
} from "@/app/(panel)/tahsilat/actions"
import {
  kagitGerektirir,
  KASALI_ODEME_SEKILLERI,
  posAlanlariGorunur,
} from "@/app/(panel)/tahsilat/sema"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * TAHSİLAT / ÖDEME FORMU
 *
 * Tek form iki ekranı besliyor; `tur` yalnızca yeni kayıtta ve sayfanın
 * kendisi tarafından belirleniyor. Kaydedilmiş fişin türü formdan
 * değiştirilemez: yön değişirse cari bakiyesi iki kat sapar, kullanıcı da
 * bunu fark etmez.
 */

type CariAdayi = {
  id: number
  kod: string
  unvan: string
  bakiye: number
  karaListe?: boolean
  karaListeNedeni?: string | null
}
type KasaSecenegi = { id: number; ad: string; tur: string; bakiye: number }

export type TahsilatBaslangic = {
  id: number
  fisNo: string
  tur: "TAHSILAT" | "TEDIYE"
  cari: CariAdayi
  tarih: string
  tutar: number
  odemeSekli: string
  kasaId: number | null
  kabulId: number | null
  aciklama: string | null
  posBanka: string | null
  posKartSahibi: string | null
  posSon4: string | null
  posProvizyon: string | null
  posTaksit: number | null
  /// Fişten doğmuş çek/senet kaydı (adım 6.3) — düzenlemede alanlar dolu gelsin.
  kagit: {
    id: number
    portfoyNo: string
    vadeTarihi: string
    belgeNo: string | null
    banka: string | null
    borclu: string | null
    durum: string
  } | null
}

function kasaliMi(odemeSekli: string) {
  return (KASALI_ODEME_SEKILLERI as readonly string[]).includes(odemeSekli)
}

export function TahsilatFormu({
  tur,
  kasalar,
  baslangic,
  hazirCari,
}: {
  tur: "TAHSILAT" | "TEDIYE"
  kasalar: KasaSecenegi[]
  baslangic?: TahsilatBaslangic
  /** Cari kartından "tahsilat gir" ile gelindiğinde önceden seçili gelsin. */
  hazirCari?: CariAdayi
}) {
  const [durum, gonder, bekliyor] = useActionState<TahsilatFormDurumu, FormData>(
    tahsilatKaydet,
    {}
  )
  const [cari, setCari] = useState<CariAdayi | null>(baslangic?.cari ?? hazirCari ?? null)
  const [odemeSekli, setOdemeSekli] = useState(baslangic?.odemeSekli ?? "NAKIT")
  const hata = (alan: string) => durum.alanHatalari?.[alan]


  const tahsilat = tur === "TAHSILAT"
  const kasaLazim = kasaliMi(odemeSekli)
  const kagitLazim = kagitGerektirir(odemeSekli)
  const posGorunur = posAlanlariGorunur(odemeSekli)

  const bugun = new Date()
  const bugunMetni = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, "0")}-${String(
    bugun.getDate()
  ).padStart(2, "0")}`

  return (
    <form onSubmit={(olay) => formGonderimi(olay, gonder)} className="flex flex-col">
      {baslangic ? <input type="hidden" name="id" value={baslangic.id} /> : null}
      <input type="hidden" name="tur" value={baslangic?.tur ?? tur} />
      <input type="hidden" name="cariId" value={cari?.id ?? ""} />
      <input type="hidden" name="kabulId" value={baslangic?.kabulId ?? ""} />

      {durum.hata ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      {/* KARA LİSTE UYARI BANDI (SA-2 / 2.5) — seçili cari kara listedeyse
          tahsilat/ödeme girişini ENGELLEMEZ, sadece uyarır. */}
      {cari?.karaListe ? (
        <div className="mx-4 mt-4 rounded-md border border-tehlike/40 bg-tehlike-yumusak px-3 py-2.5 text-[0.8125rem] text-tehlike">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            ⚠ Bu cari kara listede — {cari.unvan}
          </div>
          {cari.karaListeNedeni ? (
            <p className="mt-1 whitespace-pre-wrap">Sebep: {cari.karaListeNedeni}</p>
          ) : null}
        </div>
      ) : null}

      <div className="p-4">
        <div className="panel p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <CariSecici
              secili={cari}
              onSec={setCari}
              etiket={tahsilat ? "Tahsilat Yapılan Cari" : "Ödeme Yapılan Cari"}
              hata={hata("cariId")}
            />

            <Alan
              ad="fisNo"
              etiket="Fiş / Makbuz No"
              hata={hata("fisNo")}
              ipucu={
                baslangic
                  ? undefined
                  : `Boş bırakılırsa sıradaki ${tahsilat ? "TH" : "TD"}${bugun.getFullYear()}-… makbuz no otomatik verilir.`
              }
            >
              <Girdi
                name="fisNo"
                defaultValue={baslangic?.fisNo}
                maxLength={30}
                placeholder="otomatik"
                className="font-mono"
              />
            </Alan>

            <Alan ad="tarih" etiket="Tarih" zorunlu hata={hata("tarih")} ipucu="Ön değer: bugünün tarihi">
              <input
                id="tarih"
                name="tarih"
                type="date"
                defaultValue={baslangic?.tarih ?? bugunMetni}
                className={ALAN_SINIFI}
                required
              />
            </Alan>

            <Alan
              ad="tutar"
              etiket={tahsilat ? "Tahsil Edilen Tutar" : "Ödenen Tutar"}
              zorunlu
              hata={hata("tutar")}
            >
              <Girdi
                name="tutar"
                defaultValue={baslangic?.tutar}
                inputMode="decimal"
                required
                placeholder="0,00"
                className="text-right font-mono text-[0.9375rem]"
              />
            </Alan>

            <Alan ad="odemeSekli" etiket="Ödeme Şekli" zorunlu hata={hata("odemeSekli")}>
              <select
                id="odemeSekli"
                name="odemeSekli"
                value={odemeSekli}
                onChange={(e) => setOdemeSekli(e.target.value)}
                className={ALAN_SINIFI}
              >
                <option value="NAKIT">Nakit</option>
                <option value="KREDI_KARTI">Kredi Kartı</option>
                <option value="HAVALE">Havale / EFT</option>
                <option value="CEK">Çek</option>
                <option value="SENET">Senet</option>
                <option value="MAHSUP">Mahsup</option>
              </select>
            </Alan>

            {kasaLazim ? (
              <Alan
                ad="kasaId"
                etiket={tahsilat ? "Giren Kasa" : "Çıkan Kasa"}
                zorunlu
                hata={hata("kasaId")}
              >
                <select
                  id="kasaId"
                  name="kasaId"
                  defaultValue={baslangic?.kasaId ?? ""}
                  className={ALAN_SINIFI}
                >
                  <option value="">— seçin —</option>
                  {kasalar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ad} ({para(k.bakiye)})
                    </option>
                  ))}
                </select>
              </Alan>
            ) : (
              // Kasasız ödeme şekillerinde alan hiç gönderilmesin: sunucu
              // tarafı da yok sayıyor ama boş string göndermek şemayı
              // gereksiz yere "kasa geçersiz" hatasına sokabiliyordu.
              <div className="form-alani">
                <span className="form-etiket">Kasa</span>
                <p className="rounded-sm border border-border bg-muted/40 px-2 py-1.5 text-[0.75rem] text-muted-foreground">
                  {odemeSekli === "MAHSUP"
                    ? "Mahsup para hareketi değildir, kasaya işlenmez."
                    : "Çek / senet kasaya ancak tahsil edildiğinde girer. Kâğıdı Çek-Senet modülünden takip edin."}
                </p>
              </div>
            )}

            {kagitLazim ? (
              <>
                <Alan
                  ad="cekVadeTarihi"
                  etiket="Vade Tarihi"
                  zorunlu
                  hata={hata("cekVadeTarihi")}
                  ipucu="Kâğıt bu vadeyle Çek-Senet portföyüne düşer."
                >
                  <input
                    id="cekVadeTarihi"
                    name="cekVadeTarihi"
                    type="date"
                    defaultValue={baslangic?.kagit?.vadeTarihi ?? ""}
                    className={ALAN_SINIFI}
                  />
                </Alan>

                <Alan
                  ad="cekBelgeNo"
                  etiket={odemeSekli === "SENET" ? "Senet Seri No" : "Çek No"}
                  hata={hata("cekBelgeNo")}
                >
                  <Girdi
                    name="cekBelgeNo"
                    defaultValue={baslangic?.kagit?.belgeNo ?? ""}
                    maxLength={50}
                    className="font-mono"
                    placeholder="Örn: 0012345"
                  />
                </Alan>

                <Alan ad="cekBanka" etiket="Banka" hata={hata("cekBanka")}>
                  <Girdi
                    name="cekBanka"
                    defaultValue={baslangic?.kagit?.banka ?? ""}
                    maxLength={100}
                    placeholder="Örn: Ziraat Bankası"
                  />
                </Alan>

                <Alan
                  ad="cekBorclu"
                  etiket="Keşideci / Borçlu"
                  hata={hata("cekBorclu")}
                  ipucu="Müşteri kendi çekini vermek zorunda değil (müşteri çeki / ciro)."
                >
                  <Girdi
                    name="cekBorclu"
                    defaultValue={baslangic?.kagit?.borclu ?? ""}
                    maxLength={200}
                    placeholder="Örn: Ahmet Yılmaz / ABC Nakliyat Ltd."
                  />
                </Alan>

                <div className="form-alani sm:col-span-2">
                  <span className="form-etiket">Otomatik Kayıt</span>
                  <p className="rounded-sm border border-border bg-muted/40 px-2 py-1.5 text-[0.75rem] text-muted-foreground">
                    {baslangic?.kagit ? (
                      <>
                        Bu fişin kâğıdı{" "}
                        <Link
                          href={`/cek-senet/${baslangic.kagit.id}`}
                          className="font-mono underline"
                        >
                          {baslangic.kagit.portfoyNo}
                        </Link>{" "}
                        numarasıyla portföyde. Bilgileri buradan değişir.
                      </>
                    ) : (
                      "Kaydedince Çek-Senet portföyünde onaylı bir kayıt otomatik açılır; ayrıca elle girmeyin."
                    )}
                  </p>
                </div>
              </>
            ) : null}

            {posGorunur ? (
              <>
                <div className="sm:col-span-3 -mb-1 mt-1 border-t border-border pt-3">
                  <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                    Sanal POS / Kart Bilgisi{" "}
                    <span className="normal-case tracking-normal">
                      — dekonttan elle girilir, gerçek POS entegrasyonu yoktur
                    </span>
                  </p>
                </div>

                <Alan ad="posBanka" etiket="Banka / POS" hata={hata("posBanka")}>
                  <Girdi
                    name="posBanka"
                    defaultValue={baslangic?.posBanka ?? ""}
                    maxLength={100}
                    placeholder="Örn: Garanti sanal POS"
                  />
                </Alan>

                <Alan ad="posKartSahibi" etiket="Kart Sahibi" hata={hata("posKartSahibi")}>
                  <Girdi
                    name="posKartSahibi"
                    defaultValue={baslangic?.posKartSahibi ?? ""}
                    maxLength={200}
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </Alan>

                <Alan
                  ad="posSon4"
                  etiket="Kart Son 4 Hane"
                  hata={hata("posSon4")}
                  ipucu="Kartın tamamı bilinçli olarak saklanmıyor."
                >
                  <Girdi
                    name="posSon4"
                    defaultValue={baslangic?.posSon4 ?? ""}
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="1234"
                    className="font-mono"
                  />
                </Alan>

                <Alan ad="posProvizyon" etiket="Provizyon / Onay Kodu" hata={hata("posProvizyon")}>
                  <Girdi
                    name="posProvizyon"
                    defaultValue={baslangic?.posProvizyon ?? ""}
                    maxLength={50}
                    className="font-mono"
                    placeholder="Örn: 123456"
                  />
                </Alan>

                <Alan ad="posTaksit" etiket="Taksit" hata={hata("posTaksit")}>
                  <Girdi
                    name="posTaksit"
                    defaultValue={baslangic?.posTaksit ?? ""}
                    inputMode="numeric"
                    placeholder="1"
                    className="text-right font-mono"
                  />
                </Alan>
              </>
            ) : null}

            <Alan ad="aciklama" etiket="Açıklama" hata={hata("aciklama")} genis>
              <Metin
                name="aciklama"
                defaultValue={baslangic?.aciklama ?? ""}
                rows={2}
                maxLength={1000}
                placeholder={tahsilat ? "Örn: 12345 no'lu iş emri tahsilatı" : "Örn: parça alımı ödemesi"}
              />
            </Alan>
          </div>

          {cari ? (
            <p className="mt-3 rounded-sm border border-border bg-muted/40 px-3 py-2 text-[0.75rem] text-muted-foreground">
              <strong>{cari.unvan}</strong> güncel bakiyesi:{" "}
              <span className={cari.bakiye > 0 ? "text-tehlike" : "text-basari"}>
                {para(Math.abs(cari.bakiye))} {cari.bakiye > 0 ? "borçlu" : "alacaklı"}
              </span>{" "}
              · bu fiş kaydedilince{" "}
              {tahsilat
                ? cari.bakiye > 0
                  ? "borcu azalır"
                  : "alacaklı (avans) bakiyesi artar"
                : cari.bakiye < 0
                  ? "alacağı azalır"
                  : "borç bakiyesi artar"}
              .
            </p>
          ) : null}
        </div>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href={baslangic ? `/tahsilat/${baslangic.id}` : "/tahsilat"}>
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

function CariSecici({
  secili,
  onSec,
  etiket,
  hata,
}: {
  secili: CariAdayi | null
  onSec: (c: CariAdayi | null) => void
  etiket: string
  hata?: string
}) {
  const [q, setQ] = useState("")
  const [adaylar, setAdaylar] = useState<CariAdayi[]>([])
  const [ariyor, setAriyor] = useState(false)

  useEffect(() => {
    let iptal = false
    if (secili || q.trim().length < 2) {
      const temizle = setTimeout(() => {
        if (!iptal) setAdaylar([])
      }, 0)
      return () => {
        iptal = true
        clearTimeout(temizle)
      }
    }
    const araniyorGoster = setTimeout(() => {
      if (!iptal) setAriyor(true)
    }, 0)
    const zamanlayici = setTimeout(async () => {
      const sonuc = await tahsilatCariAra(q)
      if (!iptal) {
        setAdaylar(sonuc)
        setAriyor(false)
      }
    }, 250)
    return () => {
      iptal = true
      clearTimeout(araniyorGoster)
      clearTimeout(zamanlayici)
    }
  }, [q, secili])

  if (secili) {
    return (
      <div className="form-alani">
        <span className="form-etiket zorunlu-alan">{etiket}</span>
        <div className="flex h-8 items-center justify-between gap-2 rounded-sm border border-input bg-muted/40 px-2 text-[0.8125rem]">
          <span className="truncate">
            <span className="font-mono text-muted-foreground">{secili.kod}</span> {secili.unvan}
          </span>
          <button
            type="button"
            onClick={() => {
              onSec(null)
              setQ("")
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cari seçimini kaldır"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-alani relative">
      <label htmlFor="cariArama" className="form-etiket zorunlu-alan">
        {etiket}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="cariArama"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Unvan, kod veya vergi no…"
          autoComplete="off"
          className={cn(ALAN_SINIFI, "pl-7")}
        />
      </div>
      {hata ? <p className="text-[0.75rem] text-tehlike">{hata}</p> : null}
      {q.trim().length >= 2 && (adaylar.length > 0 || ariyor) ? (
        <ul className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-sm border border-border bg-popover shadow-md">
          {ariyor && adaylar.length === 0 ? (
            <li className="px-2 py-1.5 text-[0.8125rem] text-muted-foreground">Aranıyor…</li>
          ) : null}
          {adaylar.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSec(c)
                  setAdaylar([])
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[0.8125rem] hover:bg-accent"
              >
                <span className="font-mono text-muted-foreground">{c.kod}</span>
                <span className="truncate">{c.unvan}</span>
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {para(c.bakiye)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

function Alan({
  ad,
  etiket,
  zorunlu,
  hata,
  ipucu,
  genis,
  children,
}: {
  ad: string
  etiket: string
  zorunlu?: boolean
  hata?: string
  ipucu?: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("form-alani", genis && "sm:col-span-3")}>
      <label htmlFor={ad} className={cn("form-etiket", zorunlu && "zorunlu-alan")}>
        {etiket}
      </label>
      {children}
      {hata ? (
        <p className="text-[0.75rem] text-tehlike">{hata}</p>
      ) : (
        <>
          {zorunlu ? (
            <p className="text-[0.6875rem] text-muted-foreground">Zorunlu — boş bırakılamaz</p>
          ) : null}
          {ipucu ? (
            <p className="text-[0.6875rem] text-muted-foreground">{ipucu}</p>
          ) : null}
        </>
      )}
    </div>
  )
}

function Girdi({ name, className, ...kalan }: React.ComponentProps<"input"> & { name: string }) {
  return <input id={name} name={name} className={cn(ALAN_SINIFI, className)} {...kalan} />
}

function Metin({ name, className, ...kalan }: React.ComponentProps<"textarea"> & { name: string }) {
  return (
    <textarea
      id={name}
      name={name}
      className={cn(ALAN_SINIFI, "h-auto resize-y py-1.5", className)}
      {...kalan}
    />
  )
}
