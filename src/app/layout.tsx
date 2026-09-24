import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"
import { MARKA } from "@/config/marka"

import "./globals.css"

/**
 * IBM Plex — teknik/kurumsal karakterli, Türkçe karakterleri (ş ğ ı İ ç ö ü)
 * eksiksiz destekleyen bir aile. Mono sürümü plaka, kod ve tutar gibi
 * hizalanması gereken alanlarda kullanılıyor.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: MARKA.ad,
    template: `%s · ${MARKA.ad}`,
  },
  description: MARKA.slogan,
  // Kapalı/özel bir sistem: arama motorlarına ASLA düşmesin.
  robots: { index: false, follow: false, nocache: true },
}

export const viewport: Viewport = {
  themeColor: "#1c2b3a",
  width: "device-width",
  initialScale: 1,
  // Çentikli telefonlarda `env(safe-area-inset-*)` ancak bununla dolar;
  // mobil menü çekmecesinin alt payı buna bağlı (bkz. yan-menu.tsx).
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} antialiased`}
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
