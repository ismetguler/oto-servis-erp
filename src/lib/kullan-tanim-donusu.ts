"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * `TanimEkleTusu` ile tanım ekranına gidip dönüldüğünde (`?donusAlan=X&
 * donusDeger=Y`), bu form alanının yeni seçili değerini okur. Bir kere
 * okunduktan sonra adres çubuğundan temizlenir — sayfa içi başka bir
 * gezinmede tekrar uygulanmasın diye.
 */
export function useTanimDonusu(alan: string): string | null {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [deger] = useState<string | null>(() =>
    searchParams.get("donusAlan") === alan ? searchParams.get("donusDeger") : null
  )
  const temizlendi = useRef(false)

  useEffect(() => {
    if (deger === null || temizlendi.current) return
    temizlendi.current = true
    const yeni = new URLSearchParams(searchParams)
    yeni.delete("donusAlan")
    yeni.delete("donusDeger")
    const kalan = yeni.toString()
    router.replace(kalan ? `?${kalan}` : "?", { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return deger
}
