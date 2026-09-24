"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import {
  ANA_SAYFA,
  MENU,
  araBaslikMi,
  type MenuBaglantisi,
  type MenuGrubu,
  type MenuOgesi,
} from "@/config/menu"
import { MARKA } from "@/config/marka"
import { FirmaLogosu } from "@/components/firma-logosu"
import { GezinmeIsareti } from "./ust-ilerleme-cubugu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useMenuDurum } from "./menu-durum"
import { cn } from "@/lib/utils"
import type { Modul } from "@/lib/yetki"

const DARALTMA_ANAHTARI = "servis-pro.menu-daraltildi"

/**
 * MENÜYÜ YETKİYE GÖRE SÜZ (ADIM 12.3)
 *
 * 12.3 öncesinde süzme GRUP düzeyindeydi (`MENU.filter(g => izinli(g.modul))`)
 * ve bağlantıların kendi `modul` alanı hiç okunmuyordu. "Satış / Evrak" gibi
 * birden çok modül barındıran gruplar geldiği için süzme BAĞLANTI düzeyine
 * indi:
 *  - bağlantı, kendi modülüne izin yoksa düşer
 *  - ara başlık, altında tek bir bağlantı bile kalmadıysa düşer
 *  - hiç bağlantısı kalmayan grup hiç çizilmez
 */
function yetkiyeGoreSuz(izinliModuller: Modul[]): MenuGrubu[] {
  const gruplar: MenuGrubu[] = []

  for (const grup of MENU) {
    const kalanlar: MenuOgesi[] = []

    for (const oge of grup.ogeler) {
      if (araBaslikMi(oge)) {
        // Bir önceki ara başlığın altı boş kaldıysa onu geri al.
        const sonuncu = kalanlar[kalanlar.length - 1]
        if (sonuncu && araBaslikMi(sonuncu)) kalanlar.pop()
        kalanlar.push(oge)
        continue
      }
      if (izinliModuller.includes(oge.modul)) kalanlar.push(oge)
    }

    // Sondaki ara başlığın altı boş kalmış olabilir.
    const sonuncu = kalanlar[kalanlar.length - 1]
    if (sonuncu && araBaslikMi(sonuncu)) kalanlar.pop()

    if (kalanlar.length > 0) gruplar.push({ ...grup, ogeler: kalanlar })
  }

  return gruplar
}

/** Gruptaki tıklanabilir bağlantılar (ara başlıklar hariç). */
function baglantilari(grup: MenuGrubu): MenuBaglantisi[] {
  return grup.ogeler.filter((o): o is MenuBaglantisi => !araBaslikMi(o))
}

/**
 * Menünün dar/geniş tercihi tarayıcıda saklanır ki kullanıcı her girişte
 * aynı düzeni bulsun. localStorage React'in dışında bir kaynak olduğu için
 * `useSyncExternalStore` ile okunuyor — sunucuda çizilirken varsayılan
 * (geniş) hâli kullanılır, böylece hydration uyuşmazlığı olmaz.
 */
const daraltmaDeposu = {
  dinleyiciler: new Set<() => void>(),
  abone(dinleyici: () => void) {
    daraltmaDeposu.dinleyiciler.add(dinleyici)
    return () => daraltmaDeposu.dinleyiciler.delete(dinleyici)
  },
  oku() {
    return localStorage.getItem(DARALTMA_ANAHTARI) === "1"
  },
  sunucuDegeri() {
    return false
  },
  yaz(deger: boolean) {
    localStorage.setItem(DARALTMA_ANAHTARI, deger ? "1" : "0")
    daraltmaDeposu.dinleyiciler.forEach((d) => d())
  },
}

type Props = {
  /** Kullanıcının görebileceği modüller — yetkisi olmayan grup menüde hiç görünmez. */
  izinliModuller: Modul[]
  sayaclar?: Partial<Record<"acikOnarim" | "teslimBekleyen", number>>
  /** Ayarlar > Firma'dan yüklenmiş logo (base64). Yoksa yerleşik işaret. */
  firmaLogo?: string | null
}

/**
 * Sol menü iki yerde birden çiziliyor:
 *  - md ÜSTÜ: sayfanın solunda duran sabit `aside` (daraltılabilir)
 *  - md ALTI: hamburger ile açılan çekmece (Sheet)
 * İçerik tek bileşen (`MenuIcerik`), sadece kabuğu değişiyor. Çekmecede
 * "daraltıldı" tercihi geçerli değil — telefonda zaten tam genişlik açılıyor.
 */
export function YanMenu({ izinliModuller, sayaclar, firmaLogo }: Props) {
  const { acik, kapat } = useMenuDurum()
  const daraltildi = useSyncExternalStore(
    daraltmaDeposu.abone,
    daraltmaDeposu.oku,
    daraltmaDeposu.sunucuDegeri
  )

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          daraltildi ? "w-[3.75rem]" : "w-60"
        )}
      >
        <MenuIcerik
          izinliModuller={izinliModuller}
          sayaclar={sayaclar}
          firmaLogo={firmaLogo}
          daraltildi={daraltildi}
        />
        <button
          type="button"
          onClick={() => daraltmaDeposu.yaz(!daraltildi)}
          className="flex items-center gap-2.5 border-t border-sidebar-border px-4 py-2.5 text-[0.75rem] text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          {daraltildi ? (
            <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
              <span>Menüyü daralt</span>
            </>
          )}
        </button>
      </aside>

      {/* Mobil çekmece: karartmaya tıklayınca ve Esc ile kapanır (Sheet'in
          kendi davranışı), bağlantıya tıklayınca `kapat` ile kapatıyoruz. */}
      <Sheet open={acik} onOpenChange={(a) => !a && kapat()}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="h-svh max-h-svh w-[17rem] gap-0 overflow-hidden border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-[17rem] md:hidden"
        >
          <SheetTitle className="sr-only">Ana menü</SheetTitle>
          <MenuIcerik
            izinliModuller={izinliModuller}
            sayaclar={sayaclar}
            firmaLogo={firmaLogo}
            daraltildi={false}
            onGezinme={kapat}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

function MenuIcerik({
  izinliModuller,
  sayaclar,
  firmaLogo,
  daraltildi,
  onGezinme,
}: Props & { daraltildi: boolean; onGezinme?: () => void }) {
  const yol = usePathname()
  const sorgu = useSearchParams()

  /**
   * Grubun açık/kapalı olması iki şeyden gelir:
   *  - varsayılan: aktif sayfanın grubu açıktır
   *  - kullanıcı tıklarsa tercihi bu varsayılanı ezer
   * Bu yüzden state'te sadece "elle değiştirilenler" tutuluyor.
   */
  const [elleAyarlanan, setElleAyarlanan] = useState<Record<string, boolean>>({})

  // Daraltılmış moddaki açılır panelin (flyout) dışarı tıklanınca kapanması
  // için nav'ın DOM düğümü gerekiyor.
  const navRef = useRef<HTMLElement>(null)

  const gruplar = useMemo(() => yetkiyeGoreSuz(izinliModuller), [izinliModuller])

  /**
   * DARALTILMIŞ MODDA DIŞARI TIKLAYINCA FLYOUT KAPANSIN (SA-2 / 2.1)
   *
   * Geniş menüde grup açıklığı sayfada kalıcıdır (birden çok grup elle açık
   * durabilir); orada bu dinleyici çalışmaz. Daraltılmış modda ise flyout
   * ekranın üstüne taşan geçici bir panel — menü dışına tıklanınca kapanmalı.
   */
  useEffect(() => {
    if (!daraltildi) return
    if (!Object.values(elleAyarlanan).some(Boolean)) return
    function disariTikla(olay: MouseEvent) {
      if (navRef.current && !navRef.current.contains(olay.target as Node)) {
        setElleAyarlanan({})
      }
    }
    document.addEventListener("mousedown", disariTikla)
    return () => document.removeEventListener("mousedown", disariTikla)
  }, [daraltildi, elleAyarlanan])

  /**
   * AKTİF BAĞLANTI — en spesifik eşleşme kazanır.
   *
   * Eskiden her bağlantı için `yol.startsWith(hedef + "/")` bakılıyordu; bu
   * yüzden /cari/mizan'dayken hem "Cari Devir ve Bakiye" hem de "Cari Listesi"
   * (/cari) vurgulu geliyordu. Artık önce menüdeki EN UZUN eşleşen yol
   * bulunuyor, vurgu yalnızca ona veriliyor.
   *
   * Sorgulu maddeler (/personel?durum=ayrilan) sorgusuyla birlikte
   * karşılaştırılıyor: durum=ayrilan iken "İşten Ayrılanlar", aksi hâlde
   * "Personel Listesi" vurgulanır.
   */
  const aktifYol = useMemo(() => {
    let enIyi = ""
    for (const grup of gruplar) {
      for (const oge of grup.ogeler) {
        if (araBaslikMi(oge)) continue
        const [taban, sorguMetni] = oge.yol.split("?")
        if (yol !== taban && !yol.startsWith(taban + "/")) continue
        if (
          sorguMetni &&
          !sorguMetni.split("&").every((ikili) => {
            const [anahtar, deger] = ikili.split("=")
            return sorgu.get(anahtar) === deger
          })
        ) {
          continue
        }
        if (oge.yol.length > enIyi.length) enIyi = oge.yol
      }
    }
    return enIyi
  }, [gruplar, yol, sorgu])

  const aktifMi = (hedef: string) => hedef === aktifYol

  function grubuDegistir(ad: string, suAnAcik: boolean) {
    setElleAyarlanan((onceki) => {
      // Daraltılmış modda aynı anda TEK flyout açık olsun: tıklanan grup
      // açılır, diğer grupların elle açıklığı sıfırlanır. Geniş menüde eski
      // davranış korunur — birden çok grup elle açık durabilir.
      if (daraltildi) {
        return suAnAcik ? {} : { [ad]: true }
      }
      return { ...onceki, [ad]: !suAnAcik }
    })
  }

  return (
    <>
      {/* Marka */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3">
        <FirmaLogosu
          logo={firmaLogo}
          className="size-7 shrink-0 text-sidebar-primary"
        />
        {!daraltildi && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[0.9375rem] font-bold text-white">
              {MARKA.ad}
            </div>
            <div className="truncate text-[0.6875rem] text-sidebar-foreground/60">
              v{MARKA.surum}
            </div>
          </div>
        )}
      </div>

      {/* Daraltılmışken açılır panel (flyout) menünün dışına taşar; bu yüzden
          o hâlde `overflow` kapatılıyor — 10 ikon zaten dikey scroll istemez. */}
      <nav
        ref={navRef}
        className={cn(
          // `min-h-0` ŞART: flex öğesinin varsayılan `min-height:auto`
          // değeri yüzünden nav içeriği kadar uzuyor, `overflow-y-auto` hiç
          // devreye girmiyordu. Mobil çekmecede bunun sonucu "alttaki
          // gruplara (Ayarlar, Raporlar) basılamıyor" idi.
          // `pb-[env(safe-area-inset-bottom)]` iOS alt çentiğinin son
          // bağlantıyı yutmasını engeller (layout.tsx'te viewportFit:"cover").
          "min-h-0 flex-1 px-2 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
          daraltildi ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
        )}
      >
        <AnaBaglanti
          daraltildi={daraltildi}
          aktif={yol === "/"}
          onGezinme={onGezinme}
        />

        <div className="mt-1.5 space-y-0.5">
          {gruplar.map((grup) => {
            const icindeAktif = baglantilari(grup).some((b) => aktifMi(b.yol))
            // Geniş menüde aktif sayfanın grubu kendiliğinden açık gelir.
            // Daraltılmışken bu açılır panel demek olurdu; orada varsayılan
            // kapalı, panel yalnızca ikona tıklanınca açılır.
            const acik = daraltildi
              ? (elleAyarlanan[grup.ad] ?? false)
              : (elleAyarlanan[grup.ad] ?? icindeAktif)
            const Ikon = grup.ikon

            return (
              <div
                key={grup.ad}
                className="relative"
                // Daraltılmış moddaki açılır panel fareyle ÜZERİNDEN AYRILINCA
                // KAPANMAZ (İsmet isteği: "basınca açılsın, mouse kaydırınca
                // kaybolmasın"). Kapanış: aynı ikona tekrar tıkla, başka gruba
                // tıkla (tek panel), menü dışına tıkla (disariTikla efekti) ya
                // da içindeki bir bağlantıya git.
              >
                <button
                  type="button"
                  onClick={() => grubuDegistir(grup.ad, acik)}
                  title={daraltildi ? grup.ad : undefined}
                  aria-expanded={acik}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[1rem] font-medium transition-colors",
                    icindeAktif
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Ikon className="size-[1.125rem] shrink-0" aria-hidden />
                  {!daraltildi && (
                    <>
                      <span className="flex-1 truncate text-left">{grup.ad}</span>
                      <ChevronDown
                        className={cn(
                          "size-3.5 shrink-0 opacity-60 transition-transform",
                          acik && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </>
                  )}
                </button>

                {acik && (
                  <ul
                    className={cn(
                      daraltildi
                        ? // Daraltılmışken ikonun sağında açılır panel: menü
                          // dar hâldeyken de gezinilebilsin diye.
                          "absolute left-full top-0 z-50 ml-1 max-h-[70svh] w-64 overflow-y-auto rounded-md border border-sidebar-border bg-sidebar p-1.5 shadow-xl"
                        : "mb-1 ml-[1.3125rem] mt-0.5 space-y-px border-l border-sidebar-border/80 pl-3"
                    )}
                  >
                    {daraltildi && (
                      <li className="border-b border-sidebar-border/70 px-2.5 pb-1.5 pt-1 text-[1rem] font-semibold text-sidebar-accent-foreground">
                        {grup.ad}
                      </li>
                    )}
                    {grup.ogeler.map((oge) => {
                      if (araBaslikMi(oge)) {
                        return (
                          <li
                            key={`ara:${oge.araBaslik}`}
                            className="px-2.5 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-sidebar-foreground/40 first:pt-1"
                          >
                            {oge.araBaslik}
                          </li>
                        )
                      }

                      const b = oge
                      const sayi = b.sayacAnahtari
                        ? sayaclar?.[b.sayacAnahtari]
                        : undefined

                      if (b.hazir === false) {
                        return (
                          <li key={b.yol}>
                            <span
                              className="flex cursor-not-allowed items-center justify-between gap-2 rounded px-2.5 py-1.5 text-[1rem] text-sidebar-foreground/35"
                              title="Bu ekran henüz hazır değil"
                            >
                              <span className="truncate">{b.ad}</span>
                              <span className="shrink-0 rounded-sm border border-sidebar-border px-1 py-px text-[0.625rem] uppercase tracking-wide">
                                yakında
                              </span>
                            </span>
                          </li>
                        )
                      }

                      return (
                        <li key={b.yol}>
                          <Link
                            href={b.yol}
                            // Menü grupları varsayılan kapalı; aynı anda tek
                            // grup açık, yani en fazla ~8 link görünür. Bunları
                            // tümüyle ön-getir (veri dahil) — grubu açtığın an
                            // linkler ısınır, tıklama anında ekran gelir.
                            prefetch
                            onClick={() => {
                              // Daraltılmış menüde açılır panel, tıklanan
                              // bağlantıdan sonra ekranın üstünde kalmasın.
                              if (daraltildi) grubuDegistir(grup.ad, true)
                              onGezinme?.()
                            }}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded px-2.5 py-2 text-[1rem] leading-5 transition-colors md:py-2",
                              aktifMi(b.yol)
                                ? "bg-sidebar-primary/15 font-medium text-sidebar-primary"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <GezinmeIsareti />
                            <span className="truncate">{b.ad}</span>
                            {sayi ? (
                              <span className="shrink-0 rounded-sm bg-sidebar-primary px-1.5 py-px text-[0.6875rem] font-semibold text-sidebar-primary-foreground">
                                {sayi}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </nav>
    </>
  )
}

function AnaBaglanti({
  daraltildi,
  aktif,
  onGezinme,
}: {
  daraltildi: boolean
  aktif: boolean
  onGezinme?: () => void
}) {
  const Ikon = ANA_SAYFA.ikon
  return (
    <Link
      href={ANA_SAYFA.yol}
      onClick={onGezinme}
      title={daraltildi ? ANA_SAYFA.ad : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded px-2.5 py-2 text-[1rem] font-medium transition-colors",
        aktif
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <GezinmeIsareti />
      <Ikon className="size-[1.125rem] shrink-0" aria-hidden />
      {!daraltildi && <span className="truncate">{ANA_SAYFA.ad}</span>}
    </Link>
  )
}
