"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cariAcilisSil } from "@/app/(panel)/cari/actions"
import { tahsilatSilmeDurumu } from "@/app/(panel)/tahsilat/actions"
import { Button } from "@/components/ui/button"

/**
 * Cari kartı "Son Hesap Hareketleri" satır işlemi.
 *
 * Hareket satırı doğrudan silinmez; bakiyeyi oluşturan asıl kayıt silinir ki
 * kasa/stok/fatura ile cari arasında fark oluşmasın:
 *  - Açılış          → açılış bakiyesi sıfırlanır
 *  - Tahsilat/Ödeme  → fiş silinir (kasa ve cari etkisi birlikte geri alınır)
 *  - Fatura/Servis/Çek → kendi sayfasına gidilir, silme oradan yapılır
 * Her satırda ayrıca kaydın düzenleme sayfasına götüren tuş vardır.
 */
export function HareketIslemi({
  cariId,
  tur,
  etiket,
  tahsilatId,
  kaynakYolu,
  acilisSilebilir,
  tahsilatSilebilir,
}: {
  cariId: number
  tur: string
  etiket: string
  tahsilatId: number | null
  kaynakYolu: string | null
  acilisSilebilir: boolean
  tahsilatSilebilir: boolean
}) {
  const [bekliyor, basla] = useTransition()
  const router = useRouter()

  const acilis = tur === "ACILIS" && acilisSilebilir
  const fis = (tur === "TAHSILAT" || tur === "TEDIYE") && tahsilatId && tahsilatSilebilir

  // Düzenle: açılış → cari kartı düzenleme, fiş → fiş düzenleme, diğerleri → kaydın kendisi.
  const duzenleYolu =
    tur === "ACILIS"
      ? `/cari/${cariId}/duzenle`
      : tahsilatId
        ? `/tahsilat/${tahsilatId}/duzenle`
        : kaynakYolu

  function tikla() {
    const soru = acilis
      ? "Açılış bakiyesi silinsin mi? Cari bakiyesi yeniden hesaplanır."
      : `${etiket} silinsin mi? Cari ve kasa bakiyesindeki etkisi kaldırılır.`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = acilis
        ? await cariAcilisSil(cariId)
        : await tahsilatSilmeDurumu(tahsilatId as number, true)
      if (sonuc.hata) {
        toast.error(sonuc.hata)
        return
      }
      toast.success("Silindi.")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      {duzenleYolu ? (
        <Button variant="ghost" size="icon" asChild title="Düzenle">
          <Link href={duzenleYolu} aria-label="Düzenle">
            {acilis || fis ? (
              <Pencil className="size-4" aria-hidden />
            ) : (
              <ExternalLink className="size-4" aria-hidden />
            )}
          </Link>
        </Button>
      ) : null}
      {acilis || fis ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={tikla}
          disabled={bekliyor}
          title="Sil"
          aria-label="Sil"
          className="text-tehlike hover:text-tehlike"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
