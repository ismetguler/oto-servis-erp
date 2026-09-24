"use client"

import { useEffect, useActionState, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, ScanLine, Save, Trash2, X } from "lucide-react"

import { stokGirisiAra, stokGirisiKaydet, type StokGirisiDurumu } from "@/app/(panel)/stok/giris/actions"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { metniSayiyaCevir } from "@/lib/sayi"

type Aday = {
  id: number
  kod: string
  ad: string
  barkod: string | null
  birim: string
  alisFiyat: number
  mevcutMiktar: number
}

type Satir = {
  stokId: number
  kod: string
  ad: string
  birim: string
  mevcutMiktar: number
  miktar: string
  birimFiyat: string
}

const ALAN =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"

/**
 * STOK GİRİŞİ FORMU (SA-5 / madde 18)
 *
 * Barkod/kod/ad ile MEVCUT ürün aranır, satır tablosuna eklenir; her satırda
 * miktar ve alış fiyatı yerinde düzenlenir. "Kaydet ve Uygula" tek
 * transaction'da fişi ONAYLANDI açar ve stoğu artırır (bkz. actions).
 *
 * Ürün araması yazdıkça çalışır (300 ms debounce) — barkod okuyucu Enter
 * gönderiyorsa bu da anında (debounce beklemeden) aratıyor.
 */
export function GirisFormu({
  depolar,
}: {
  depolar: { id: number; ad: string; varsayilan: boolean }[]
}) {
  const [durum, gonder, bekliyor] = useActionState<StokGirisiDurumu, FormData>(
    stokGirisiKaydet,
    {}
  )
  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [metin, setMetin] = useState("")
  const [adaylar, setAdaylar] = useState<Aday[]>([])
  const [bulunamadi, setBulunamadi] = useState(false)
  const [araniyor, setAraniyor] = useState(false)
  const aramaRef = useRef<HTMLInputElement>(null)
  const sonAramaRef = useRef("")

  const varsayilanDepo = depolar.find((d) => d.varsayilan)?.id ?? depolar[0]?.id ?? ""

  function ekle(a: Aday) {
    setSatirlar((mevcut) => {
      if (mevcut.some((s) => s.stokId === a.id)) return mevcut
      return [
        ...mevcut,
        {
          stokId: a.id,
          kod: a.kod,
          ad: a.ad,
          birim: a.birim,
          mevcutMiktar: a.mevcutMiktar,
          miktar: "1",
          birimFiyat: a.alisFiyat ? String(a.alisFiyat) : "",
        },
      ]
    })
    setMetin("")
    setAdaylar([])
    setBulunamadi(false)
    aramaRef.current?.focus()
  }

  async function ara(deger: string) {
    const sonuc = await stokGirisiAra(deger)
    // Kullanıcı bu sırada yazmaya devam ettiyse eski sonuç ekrana basılmasın.
    if (sonAramaRef.current !== deger) return
    if (sonuc.tam) {
      ekle(sonuc.tam)
      return
    }
    setAdaylar(sonuc.adaylar)
    setBulunamadi(sonuc.adaylar.length === 0)
  }

  // Yazdıkça otomatik arama — kullanıcı Ara'ya basmak zorunda kalmasın.
  useEffect(() => {
    const deger = metin.trim()
    sonAramaRef.current = deger

    if (deger.length < 2) {
      setAdaylar([])
      setBulunamadi(false)
      return
    }

    setAraniyor(true)
    const zamanlayici = setTimeout(async () => {
      await ara(deger)
      setAraniyor(false)
    }, 300)

    return () => clearTimeout(zamanlayici)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metin])

  function satirGuncelle(stokId: number, alan: "miktar" | "birimFiyat", deger: string) {
    setSatirlar((mevcut) =>
      mevcut.map((s) => (s.stokId === stokId ? { ...s, [alan]: deger } : s))
    )
  }

  function satirSil(stokId: number) {
    setSatirlar((mevcut) => mevcut.filter((s) => s.stokId !== stokId))
  }

  const genelToplam = satirlar.reduce(
    (t, s) => t + metniSayiyaCevir(s.miktar || "0") * metniSayiyaCevir(s.birimFiyat || "0"),
    0
  )

  return (
    <form onSubmit={(o) => formGonderimi(o, gonder)} className="flex flex-col gap-4 p-4">
      {durum.hata ? (
        <div className="rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          {durum.hata}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="form-alani">
          <span className="form-etiket">Giriş Deposu</span>
          <select name="depoId" defaultValue={String(varsayilanDepo)} className={ALAN}>
            <option value="">— seçilmedi —</option>
            {depolar.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
          <span className="text-[0.6875rem] text-muted-foreground">
            Boş bırakılırsa her ürün kendi deposuna girer
          </span>
        </label>

        <label className="form-alani">
          <span className="form-etiket">Satıcı (isteğe bağlı)</span>
          <input
            name="saticiAdi"
            className={ALAN}
            placeholder="Örn: Yılmaz Oto Yedek Parça"
          />
        </label>

        <label className="form-alani sm:col-span-2">
          <span className="form-etiket">Açıklama</span>
          <input
            name="aciklama"
            className={ALAN}
            placeholder="Örn: Nakit alım"
          />
        </label>
      </div>

      {/* --- ürün arama --- */}
      <div className="panel p-3">
        <div className="flex items-center gap-2">
          <ScanLine className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="relative flex-1">
            <input
              ref={aramaRef}
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              onKeyDown={(e) => {
                // Barkod okuyucu taramanın sonunda Enter gönderir — debounce
                // beklemeden anında arat.
                if (e.key === "Enter") {
                  e.preventDefault()
                  const deger = metin.trim()
                  if (deger.length >= 2) ara(deger)
                }
              }}
              autoFocus
              placeholder="Barkod okutun ya da stok kodu / ürün adı yazın"
              className="h-9 w-full rounded-sm border border-input bg-background px-3 pr-8 text-[0.875rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            {araniyor ? (
              <Loader2
                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : null}
          </div>
        </div>

        {bulunamadi ? (
          <p className="mt-2 text-[0.8125rem] text-muted-foreground">
            Eşleşen ürün yok. Kartı yoksa önce{" "}
            <Link href="/stok/yeni" className="text-primary underline" target="_blank">
              Stok Kartı
            </Link>{" "}
            ekranından açın.
          </p>
        ) : null}

        {adaylar.length > 0 ? (
          <ul className="mt-2 divide-y divide-border/70 rounded-sm border border-border">
            {adaylar.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => ekle(a)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[0.8125rem] hover:bg-accent"
                >
                  <span>
                    <span className="font-mono text-muted-foreground">{a.kod}</span> — {a.ad}
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    <Plus className="size-3.5" aria-hidden /> ekle
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* --- satır tablosu --- */}
      <div className="panel overflow-hidden">
        <div className="tablo-sarmal">
          <table className="veri-tablosu">
            <thead>
              <tr>
                <th>Ürün</th>
                <th className="w-24 text-right">Eldeki</th>
                <th className="w-28 text-right">Miktar</th>
                <th className="w-32 text-right">Alış Fiyatı</th>
                <th className="w-28 text-right">Tutar</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {satirlar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[0.8125rem] text-muted-foreground">
                    Yukarıdan ürün arayıp ekleyin.
                  </td>
                </tr>
              ) : (
                satirlar.map((s) => {
                  const tutar =
                    metniSayiyaCevir(s.miktar || "0") * metniSayiyaCevir(s.birimFiyat || "0")
                  return (
                    <tr key={s.stokId}>
                      <td>
                        <input type="hidden" name="stokId" value={s.stokId} />
                        <span className="font-mono text-muted-foreground">{s.kod}</span> — {s.ad}
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {s.mevcutMiktar} {s.birim}
                      </td>
                      <td className="text-right">
                        <input
                          name="miktar"
                          value={s.miktar}
                          onChange={(e) => satirGuncelle(s.stokId, "miktar", e.target.value)}
                          inputMode="decimal"
                          className={`${ALAN} text-right`}
                        />
                      </td>
                      <td className="text-right">
                        <input
                          name="birimFiyat"
                          value={s.birimFiyat}
                          onChange={(e) => satirGuncelle(s.stokId, "birimFiyat", e.target.value)}
                          inputMode="decimal"
                          placeholder="0"
                          className={`${ALAN} text-right`}
                        />
                      </td>
                      <td className="text-right tabular-nums">{para(tutar)}</td>
                      <td className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 text-tehlike hover:text-tehlike"
                          onClick={() => satirSil(s.stokId)}
                          aria-label="Satırı çıkar"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {satirlar.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Genel Toplam ({satirlar.length} kalem)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{para(genelToplam)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <div className="form-aksiyon-cubugu sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 py-3 backdrop-blur">
        <Button variant="outline" size="sm" asChild>
          <Link href="/stok/giris">
            <X className="size-4" aria-hidden />
            Vazgeç
          </Link>
        </Button>
        <Button type="submit" size="sm" disabled={bekliyor || satirlar.length === 0}>
          {bekliyor ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {bekliyor ? "Kaydediliyor…" : "Kaydet ve Uygula"}
        </Button>
      </div>
    </form>
  )
}
