"use client"

import { useTransition } from "react"
import Link from "next/link"
import { ArrowRightCircle, Printer, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  ekspertizDurumDegistir,
  ekspertizSil,
  kabuleDonustur,
} from "@/app/(panel)/servis/ekspertiz/actions"
import {
  EKSPERTIZ_DURUM_ETIKETI,
  EKSPERTIZ_DURUMLARI,
} from "@/app/(panel)/servis/ekspertiz/sema"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"

/**
 * Ekspertiz kartının durum / dönüştürme / silme düğmeleri.
 *
 * "Kabule Dönüştür" ayrı ve onaylı: basıldığı anda GERÇEK bir iş emri
 * açılıyor ve para akışı başlıyor. Ekspertizin kendisi hiçbir muhasebe
 * hareketi üretmiyordu; o sınır burada geçiliyor, kullanıcı ne yaptığını
 * bilerek geçmeli. İşlem geri alınamıyor (kart kilitleniyor), bu yüzden
 * onay sorusunda tutar da gösteriliyor.
 */
export function EkspertizIslemleri({
  id,
  ekspertizNo,
  durum,
  genelToplam,
  kabul,
  duzeltebilir,
  silebilir,
  kabulAcabilir,
}: {
  id: number
  ekspertizNo: string
  durum: (typeof EKSPERTIZ_DURUMLARI)[number]
  genelToplam: number
  kabul: { id: number; kabulNo: string } | null
  duzeltebilir: boolean
  silebilir: boolean
  kabulAcabilir: boolean
}) {
  const [bekliyor, basla] = useTransition()
  const kilitli = durum === "KABULE_DONDU"

  function durumaGec(yeni: string) {
    basla(async () => {
      const sonuc = await ekspertizDurumDegistir(id, yeni)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(sonuc.bilgi ?? "Durum güncellendi.")
    })
  }

  function donustur() {
    if (
      !confirm(
        `${ekspertizNo} numaralı ekspertizden ARAÇ KABUL (iş emri) kartı açılacak.\n\n` +
          `Tahmini tutar: ${para(genelToplam)}\n\n` +
          `Bu işlem geri alınamaz; ekspertiz kartı kilitlenir ve bundan sonra ` +
          `değişiklikler kabul kartından yapılır. Devam edilsin mi?`
      )
    ) {
      return
    }
    basla(async () => {
      const sonuc = await kabuleDonustur(id)
      // Başarılıysa action zaten kabul kartına yönlendiriyor; buraya
      // yalnızca hata dönerse geliniyor.
      if (sonuc?.hata) toast.error(sonuc.hata)
    })
  }

  function sil() {
    if (!confirm(`${ekspertizNo} numaralı ekspertiz silinsin mi?`)) return
    basla(async () => {
      const sonuc = await ekspertizSil(id)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(sonuc.bilgi ?? "Silindi.")
    })
  }

  return (
    <div className="onay-butonlari flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/baski/ekspertiz/${id}`} target="_blank">
          <Printer className="size-4" aria-hidden />
          Yazdır
        </Link>
      </Button>

      {duzeltebilir && !kilitli ? (
        <>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/servis/ekspertiz/${id}/duzenle`}>Düzenle</Link>
          </Button>

          <label className="flex items-center gap-1.5 text-[0.8125rem]">
            <span className="text-muted-foreground">Durum</span>
            <select
              value={durum}
              disabled={bekliyor}
              onChange={(e) => durumaGec(e.target.value)}
              className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs"
            >
              {EKSPERTIZ_DURUMLARI.filter((d) => d !== "KABULE_DONDU").map((d) => (
                <option key={d} value={d}>
                  {EKSPERTIZ_DURUM_ETIKETI[d]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {kabul ? (
        <Button size="sm" variant="secondary" asChild>
          <Link href={`/servis/kabul/${kabul.id}`}>
            <ArrowRightCircle className="size-4" aria-hidden />
            Kabul Kartı: {kabul.kabulNo}
          </Link>
        </Button>
      ) : kabulAcabilir ? (
        <Button size="sm" onClick={donustur} disabled={bekliyor}>
          <ArrowRightCircle className="size-4" aria-hidden />
          Kabule Dönüştür
        </Button>
      ) : null}

      {silebilir && !kabul ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={sil}
          disabled={bekliyor}
          className="ml-auto text-tehlike hover:bg-tehlike/10 hover:text-tehlike"
        >
          <Trash2 className="size-4" aria-hidden />
          Sil
        </Button>
      ) : null}
    </div>
  )
}
