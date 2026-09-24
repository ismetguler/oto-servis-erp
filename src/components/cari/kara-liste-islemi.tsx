"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"

import {
  karaListedenCikar,
  karaListeyeAl,
  type KaraListeDurumu,
} from "@/app/(panel)/cari/kara-liste/actions"
import { Button } from "@/components/ui/button"
import { formGonderimi } from "@/lib/form-gonderim"
import { cn } from "@/lib/utils"

/**
 * KARA LİSTEYE AL / KARA LİSTEDEN ÇIKAR
 *
 * Tek düğme iki işi yapıyor: cari kara listede değilse "al", listedeyse
 * "çıkar". İkisi de neden yazmadan çalışmıyor, bu yüzden düğmeye basınca
 * doğrudan işlem yapılmıyor — altında küçük bir form açılıyor.
 * `confirm()` kullanılmadı: tarayıcının onay kutusuna metin yazdırılamıyor,
 * neden alanı da zorunlu.
 */
export function KaraListeIslemi({
  cariId,
  unvan,
  karaListede,
  boyut = "sm",
}: {
  cariId: number
  unvan: string
  karaListede: boolean
  boyut?: "sm" | "icon"
}) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [durum, setDurum] = useState<KaraListeDurumu>({})
  const [bekliyor, basla] = useTransition()

  const nedenAlani = karaListede ? "kaldirmaNedeni" : "neden"

  function gonder(form: FormData) {
    basla(async () => {
      const sonuc = karaListede
        ? await karaListedenCikar({}, form)
        : await karaListeyeAl({}, form)
      setDurum(sonuc)
      if (sonuc.basarili) {
        toast.success(sonuc.basarili)
        setAcik(false)
        // revalidatePath sunucu önbelleğini tazeliyor; açık duran ekranın
        // kendisi bu satır olmadan eski hâliyle kalabiliyor.
        router.refresh()
      } else if (sonuc.hata && !sonuc.alanHatalari) {
        toast.error(sonuc.hata)
      }
    })
  }

  if (!acik) {
    return (
      <Button
        variant={karaListede ? "outline" : "ghost"}
        size={boyut}
        onClick={() => {
          setDurum({})
          setAcik(true)
        }}
        className={karaListede ? undefined : "text-tehlike hover:text-tehlike"}
        title={karaListede ? "Kara listeden çıkar" : "Kara listeye al"}
        aria-label={
          karaListede
            ? `${unvan} kara listeden çıkarılsın`
            : `${unvan} kara listeye alınsın`
        }
      >
        {karaListede ? (
          <ShieldCheck className="size-4" aria-hidden />
        ) : (
          <Ban className="size-4" aria-hidden />
        )}
        {boyut === "icon" ? null : karaListede ? "Kara Listeden Çıkar" : "Kara Listeye Al"}
      </Button>
    )
  }

  return (
    <form
      onSubmit={(olay) => formGonderimi(olay, gonder)}
      className="w-full min-w-[16rem] max-md:min-w-0 rounded-md border border-border bg-card p-3 text-left"
    >
      <input type="hidden" name="cariId" value={cariId} />

      <p className="mb-2 text-[0.8125rem] font-medium">
        {karaListede
          ? `"${unvan}" kara listeden çıkarılıyor`
          : `"${unvan}" kara listeye alınıyor`}
      </p>

      <textarea
        name={nedenAlani}
        rows={2}
        required
        maxLength={300}
        autoFocus
        placeholder={
          karaListede
            ? "Neden çıkarılıyor? Örn: borcunu kapattı"
            : "Neden kara listeye alınıyor? Örn: ödemelerini geciktiriyor"
        }
        className={cn(
          "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          durum.alanHatalari?.[nedenAlani] && "border-tehlike"
        )}
      />
      {durum.alanHatalari?.[nedenAlani] ? (
        <p className="mt-1 text-[0.75rem] text-tehlike">
          {durum.alanHatalari[nedenAlani]}
        </p>
      ) : null}

      <p className="mt-1 text-[0.75rem] text-muted-foreground">
        Kara liste kabul açmayı engellemez, yalnızca uyarı gösterir.
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={bekliyor}>
          {bekliyor ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {karaListede ? "Çıkar" : "Kara Listeye Al"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAcik(false)}
          disabled={bekliyor}
        >
          <X className="size-4" aria-hidden />
          Vazgeç
        </Button>
      </div>
    </form>
  )
}
