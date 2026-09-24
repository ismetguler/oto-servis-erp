import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

import { onayBekleyenler, TUR_ADI, YON_ADI } from "../veri"
import { OnayDugmeleri } from "@/components/cek-senet/onay-dugmeleri"
import { Button } from "@/components/ui/button"
import { para, tarih, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Çek / Senet Onayı" }
export const dynamic = "force-dynamic"

/**
 * ONAY İŞLEMLERİ — Selpar'daki "Çek-Senet > Onay İşlemleri" ekranının karşılığı.
 * Girilen kâğıtlar burada gözden geçirilip onaylanır; onaylanana kadar hiçbir
 * bakiyeye dokunmazlar.
 */
export default async function OnayIslemleri() {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const bekleyenler = await onayBekleyenler()
  const onaylayabilir = yetkiVar(kullanici, "tahsilat", "duzelt")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cek-senet" aria-label="Listeye dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">Çek / Senet Onayı</h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {bekleyenler.length} kâğıt onay bekliyor · toplam{" "}
              {para(bekleyenler.reduce((t, k) => t + k.tutar, 0))}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {bekleyenler.length === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ShieldCheck className="size-8 text-basari/50" aria-hidden />
            <p className="text-[0.875rem] font-medium">Onay bekleyen kâğıt yok</p>
            <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
              Yeni girilen her çek/senet burada listelenir; onaylandığı anda cari bakiyesine
              işlenir.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bekleyenler.map((k) => (
              <div key={k.id} className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.9375rem] font-semibold">
                      <Link href={`/cek-senet/${k.id}`} className="hover:underline">
                        <span className="font-mono text-muted-foreground">{k.portfoyNo}</span>{" "}
                        {YON_ADI[k.yon]} {TUR_ADI[k.tur]} · {para(k.tutar)}
                      </Link>
                    </p>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      Vade {tarih(k.vadeTarihi)}
                      {k.cari ? ` · ${k.cari.unvan}` : " · cari bağlanmamış"}
                      {k.borclu ? ` · ${k.borclu}` : ""}
                      {k.banka ? ` · ${k.banka}` : ""}
                      {k.belgeNo ? ` · ${k.belgeNo}` : ""}
                    </p>
                    <p className="text-[0.75rem] text-muted-foreground">
                      Girildi: {tarihSaat(k.olusturmaTarihi)}
                      {k.aciklama ? ` — ${k.aciklama}` : ""}
                    </p>
                  </div>
                  {onaylayabilir ? (
                    <OnayDugmeleri id={k.id} mevcutDurum="BEKLIYOR" kompakt />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
