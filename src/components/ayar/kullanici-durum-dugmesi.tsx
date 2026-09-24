"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { PowerOff, Power } from "lucide-react"
import { toast } from "sonner"

import { kullaniciDurumDegistir } from "@/app/(panel)/ayar/kullanici/actions"
import { Button } from "@/components/ui/button"

/**
 * Pasife Al / Aktif Et — Cari'deki Sil/Geri Al düğmesiyle aynı desen, ama
 * fiziksel/soft "silme" değil: kullanıcı kaydının bir giriş kimliği olduğu
 * için `aktif` bayrağı kullanılıyor (bkz. actions.ts).
 */
export function KullaniciDurumDugmesi({
  id,
  aktif,
  kod,
}: {
  id: number
  aktif: boolean
  kod: string
}) {
  const router = useRouter()
  const [bekliyor, basla] = useTransition()

  function tikla() {
    const soru = aktif
      ? `"${kod}" pasife alınsın mı? Bu kullanıcı artık giriş yapamaz.`
      : `"${kod}" tekrar aktif edilsin mi?`
    if (!confirm(soru)) return

    basla(async () => {
      const sonuc = await kullaniciDurumDegistir(id, !aktif)
      if (sonuc.hata) toast.error(sonuc.hata)
      else {
        toast.success(aktif ? "Kullanıcı pasife alındı." : "Kullanıcı aktif edildi.")
        router.refresh()
      }
    })
  }

  return (
    <Button
      variant={aktif ? "ghost" : "outline"}
      size="sm"
      onClick={tikla}
      disabled={bekliyor}
      className={aktif ? "text-tehlike hover:text-tehlike" : undefined}
    >
      {aktif ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
      {aktif ? "Pasife Al" : "Aktif Et"}
    </Button>
  )
}
