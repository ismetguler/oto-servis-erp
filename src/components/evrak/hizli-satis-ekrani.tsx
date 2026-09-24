"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { AlertTriangle, Barcode, Loader2, Save, Search, ShoppingCart, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { hizliSatisBarkodAra, hizliSatisTamamla, type HizliSatisDurumu } from "@/app/(panel)/evrak/hizli-satis/actions"
import type { BulunanParca } from "@/app/(panel)/evrak/hizli-satis/veri"
import { tahsilatCariAra } from "@/app/(panel)/tahsilat/actions"
import {
  kagitGerektirir,
  KASALI_ODEME_SEKILLERI,
  posAlanlariGorunur,
} from "@/app/(panel)/tahsilat/sema"
import { Button } from "@/components/ui/button"
import { miktar as miktarBicim, para, yuzde } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { kalemHesapla } from "@/lib/hesap"
import { metniSayiyaCevir } from "@/lib/sayi"
import { cn } from "@/lib/utils"

/**
 * HIZLI SATIŞ / PERAKENDE — tezgâh üstü satış ekranı (adım 9.3)
 *
 * Barkod okuma tarafı Kabul Parça Çıkışı'ndaki `HizliCikis` bileşeninin
 * AYNI deseni: barkod oku → Enter → adet yaz → Enter → sepete düşer, odak
 * kendiliğinden barkod kutusuna döner. Tek fark: satırlar DB'ye tek tek
 * YAZILMAZ — sepet tarayıcıda tutulur, "Satışı Tamamla" tek transaction'da
 * hem evrakı keser hem tahsilatı yazar (bkz. `evrak/hizli-satis/actions.ts`).
 *
 * Cari seçimi ZORUNLU DEĞİL (PROMPTLAR.md 9.3) — boş bırakılırsa sunucu
 * tarafı sabit "Perakende Müşteri" carisini kullanır.
 */

type SepetSatiri = {
  anahtar: number
  stokId: number | null
  kod: string | null
  aciklama: string
  birim: string
  miktar: number
  birimFiyat: number
  kdvOrani: number
}

type CariAdayi = {
  id: number
  kod: string
  unvan: string
  bakiye: number
  karaListe?: boolean
  karaListeNedeni?: string | null
}
type KasaSecenegi = { id: number; ad: string; tur: string; bakiye: number }

let sepetSayaci = 0

export function HizliSatisEkrani({ kasalar }: { kasalar: KasaSecenegi[] }) {
  const [durum, gonder, bekliyor] = useActionState<HizliSatisDurumu, FormData>(hizliSatisTamamla, {})
  const [ariyorMu, basla] = useTransition()

  const [sepet, setSepet] = useState<SepetSatiri[]>([])
  const [cari, setCari] = useState<CariAdayi | null>(null)
  const [odemeSekli, setOdemeSekli] = useState("NAKIT")

  const [secilen, setSecilen] = useState<BulunanParca | null>(null)
  const [adaylar, setAdaylar] = useState<BulunanParca[]>([])
  const [vurgulu, setVurgulu] = useState(0)
  const [adet, setAdet] = useState("1")
  const [fiyat, setFiyat] = useState("")
  const [bulunamadi, setBulunamadi] = useState<string | null>(null)

  const barkodRef = useRef<HTMLInputElement>(null)
  const adetRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    barkodRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!secilen) return
    adetRef.current?.focus()
    adetRef.current?.select()
  }, [secilen])

  /**
   * "Kayıt sırasında state sıfırlama" render aşamasında yapılıyor (React'in
   * önerdiği desen — bkz. `hizli-tahsilat.tsx`daki aynı çözüm): `basarili`
   * metni her satışta değiştiği (evrak no + fiş no farklı) için "yeni bir
   * sonuç geldi mi" kıyaslaması buradan çıkıyor. Toast ise dış bir sistem
   * olduğu için ayrı bir effect'te kalıyor.
   */
  const [islenenSonuc, setIslenenSonuc] = useState<string | undefined>(undefined)
  if (durum.basarili && durum.basarili !== islenenSonuc) {
    setIslenenSonuc(durum.basarili)
    setSepet([])
    setCari(null)
    setOdemeSekli("NAKIT")
  }

  useEffect(() => {
    if (!durum.basarili) return
    toast.success(durum.basarili)
    formRef.current?.reset()
    barkodRef.current?.focus()
  }, [durum.basarili])

  useEffect(() => {
    if (durum.hata) toast.error(durum.hata)
  }, [durum.hata])

  function taramayiSifirla() {
    setSecilen(null)
    setAdaylar([])
    setVurgulu(0)
    setAdet("1")
    setFiyat("")
    setBulunamadi(null)
    if (barkodRef.current) barkodRef.current.value = ""
    barkodRef.current?.focus()
  }

  function parcayiSec(p: BulunanParca) {
    setSecilen(p)
    setAdaylar([])
    setVurgulu(0)
    setBulunamadi(null)
    setFiyat(String(p.fiyat).replace(".", ","))
    setAdet("1")
  }

  function oku() {
    const metin = barkodRef.current?.value.trim() ?? ""
    if (metin.length < 2) return
    setBulunamadi(null)

    basla(async () => {
      const sonuc = await hizliSatisBarkodAra(metin)
      if (sonuc.tam) {
        parcayiSec(sonuc.tam)
        return
      }
      if (sonuc.adaylar.length === 1) {
        parcayiSec(sonuc.adaylar[0])
        return
      }
      if (sonuc.adaylar.length === 0) {
        setBulunamadi(metin)
        setAdaylar([])
        barkodRef.current?.select()
        return
      }
      setAdaylar(sonuc.adaylar)
      setVurgulu(0)
    })
  }

  function sepeteEkle() {
    if (!secilen) return
    const miktarSayi = metniSayiyaCevir(adet)
    const fiyatSayi = metniSayiyaCevir(fiyat)
    if (!Number.isFinite(miktarSayi) || miktarSayi <= 0) {
      toast.error("Adet 0'dan büyük olmalı.")
      return
    }
    if (!Number.isFinite(fiyatSayi) || fiyatSayi < 0) {
      toast.error("Birim fiyat geçersiz.")
      return
    }

    // Stoktan fazla satışa İZİN VERİLİR ama kullanıcı uyarılır (İsmet kararı):
    // acil serviste mal gelmeden iş çıkabiliyor; blok değil, bilgi.
    const sepettekiAyniStok = sepet
      .filter((s) => s.stokId === secilen.id)
      .reduce((t, s) => t + s.miktar, 0)
    if (miktarSayi + sepettekiAyniStok > secilen.stokta) {
      toast.warning(
        `${secilen.kod} stokta ${miktarBicim(secilen.stokta)} ${secilen.birim.toLowerCase()} var, ` +
          `${miktarBicim(miktarSayi + sepettekiAyniStok)} satılıyor — stok eksiye düşecek.`
      )
    }

    sepetSayaci += 1
    setSepet((s) => [
      ...s,
      {
        anahtar: sepetSayaci,
        stokId: secilen.id,
        kod: secilen.kod,
        aciklama: secilen.ad,
        birim: secilen.birim,
        miktar: miktarSayi,
        birimFiyat: fiyatSayi,
        kdvOrani: secilen.kdvOrani,
      },
    ])
    taramayiSifirla()
  }

  function satiriSil(anahtar: number) {
    setSepet((s) => s.filter((k) => k.anahtar !== anahtar))
  }

  const satirlar = sepet.map((k) => ({
    ...k,
    hesap: kalemHesapla(k),
  }))
  const genelToplam = satirlar.reduce((t, s) => t + s.hesap.toplam, 0)
  const kasaLazim = (KASALI_ODEME_SEKILLERI as readonly string[]).includes(odemeSekli)
  const kagitLazim = kagitGerektirir(odemeSekli)
  const posGorunur = posAlanlariGorunur(odemeSekli)

  return (
    <form
      ref={formRef}
      onSubmit={(olay) => formGonderimi(olay, gonder)}
      className="flex flex-col gap-4 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          taramayiSifirla()
        }
      }}
    >
      <input type="hidden" name="cariId" value={cari?.id ?? ""} />
      <input type="hidden" name="kalemler" value={JSON.stringify(sepet)} />

      <div className="[&>*]:min-w-0 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          {/* 1) Barkod okuma satırı */}
          <div className="panel p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="form-alani min-w-[18rem] flex-1">
                <label htmlFor="barkod" className="form-etiket">
                  1) Barkod / Stok kodu okut
                </label>
                <div className="relative">
                  <Barcode
                    className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    id="barkod"
                    ref={barkodRef}
                    autoComplete="off"
                    placeholder="Barkodu okutun veya kod yazıp Enter'a basın"
                    className="h-10 w-full rounded-sm border border-input bg-background pl-8 pr-2 font-mono text-[0.875rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    onKeyDown={(e) => {
                      if (adaylar.length) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault()
                          setVurgulu((d) => (d + 1) % adaylar.length)
                          return
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault()
                          setVurgulu((d) => (d - 1 + adaylar.length) % adaylar.length)
                          return
                        }
                        if (e.key === "Enter") {
                          e.preventDefault()
                          parcayiSec(adaylar[vurgulu])
                          return
                        }
                      }
                      if (e.key === "Enter") {
                        e.preventDefault()
                        oku()
                      }
                    }}
                  />
                </div>
              </div>

              <div className="form-alani w-24">
                <label htmlFor="adet" className="form-etiket">
                  2) Adet
                </label>
                <input
                  id="adet"
                  ref={adetRef}
                  value={adet}
                  disabled={!secilen}
                  inputMode="decimal"
                  onChange={(e) => setAdet(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      sepeteEkle()
                    }
                  }}
                  className="h-10 w-full rounded-sm border border-input bg-background px-2 text-right text-[0.875rem] tabular-nums shadow-xs outline-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                />
              </div>

              <div className="form-alani w-32">
                <label htmlFor="fiyat" className="form-etiket">
                  Birim fiyat
                </label>
                <input
                  id="fiyat"
                  value={fiyat}
                  disabled={!secilen}
                  inputMode="decimal"
                  onChange={(e) => setFiyat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      sepeteEkle()
                    }
                  }}
                  className="h-10 w-full rounded-sm border border-input bg-background px-2 text-right text-[0.875rem] tabular-nums shadow-xs outline-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                />
              </div>

              <Button type="button" size="sm" className="h-10" disabled={!secilen} onClick={sepeteEkle}>
                <ShoppingCart className="size-4" aria-hidden />
                Sepete Ekle
              </Button>
              {secilen ? (
                <Button type="button" size="sm" variant="ghost" className="h-10" onClick={taramayiSifirla}>
                  <X className="size-4" aria-hidden />
                  Vazgeç (Esc)
                </Button>
              ) : null}
            </div>

            {secilen ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-sm bg-muted/50 px-3 py-2 text-[0.8125rem]">
                <span className="font-mono text-[0.75rem] text-muted-foreground">{secilen.kod}</span>
                <span className="font-medium">{secilen.ad}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    secilen.stokta <= 0 ? "text-tehlike" : "text-muted-foreground"
                  )}
                >
                  Stok: {miktarBicim(secilen.stokta)} {secilen.birim.toLowerCase()}
                </span>
                <span className="text-muted-foreground">KDV {yuzde(secilen.kdvOrani)}</span>
              </div>
            ) : null}

            {bulunamadi ? (
              <p className="mt-2 rounded-sm bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
                &quot;{bulunamadi}&quot; için stok kartı bulunamadı.
              </p>
            ) : null}

            {adaylar.length ? (
              <div className="mt-2 rounded-sm border border-border">
                <p className="border-b border-border px-3 py-1.5 text-[0.75rem] text-muted-foreground">
                  {adaylar.length} eşleşme — ↑ ↓ ile gezip Enter&apos;a basın
                </p>
                <ul className="max-h-64 overflow-auto">
                  {adaylar.map((a, sira) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setVurgulu(sira)}
                        onClick={() => parcayiSec(a)}
                        aria-current={sira === vurgulu}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-1.5 text-left text-[0.8125rem]",
                          sira === vurgulu ? "bg-muted" : "hover:bg-muted"
                        )}
                      >
                        <span className="w-28 shrink-0 font-mono text-[0.75rem] text-muted-foreground">
                          {a.kod}
                        </span>
                        <span className="flex-1 truncate">{a.ad}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {miktarBicim(a.stokta)} {a.birim.toLowerCase()}
                        </span>
                        <span className="w-24 text-right tabular-nums">{para(a.fiyat)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Sepet */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-[0.8125rem] font-semibold">
                Sepet
                <span className="ml-2 font-normal text-muted-foreground">{sepet.length} satır</span>
              </h2>
              <span className="text-[0.9375rem] font-semibold tabular-nums">{para(genelToplam)}</span>
            </div>

            {satirlar.length === 0 ? (
              <p className="px-3 py-10 text-center text-[0.8125rem] text-muted-foreground">
                Sepet boş — barkod okutarak başlayın.
              </p>
            ) : (
              <div className="max-h-[calc(100svh-30rem)] overflow-auto">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Stok Kodu</th>
                      <th>Ürün</th>
                      <th className="text-right">Adet</th>
                      <th className="text-right">Birim Fiyat</th>
                      <th className="text-right">Toplam</th>
                      <th className="text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((s) => (
                      <tr key={s.anahtar}>
                        <td className="font-mono text-[0.75rem]">{s.kod ?? "—"}</td>
                        <td className="max-w-[20rem] truncate font-medium">{s.aciklama}</td>
                        <td className="text-right tabular-nums">
                          {miktarBicim(s.miktar)} {s.birim.toLowerCase()}
                        </td>
                        <td className="text-right tabular-nums">{para(s.birimFiyat)}</td>
                        <td className="text-right font-medium tabular-nums">{para(s.hesap.toplam)}</td>
                        <td className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => satiriSil(s.anahtar)}
                            className="text-tehlike hover:text-tehlike"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sağ panel: cari + tahsilat */}
        <div className="flex flex-col gap-4">
          <div className="panel p-3">
            <CariSecici secili={cari} onSec={setCari} />
            {/* KARA LİSTE UYARISI (SA-2 / 2.5) — engellemez, uyarır. */}
            {cari?.karaListe ? (
              <div className="mt-2 rounded-md border border-tehlike/40 bg-tehlike-yumusak px-2.5 py-2 text-[0.75rem] text-tehlike">
                <span className="font-semibold">⚠ Bu cari kara listede</span>
                {cari.karaListeNedeni ? (
                  <span className="block whitespace-pre-wrap">Sebep: {cari.karaListeNedeni}</span>
                ) : null}
              </div>
            ) : null}
            <p className="mt-2 text-[0.75rem] text-muted-foreground">
              Boş bırakılırsa satış &quot;Perakende Müşteri&quot; carisine yazılır.
            </p>
          </div>

          <div className="panel p-3">
            <h2 className="mb-3 text-[0.8125rem] font-semibold">Tahsilat</h2>
            <div className="flex flex-col gap-3">
              <div className="form-alani">
                <label htmlFor="odemeSekli" className="form-etiket zorunlu-alan">
                  Ödeme Şekli
                </label>
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
              </div>

              {kasaLazim ? (
                <div className="form-alani">
                  <label htmlFor="kasaId" className="form-etiket zorunlu-alan">
                    Kasa
                  </label>
                  <select id="kasaId" name="kasaId" defaultValue="" className={ALAN_SINIFI}>
                    <option value="">— seçin —</option>
                    {kasalar.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.ad} ({para(k.bakiye)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="rounded-sm border border-border bg-muted/40 px-2 py-1.5 text-[0.75rem] text-muted-foreground">
                  {odemeSekli === "MAHSUP"
                    ? "Mahsup para hareketi değildir, kasaya işlenmez."
                    : "Çek / senet kasaya ancak tahsil edildiğinde girer."}
                </p>
              )}

              {kagitLazim ? (
                <>
                  <div className="form-alani">
                    <label htmlFor="cekVadeTarihi" className="form-etiket zorunlu-alan">
                      Vade Tarihi
                    </label>
                    <input
                      id="cekVadeTarihi"
                      name="cekVadeTarihi"
                      type="date"
                      className={ALAN_SINIFI}
                    />
                  </div>
                  <div className="form-alani">
                    <label htmlFor="cekBelgeNo" className="form-etiket">
                      {odemeSekli === "SENET" ? "Senet Seri No" : "Çek No"}
                    </label>
                    <input id="cekBelgeNo" name="cekBelgeNo" maxLength={50} className={cn(ALAN_SINIFI, "font-mono")} />
                  </div>
                  <div className="form-alani">
                    <label htmlFor="cekBanka" className="form-etiket">
                      Banka
                    </label>
                    <input id="cekBanka" name="cekBanka" maxLength={100} className={ALAN_SINIFI} />
                  </div>
                  <div className="form-alani">
                    <label htmlFor="cekBorclu" className="form-etiket">
                      Keşideci / Borçlu
                    </label>
                    <input id="cekBorclu" name="cekBorclu" maxLength={200} className={ALAN_SINIFI} />
                  </div>
                </>
              ) : null}

              {posGorunur ? (
                <>
                  <p className="-mb-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                    Sanal POS — dekonttan elle girilir
                  </p>
                  <div className="form-alani">
                    <label htmlFor="posBanka" className="form-etiket">
                      Banka / POS
                    </label>
                    <input id="posBanka" name="posBanka" maxLength={100} className={ALAN_SINIFI} />
                  </div>
                  <div className="form-alani">
                    <label htmlFor="posSon4" className="form-etiket">
                      Kart Son 4 Hane
                    </label>
                    <input
                      id="posSon4"
                      name="posSon4"
                      maxLength={4}
                      inputMode="numeric"
                      placeholder="1234"
                      className={cn(ALAN_SINIFI, "font-mono")}
                    />
                  </div>
                  <div className="form-alani">
                    <label htmlFor="posProvizyon" className="form-etiket">
                      Provizyon / Onay Kodu
                    </label>
                    <input
                      id="posProvizyon"
                      name="posProvizyon"
                      maxLength={50}
                      className={cn(ALAN_SINIFI, "font-mono")}
                    />
                  </div>
                  <div className="form-alani">
                    <label htmlFor="posTaksit" className="form-etiket">
                      Taksit
                    </label>
                    <input
                      id="posTaksit"
                      name="posTaksit"
                      inputMode="numeric"
                      placeholder="1"
                      className={cn(ALAN_SINIFI, "font-mono")}
                    />
                  </div>
                </>
              ) : null}

              <div className="form-alani">
                <label htmlFor="aciklama" className="form-etiket">
                  Açıklama
                </label>
                <textarea id="aciklama" name="aciklama" rows={2} maxLength={500} className={ALAN_SINIFI} />
              </div>
            </div>
          </div>

          {durum.hata ? (
            <div className="flex items-center gap-1.5 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {durum.hata}
            </div>
          ) : null}

          <Button type="submit" size="lg" disabled={bekliyor || sepet.length === 0 || ariyorMu}>
            {bekliyor ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {bekliyor
              ? "Tamamlanıyor…"
              : `Satışı Tamamla — ${para(genelToplam)}`}
          </Button>
        </div>
      </div>
    </form>
  )
}

function CariSecici({
  secili,
  onSec,
}: {
  secili: CariAdayi | null
  onSec: (c: CariAdayi | null) => void
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
        <span className="form-etiket">Müşteri</span>
        <div className="flex h-9 items-center justify-between gap-2 rounded-sm border border-input bg-muted/40 px-2 text-[0.8125rem]">
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
      <label htmlFor="cariArama" className="form-etiket">
        Müşteri (opsiyonel)
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
          placeholder="Perakende — boş bırakılabilir"
          autoComplete="off"
          className={cn(ALAN_SINIFI, "pl-7")}
        />
      </div>
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
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const ALAN_SINIFI =
  "h-9 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"
