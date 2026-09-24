"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Barcode, Loader2, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"

import {
  parcaCikisGeriAl,
  parcaCikisYap,
  parcaOkuAction,
} from "@/app/(panel)/servis/parca-cikis/actions"
import type {
  BulunanParca,
  CikilanParca,
  CikisKabulu,
} from "@/app/(panel)/servis/parca-cikis/veri"
import { Button } from "@/components/ui/button"
import { miktar as miktarBicim, para, yuzde } from "@/lib/bicim"
import { kalemHesapla } from "@/lib/hesap"
import { metniSayiyaCevir } from "@/lib/sayi"
import { cn } from "@/lib/utils"

/**
 * HIZLI PARÇA ÇIKIŞI — depocunun ekranı
 *
 * Tasarımın tek amacı var: mouse'a dokunmadan çalışmak.
 *   barkod oku → Enter → (parça bulundu) → adet yaz → Enter → satır düştü
 * Her satırdan sonra odak kendiliğinden barkod kutusuna döner; ekranın
 * neresinde olursanız olun Esc seçimi iptal edip odağı geri alır.
 *
 * Stok yetersizken satır sessizce yazılmaz: sunucu "uyarı" döner, aynı
 * Enter bir kez daha basılınca onaylanmış sayılır (Selpar da çıkışı
 * engellemiyor, çünkü parça fiziken gelmiş ama girişi yapılmamış olabilir).
 */

export function HizliCikis({
  kabul,
  parcalar,
  duzenlenebilir,
}: {
  kabul: CikisKabulu
  parcalar: CikilanParca[]
  duzenlenebilir: boolean
}) {
  const router = useRouter()
  const [bekliyor, basla] = useTransition()

  const [secilen, setSecilen] = useState<BulunanParca | null>(null)
  const [adaylar, setAdaylar] = useState<BulunanParca[]>([])
  /** Aday listesinde ok tuşlarıyla gezilen satır. */
  const [vurgulu, setVurgulu] = useState(0)
  const [adet, setAdet] = useState("1")
  const [fiyat, setFiyat] = useState("")
  const [garantili, setGarantili] = useState(false)
  const [uyari, setUyari] = useState<string | null>(null)
  const [bulunamadi, setBulunamadi] = useState<string | null>(null)

  const barkodRef = useRef<HTMLInputElement>(null)
  const adetRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    barkodRef.current?.focus()
  }, [])

  /**
   * Parça seçilir seçilmez odak adet kutusuna geçer ve içerik seçili gelir
   * (barkod arka arkaya okunurken "1" üzerine yazmak tek tuş olsun).
   *
   * Bu iş `parcayiSec` içinde setTimeout ile yapılamıyor: seçim bir
   * `startTransition` içinde oluştuğu için adet kutusu o an hâlâ `disabled`
   * olabiliyor ve odak sessizce barkod kutusunda kalıyordu. Efekt ise
   * render tamamlandıktan sonra çalışır.
   */
  useEffect(() => {
    if (!secilen) return
    adetRef.current?.focus()
    adetRef.current?.select()
  }, [secilen])

  function bastanBasla() {
    setSecilen(null)
    setAdaylar([])
    setVurgulu(0)
    setAdet("1")
    setFiyat("")
    setGarantili(false)
    setUyari(null)
    setBulunamadi(null)
    if (barkodRef.current) barkodRef.current.value = ""
    barkodRef.current?.focus()
  }

  function parcayiSec(p: BulunanParca) {
    setSecilen(p)
    setAdaylar([])
    setVurgulu(0)
    setUyari(null)
    setBulunamadi(null)
    setFiyat(String(p.fiyat).replace(".", ","))
    setAdet("1")
  }

  function oku() {
    const metin = barkodRef.current?.value.trim() ?? ""
    if (metin.length < 2) return
    setBulunamadi(null)

    basla(async () => {
      const sonuc = await parcaOkuAction(metin)
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

  function gonder(onayli: boolean) {
    if (!secilen) return
    const veri = new FormData()
    veri.set("kabulId", String(kabul.id))
    veri.set("stokId", String(secilen.id))
    veri.set("miktar", adet)
    veri.set("birimFiyat", fiyat)
    if (garantili) veri.set("garantili", "on")
    if (onayli) veri.set("stokUyarisiOnaylandi", "on")

    basla(async () => {
      const sonuc = await parcaCikisYap(veri)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      if (sonuc.uyari) {
        setUyari(sonuc.uyari)
        adetRef.current?.focus()
        return
      }
      toast.success(sonuc.basari ?? "Satır eklendi.")
      bastanBasla()
      router.refresh()
    })
  }

  function geriAl(kalem: CikilanParca) {
    if (!confirm(`"${kalem.aciklama}" satırı geri alınsın mı? Stok iade edilir.`)) return
    basla(async () => {
      const sonuc = await parcaCikisGeriAl(kalem.id, kabul.id)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
      } else {
        toast.success("Satır geri alındı, stok iade edildi.")
        router.refresh()
      }
      barkodRef.current?.focus()
    })
  }

  const onizleme = secilen
    ? kalemHesapla(
        {
          miktar: metniSayiyaCevir(adet) || 0,
          birimFiyat: metniSayiyaCevir(fiyat) || 0,
          kdvOrani: secilen.kdvOrani,
        },
        kabul.kdvDahilGirilir
      )
    : null

  const toplamCikis = parcalar.reduce((t, p) => t + p.toplam, 0)

  return (
    <div
      className="flex flex-col gap-4 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          bastanBasla()
        }
      }}
    >
      {duzenlenebilir ? (
        <div className="panel p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="form-alani min-w-[20rem] flex-1">
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
                    // Aday listesi açıkken odak barkod kutusunda KALIR;
                    // liste ok tuşlarıyla gezilir, Enter seçer. Odağı listeye
                    // taşımak, barkod okuyucunun bir sonraki okumasını yanlış
                    // yere yazma riski doğuruyordu.
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
                onChange={(e) => {
                  setAdet(e.target.value)
                  setUyari(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    gonder(uyari !== null)
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
                    gonder(uyari !== null)
                  }
                }}
                className="h-10 w-full rounded-sm border border-input bg-background px-2 text-right text-[0.875rem] tabular-nums shadow-xs outline-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              />
            </div>

            <label className="flex h-10 items-center gap-1.5 text-[0.8125rem]">
              <input
                type="checkbox"
                checked={garantili}
                disabled={!secilen}
                onChange={(e) => setGarantili(e.target.checked)}
                className="size-3.5"
              />
              Garantili
            </label>

            <Button
              size="sm"
              className="h-10"
              disabled={!secilen || bekliyor}
              onClick={() => gonder(uyari !== null)}
            >
              {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {uyari ? "Yine de Çık" : "Kabule Ekle"}
            </Button>
            {secilen ? (
              <Button size="sm" variant="ghost" className="h-10" onClick={bastanBasla}>
                <X className="size-4" aria-hidden />
                Vazgeç (Esc)
              </Button>
            ) : null}
          </div>

          {secilen ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-sm bg-muted/50 px-3 py-2 text-[0.8125rem]">
              <span className="font-mono text-[0.75rem] text-muted-foreground">
                {secilen.kod}
              </span>
              <span className="font-medium">{secilen.ad}</span>
              {secilen.rafYeri ? (
                <span className="text-muted-foreground">Raf: {secilen.rafYeri}</span>
              ) : null}
              <span
                className={cn(
                  "tabular-nums",
                  secilen.stokta <= 0 ? "text-tehlike" : "text-muted-foreground"
                )}
              >
                Stok: {miktarBicim(secilen.stokta)} {secilen.birim.toLowerCase()}
              </span>
              <span className="text-muted-foreground">KDV {yuzde(secilen.kdvOrani)}</span>
              {onizleme ? (
                <span className="ml-auto font-medium tabular-nums">
                  Satır toplamı: {para(onizleme.toplam)}
                </span>
              ) : null}
            </div>
          ) : null}

          {uyari ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-sm bg-uyari-yumusak px-3 py-2 text-[0.8125rem] text-uyari">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {uyari} — onaylamak için Enter&apos;a tekrar basın.
            </p>
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
      ) : (
        <p className="panel px-3 py-2 text-[0.8125rem] text-muted-foreground">
          Bu kart teslim edilmiş; parça çıkışı yapılamaz. Satırlar salt okunur.
        </p>
      )}

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[0.8125rem] font-semibold">
            Bu kabule çıkılan parçalar
            <span className="ml-2 font-normal text-muted-foreground">
              {parcalar.length} satır
            </span>
          </h2>
          <span className="text-[0.8125rem] font-medium tabular-nums">
            Toplam {para(toplamCikis)}
          </span>
        </div>

        {parcalar.length === 0 ? (
          <p className="px-3 py-10 text-center text-[0.8125rem] text-muted-foreground">
            Henüz parça çıkılmadı.
          </p>
        ) : (
          <div className="max-h-[calc(100svh-24rem)] overflow-auto">
            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Stok Kodu</th>
                  <th>Parça</th>
                  <th className="text-right">Adet</th>
                  <th className="text-right">Birim Fiyat</th>
                  <th className="text-right">KDV %</th>
                  <th className="text-right">Toplam</th>
                  <th>Garanti</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {parcalar.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-[0.75rem]">{p.stokKodu ?? "—"}</td>
                    <td className="max-w-[24rem] truncate font-medium">{p.aciklama}</td>
                    <td className="text-right tabular-nums">
                      {miktarBicim(p.miktar)} {p.birim.toLowerCase()}
                    </td>
                    <td className="text-right tabular-nums">{para(p.birimFiyat)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {miktarBicim(p.kdvOrani)}
                    </td>
                    <td className="text-right font-medium tabular-nums">{para(p.toplam)}</td>
                    <td className="text-[0.75rem] text-muted-foreground">
                      {p.garantili ? "Garantili" : "—"}
                    </td>
                    <td className="text-right">
                      {duzenlenebilir ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={bekliyor}
                          onClick={() => geriAl(p)}
                          className="text-tehlike hover:text-tehlike"
                        >
                          <RotateCcw className="size-4" aria-hidden />
                          Geri Al
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
