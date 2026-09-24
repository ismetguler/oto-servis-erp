import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { KASA_TUR_ADI, secilebilirKasalar } from "../veri"
import { VirmanFormu } from "@/components/kasa/virman-formu"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Kasalar Arası Aktarım" }
export const dynamic = "force-dynamic"

export default async function VirmanSayfasi() {
  await yetkiliOturum("tahsilat", "ekle")
  const kasalar = await secilebilirKasalar()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/kasa" aria-label="Kasa listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              Kasalar Arası Aktarım
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              Bir kasadan diğerine para aktarımı — muhasebedeki adıyla
              &ldquo;virman&rdquo; · iki kasaya da satır yazılır
            </p>
          </div>
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-[1fr_20rem]">
        <VirmanFormu kasalar={kasalar} />

        <div className="panel overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-[0.875rem] font-semibold">Kasa Bakiyeleri</h2>
          </div>
          <div className="tablo-sarmal">
            <table className="veri-tablosu">
              <tbody>
                {kasalar.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <Link href={`/kasa/${k.id}`} className="hover:underline">
                        {k.ad}
                      </Link>
                      <span className="ml-1 text-[0.75rem] text-muted-foreground">
                        {KASA_TUR_ADI[k.tur]}
                      </span>
                    </td>
                    <td
                      className={`text-right font-medium tabular-nums ${k.bakiye < 0 ? "text-tehlike" : ""}`}
                    >
                      {para(k.bakiye)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
