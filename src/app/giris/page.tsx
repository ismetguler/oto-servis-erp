import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"

import { FirmaLogosu } from "@/components/firma-logosu"
import { MARKA } from "@/config/marka"
import { prisma } from "@/lib/prisma"
import { GirisFormu } from "./giris-formu"

export const metadata: Metadata = {
  title: "Giriş",
}

// Firma logosu DB'den okunuyor; her açılışta güncel gelsin (build'de sabitlenmesin).
export const dynamic = "force-dynamic"

/**
 * GİRİŞ EKRANI
 *
 * Sade iki sütun: solda marka kimliği (firma adı + logo büyük ve net),
 * sağda giriş kartı. Dar ekranda (md altı) sol sütun gizlenir, marka
 * kilidi kartın üstüne küçülerek taşınır — tek ekranda iki ayrı marka
 * bloğu görünmez. Yeni kütüphane yok, hepsi mevcut Tailwind + tema
 * değişkenleri (`--sidebar-*`) ile.
 */
export default async function GirisSayfasi() {
  const yil = new Date().getFullYear()
  const firma = await prisma.firma.findFirst({ select: { logo: true } })

  return (
    <main className="relative min-h-svh overflow-hidden bg-sidebar text-sidebar-foreground">
      {/* Zemin dokusu: atölye uyarı şeridi, çok düşük opaklıkta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 14px)",
          color: "var(--sidebar-primary)",
        }}
      />
      {/* Sol üstten gelen yumuşak ışık */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-48 size-[46rem] rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--sidebar-ring) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center px-5 py-10">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_25rem] md:gap-14">
          {/* --- Marka sütunu (geniş ekran) --- */}
          <section className="hidden md:block">
            <FirmaLogosu logo={firma?.logo} className="size-14 text-sidebar-primary" />
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white">
              {MARKA.ad}
            </h1>
            <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-sidebar-foreground/70">
              {MARKA.slogan}
            </p>
            <div
              aria-hidden
              className="mt-6 h-px w-24 bg-sidebar-primary/50"
            />
            <ul className="mt-6 space-y-2 text-[0.8125rem] text-sidebar-foreground/60">
              <li>Araç kabul · iş emri · parça çıkışı</li>
              <li>Cari · stok · fatura · tahsilat</li>
              <li>Raporlar ve baskı şablonları</li>
            </ul>
          </section>

          {/* --- Giriş kartı --- */}
          <div className="mx-auto w-full max-w-[25rem]">
            {/* Dar ekranda marka kilidi kartın üstünde */}
            <div className="mb-6 flex flex-col items-center gap-2.5 md:hidden">
              <FirmaLogosu logo={firma?.logo} className="size-11 text-sidebar-primary" />
              <div className="text-center">
                <h1 className="text-[1.375rem] font-bold tracking-tight text-white">
                  {MARKA.ad}
                </h1>
                <p className="text-[0.8125rem] text-sidebar-foreground/70">
                  {MARKA.slogan}
                </p>
              </div>
            </div>

            <div className="panel p-6 shadow-xl shadow-black/25">
              <div className="mb-5 border-b border-border pb-3">
                <h2 className="text-[0.9375rem] font-semibold">Sisteme Giriş</h2>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  Kullanıcı adınız ve şifrenizle giriş yapın.
                </p>
              </div>

              <GirisFormu />

              <p className="mt-5 flex items-start gap-1.5 border-t border-border pt-3.5 text-[0.75rem] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  Bu sistem yalnızca yetkili personelin kullanımı içindir. Tüm
                  işlemler kayıt altına alınır.
                </span>
              </p>
            </div>

            <p className="mt-5 text-center text-[0.75rem] text-sidebar-foreground/50">
              {MARKA.ad} v{MARKA.surum} · {yil}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
