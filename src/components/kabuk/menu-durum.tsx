"use client"

import { createContext, useCallback, useContext, useState } from "react"

/**
 * MOBİL MENÜ DURUMU
 *
 * Hamburger düğmesi üst barda, çekmece ise sol menü bileşeninde duruyor —
 * ikisi kardeş bileşen olduğu için durumu ortak bir bağlamda (context)
 * tutuyoruz. Sadece md altında anlamlı; md üstünde çekmece hiç çizilmiyor,
 * menünün "daraltıldı" tercihi ondan tamamen ayrı çalışıyor.
 */

type MenuDurumu = {
  acik: boolean
  ac: () => void
  kapat: () => void
  degistir: () => void
}

const Baglam = createContext<MenuDurumu | null>(null)

export function MenuDurumSaglayici({ children }: { children: React.ReactNode }) {
  const [acik, setAcik] = useState(false)

  const ac = useCallback(() => setAcik(true), [])
  const kapat = useCallback(() => setAcik(false), [])
  const degistir = useCallback(() => setAcik((o) => !o), [])

  return (
    <Baglam.Provider value={{ acik, ac, kapat, degistir }}>
      {children}
    </Baglam.Provider>
  )
}

export function useMenuDurum() {
  const deger = useContext(Baglam)
  if (!deger) {
    throw new Error("useMenuDurum, MenuDurumSaglayici içinde kullanılmalı")
  }
  return deger
}
