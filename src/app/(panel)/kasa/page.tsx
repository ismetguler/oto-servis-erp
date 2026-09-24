import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen, Pencil, Plus, Repeat, Wallet } from "lucide-react"

import { KASA_TUR_ADI, kasalariGetir } from "./veri"
import { KasaSilDugmesi } from "@/components/kasa/kasa-sil-dugmesi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, yuzde } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Kasalar" }
export const dynamic = "force-dynamic"

export default async function KasaListesi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>
}) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const p = await searchParams
  const durum = p.durum ?? "aktif"

  const kasalar = await kasalariGetir(durum)
  const toplam = kasalar.reduce((t, k) => t + k.bakiye, 0)

  const ekleyebilir = yetkiVar(kullanici, "tahsilat", "ekle")
  const duzeltebilir = yetkiVar(kullanici, "tahsilat", "duzelt")
  const silebilir = yetkiVar(kullanici, "tahsilat", "sil")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Kasalar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Nakit, banka ve POS kasaları · {kasalar.length} kasa · toplam {para(toplam)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <Button variant="outline" size="sm" asChild>
            <Link href="/kasa/defter">
              <BookOpen className="size-4" aria-hidden />
              Kasa Defteri
            </Link>
          </Button>
          {ekleyebilir ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/kasa/virman">
                  <Repeat className="size-4" aria-hidden />
                  Virman
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/kasa/yeni">
                  <Plus className="size-4" aria-hidden />
                  Yeni Kasa
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi flex items-end gap-2 border-b border-border bg-card px-4 py-2.5">
        <form method="get" action="/kasa" className="flex items-end gap-2">
          <div className="form-alani">
            <label htmlFor="durum" className="form-etiket">
              Durum
            </label>
            <select
              id="durum"
              name="durum"
              defaultValue={durum}
              className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <option value="aktif">Aktif kasalar</option>
              <option value="pasif">Pasife alınanlar</option>
              <option value="tumu">Aktif + pasif</option>
              <option value="silinen">Silinen kasalar</option>
            </select>
          </div>
          <Button type="submit" size="sm">
            Listele
          </Button>
        </form>
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kasalar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Wallet className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {durum === "aktif" ? "Henüz kasa tanımlanmamış" : "Bu ölçütlere uyan kasa yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Nakit kasası, banka hesabı ve POS için birer kart açın; tahsilat ve ödemeler
                bu kasalara işlenecek.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Kasa Adı</th>
                    <th>Tür</th>
                    <th>Banka / IBAN</th>
                    <th className="text-right">Komisyon</th>
                    <th className="text-right">Hareket</th>
                    <th className="text-right">Bakiye</th>
                    <th className="yazdirma-disi w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {kasalar.map((k) => (
                    <tr key={k.id} className={k.silindi ? "opacity-50" : undefined}>
                      <td className="font-mono">
                        <Link href={`/kasa/${k.id}`} className="hover:underline">
                          {k.kod}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/kasa/${k.id}`} className="font-medium hover:underline">
                          {k.ad}
                        </Link>
                        {!k.aktif && !k.silindi ? (
                          <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                            pasif
                          </span>
                        ) : null}
                      </td>
                      <td>{KASA_TUR_ADI[k.tur]}</td>
                      <td className="text-muted-foreground">
                        {k.banka ? k.banka : "—"}
                        {k.ibanNo ? (
                          <span className="ml-1 font-mono text-[0.75rem]">{k.ibanNo}</span>
                        ) : null}
                      </td>
                      <td className="text-right">
                        {k.tur === "POS" ? yuzde(k.posKomisyonOrani) : "—"}
                      </td>
                      <td className="text-right tabular-nums">{k.hareketSayisi}</td>
                      <td
                        className={`text-right font-medium tabular-nums ${k.bakiye < 0 ? "text-tehlike" : ""}`}
                      >
                        {para(k.bakiye)}
                      </td>
                      <td className="yazdirma-disi">
                        <div className="flex items-center justify-end">
                          <Button variant="ghost" size="icon" asChild title="Defteri aç">
                            <Link href={`/kasa/defter?kasa=${k.id}`} aria-label="Defteri aç">
                              <BookOpen className="size-4" aria-hidden />
                            </Link>
                          </Button>
                          {duzeltebilir && !k.silindi ? (
                            <Button variant="ghost" size="icon" asChild title="Düzenle">
                              <Link href={`/kasa/${k.id}/duzenle`} aria-label="Düzenle">
                                <Pencil className="size-4" aria-hidden />
                              </Link>
                            </Button>
                          ) : null}
                          {silebilir ? (
                            <KasaSilDugmesi id={k.id} silinmis={k.silindi} ad={k.ad} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="text-right font-medium">
                      Toplam
                    </td>
                    <td className="text-right font-semibold tabular-nums">{para(toplam)}</td>
                    <td className="yazdirma-disi"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
