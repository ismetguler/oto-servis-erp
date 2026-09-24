"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Merge } from "lucide-react"
import { toast } from "sonner"

import {
  cariBirlestir,
  type BirlestirDurumu,
} from "@/app/(panel)/cari/birlestir/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * BİRLEŞTİRME ONAY FORMU
 *
 * İşlem geri alınamadığı için tek tık yetmiyor: kullanıcı kaynak carinin
 * kodunu ELLE yazıyor ve "geri alınamaz" kutusunu işaretliyor. Kod alanı
 * boşken düğme kapalı — yanlış satırdan gelen bir tıklamanın veri taşıması
 * bu iki adımla engelleniyor.
 *
 * Başarıda hedef cari kartına gidiliyor: kullanıcı sonucu hemen görsün,
 * "oldu mu olmadı mı" diye listeye dönmek zorunda kalmasın.
 */
export function BirlestirFormu({
  kaynakId,
  hedefId,
  kaynakKod,
  kaynakUnvan,
  hedefKod,
  hedefUnvan,
}: {
  kaynakId: number
  hedefId: number
  kaynakKod: string
  kaynakUnvan: string
  hedefKod: string
  hedefUnvan: string
}) {
  const router = useRouter()
  const [durum, setDurum] = useState<BirlestirDurumu>({})
  const [kod, setKod] = useState("")
  const [onay, setOnay] = useState(false)
  const [bekliyor, basla] = useTransition()

  const hazir = kod.trim().toLocaleUpperCase("tr-TR") === kaynakKod.toLocaleUpperCase("tr-TR")

  // `<form action={fn}>` KULLANILMIYOR: React gönderim sonrası formu
  // sıfırlıyor, hata dönen bir denemede kullanıcının işaretlediği onay kutusu
  // sessizce boşalıyordu (state değişmediği için React da geri koymuyor).
  // Kendi submit'imizi yazınca form olduğu gibi kalıyor, kullanıcı yalnızca
  // hatalı alanı düzeltiyor.
  function gonder(olay: React.FormEvent<HTMLFormElement>) {
    olay.preventDefault()
    const form = new FormData(olay.currentTarget)
    basla(async () => {
      const sonuc = await cariBirlestir({}, form)
      setDurum(sonuc)
      if (sonuc.basarili) {
        toast.success(sonuc.basarili)
        router.push(`/cari/${sonuc.hedefId}`)
        router.refresh()
      } else if (sonuc.hata) {
        toast.error(sonuc.hata)
      }
    })
  }

  return (
    <form onSubmit={gonder} className="panel overflow-hidden">
      <input type="hidden" name="kaynakId" value={kaynakId} />
      <input type="hidden" name="hedefId" value={hedefId} />

      <div className="panel-baslik">
        <h2 className="panel-baslik-yazi">Onay</h2>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        <div className="rounded-sm border border-tehlike/40 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          <strong>{kaynakKod} — {kaynakUnvan}</strong> kartı kapatılacak, bütün
          geçmişi <strong>{hedefKod} — {hedefUnvan}</strong> kartına geçecek.
          Bu işlemin geri alma ekranı yoktur.
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[0.75rem] font-medium text-muted-foreground">
            Onaylamak için kaynak cari kodunu yazın:{" "}
            <span className="font-mono text-foreground">{kaynakKod}</span>
          </span>
          <input
            name="onayKodu"
            value={kod}
            onChange={(e) => setKod(e.target.value)}
            autoComplete="off"
            placeholder={kaynakKod}
            className={cn(
              "h-8 w-56 rounded-sm border border-input bg-background px-2 font-mono text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
              durum.alanHatalari?.onayKodu && "border-tehlike"
            )}
          />
          {durum.alanHatalari?.onayKodu ? (
            <span className="text-[0.75rem] text-tehlike">
              {durum.alanHatalari.onayKodu}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.75rem] font-medium text-muted-foreground">
            Açıklama (işlem loguna yazılır)
          </span>
          <input
            name="aciklama"
            maxLength={300}
            autoComplete="off"
            placeholder="Örn: aynı firma iki kez açılmış, vergi no aynı"
            className="h-8 w-full max-w-xl rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </label>

        <label className="flex items-start gap-2 text-[0.8125rem]">
          <input
            type="checkbox"
            name="onaylandi"
            checked={onay}
            onChange={(e) => setOnay(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--tehlike)]"
          />
          <span>
            Birleştirmenin <strong>geri alınamayacağını</strong> anladım, hedef
            kartın doğru kayıt olduğunu kontrol ettim.
          </span>
        </label>
        {durum.alanHatalari?.onaylandi ? (
          <p className="text-[0.75rem] text-tehlike">{durum.alanHatalari.onaylandi}</p>
        ) : null}

        <div>
          <Button
            type="submit"
            variant="destructive"
            disabled={!hazir || !onay || bekliyor}
            className="gap-2"
          >
            {bekliyor ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Merge className="size-4" aria-hidden />
            )}
            {bekliyor ? "Birleştiriliyor…" : "Carileri Birleştir"}
          </Button>
        </div>
      </div>
    </form>
  )
}
