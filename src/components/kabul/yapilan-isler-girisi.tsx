"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"

/**
 * SA-4.2 — "Yapılan İşler" etiket (chip) girişi.
 *
 * Selim abi: kutuya "yağ filtresi" yaz + Enter → etiket eklenir, imleç kutuda
 * kalır, "polen filtresi" + Enter → ikinci… Ard arda hızlı giriş.
 *
 * Veri modeli BİLİNÇLİ olarak sade tutuldu: etiketler ayrı tabloya/kaleme
 * yazılmıyor, mevcut `Kabul.yapilanIsler` metin alanına HER ETİKET BİR SATIR
 * olacak şekilde kaydediliyor (gizli input `\n` ile birleştirir). Böylece
 * migration gerekmedi ve kabul detayı / baskı / "Önceki Onarımlar" ekranları
 * bu alanı okumaya aynen devam ediyor. Faturadaki fiyatlı satırlar zaten
 * ustanın kalem tablosuna girdiği parça/işçilik kalemlerinden geliyor.
 *
 * Düzenlemede eski serbest metin (cümle de olabilir) `\n` ile bölünüp
 * etiketlere dönüşür; tek satırsa tek etiket olur, veri kaybı yok.
 */
export function YapilanIslerGirisi({
  name,
  defaultValue = "",
}: {
  name: string
  defaultValue?: string
}) {
  const [etiketler, setEtiketler] = useState<string[]>(() =>
    defaultValue
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const [taslak, setTaslak] = useState("")
  const girdiRef = useRef<HTMLInputElement>(null)

  function ekle(ham: string) {
    const yeni = ham.trim()
    if (!yeni) return
    // Aynı işi iki kez yazmak anlamsız; büyük/küçük harf duyarsız tekilleştir.
    if (etiketler.some((e) => e.toLocaleLowerCase("tr-TR") === yeni.toLocaleLowerCase("tr-TR"))) {
      setTaslak("")
      return
    }
    setEtiketler((o) => [...o, yeni])
    setTaslak("")
  }

  function sil(index: number) {
    setEtiketler((o) => o.filter((_, i) => i !== index))
    girdiRef.current?.focus()
  }

  function tusaBas(olay: React.KeyboardEvent<HTMLInputElement>) {
    if (olay.key === "Enter" || olay.key === ",") {
      // Enter formu göndermesin — sadece etiket eklesin, imleç kutuda kalsın.
      olay.preventDefault()
      ekle(taslak)
    } else if (olay.key === "Backspace" && taslak === "" && etiketler.length > 0) {
      setEtiketler((o) => o.slice(0, -1))
    }
  }

  return (
    <div
      className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-sm border border-input bg-background px-1.5 py-1 text-[0.8125rem] shadow-xs transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40"
      onClick={() => girdiRef.current?.focus()}
    >
      {/* Gizli alan: sunucu tarafı bu ismi okuyor (Kabul.yapilanIsler). */}
      <input type="hidden" name={name} value={etiketler.join("\n")} />

      {etiketler.map((etiket, i) => (
        <span
          key={`${etiket}-${i}`}
          className="inline-flex items-center gap-1 rounded-sm bg-primary/10 py-0.5 pl-2 pr-1 font-medium text-primary"
        >
          {etiket}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              sil(i)
            }}
            className="rounded-sm p-0.5 hover:bg-primary/20"
            aria-label={`"${etiket}" kaldır`}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}

      <input
        ref={girdiRef}
        type="text"
        value={taslak}
        onChange={(e) => setTaslak(e.target.value)}
        onKeyDown={tusaBas}
        onBlur={() => ekle(taslak)}
        placeholder={etiketler.length === 0 ? "İş yaz, Enter'a bas (örn: yağ filtresi)" : ""}
        className="min-w-[8rem] max-md:min-w-0 flex-1 bg-transparent px-1 py-0.5 outline-none"
      />
    </div>
  )
}
