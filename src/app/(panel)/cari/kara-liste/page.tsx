import type { Metadata } from "next"
import Link from "next/link"
import { Ban, ShieldCheck } from "lucide-react"

import { acikKaraListeGetir, gecmisKaraListeGetir, type KaraListeSatiri } from "./veri"
import { KaraListeIslemi } from "@/components/cari/kara-liste-islemi"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { para, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { cn } from "@/lib/utils"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Cari Kara Liste" }
export const dynamic = "force-dynamic"

/**
 * CARİ KARA LİSTE
 *
 * Sekme adres çubuğunda tutuluyor (?sekme=gecmis): işlem sonrası sayfa
 * sunucudan tazeleniyor, istemci state'i olsaydı her kayıtta ilk sekmeye
 * düşerdi — Sorumlu Personel ekranındaki ile aynı gerekçe.
 */
export default async function CariKaraListe({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sekme?: string }>
}) {
  const kullanici = await yetkiliOturum("cari", "gor")
  const p = await searchParams
  const q = (p.q ?? "").trim()
  const sekme = p.sekme === "gecmis" ? "gecmis" : "acik"

  const [acik, gecmis] = await Promise.all([
    acikKaraListeGetir(q),
    gecmisKaraListeGetir(q),
  ])
  const duzeltebilir = yetkiVar(kullanici, "cari", "duzelt")
  const satirlar = sekme === "gecmis" ? gecmis : acik

  const sekmeYolu = (deger: "acik" | "gecmis") => {
    const parametre = new URLSearchParams()
    if (q) parametre.set("q", q)
    if (deger === "gecmis") parametre.set("sekme", "gecmis")
    const metin = parametre.toString()
    return metin ? `/cari/kara-liste?${metin}` : "/cari/kara-liste"
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Kara Liste</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Kara listedeki cariler ve geçmiş kayıtları — {acik.length} açık kayıt
          </p>
        </div>
        <YazdirDugmesi />
      </div>

      <div className="yazdirma-disi flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 pt-2">
        <div className="flex items-center gap-1">
          <Sekme yol={sekmeYolu("acik")} etkin={sekme === "acik"}>
            Kara Listede ({acik.length})
          </Sekme>
          <Sekme yol={sekmeYolu("gecmis")} etkin={sekme === "gecmis"}>
            Geçmiş ({gecmis.length})
          </Sekme>
        </div>
        <form className="mb-2 ml-auto flex items-center gap-2" action="/cari/kara-liste">
          {sekme === "gecmis" ? <input type="hidden" name="sekme" value="gecmis" /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Ünvan veya cari kodu"
            className="h-8 w-56 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <button
            type="submit"
            className="h-8 rounded-sm border border-input bg-background px-3 text-[0.8125rem] font-medium hover:bg-accent"
          >
            Ara
          </button>
        </form>
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {satirlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              {sekme === "acik" ? (
                <ShieldCheck className="size-8 text-muted-foreground/40" aria-hidden />
              ) : (
                <Ban className="size-8 text-muted-foreground/40" aria-hidden />
              )}
              <p className="text-[0.875rem] font-medium">
                {sekme === "acik"
                  ? q
                    ? "Bu aramaya uyan kara liste kaydı yok"
                    : "Kara listede cari yok"
                  : "Geçmiş kayıt yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                {sekme === "acik"
                  ? "Bir cariyi kara listeye almak için cari kartını açıp Kara Listeye Al düğmesini kullanın."
                  : "Kara listeden çıkarılan cariler bu sekmede birikir."}
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-14rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Ünvan</th>
                    <th>Telefon</th>
                    <th className="text-right">Bakiye</th>
                    <th className="text-right">Açık İş</th>
                    <th>Neden</th>
                    <th>Alınma</th>
                    {sekme === "gecmis" ? <th>Kaldırılma</th> : null}
                    {sekme === "acik" && duzeltebilir ? (
                      <th className="yazdirma-disi text-right">İşlem</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((s) => (
                    <Satir
                      key={s.kayitId}
                      satir={s}
                      gecmis={sekme === "gecmis"}
                      duzeltebilir={duzeltebilir}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Satir({
  satir,
  gecmis,
  duzeltebilir,
}: {
  satir: KaraListeSatiri
  gecmis: boolean
  duzeltebilir: boolean
}) {
  return (
    <tr>
      <td className="font-mono text-[0.75rem]">
        <Link href={`/cari/${satir.cariId}`} className="text-primary hover:underline">
          {satir.kod}
        </Link>
      </td>
      <td className="max-w-[18rem] truncate font-medium">
        <Link href={`/cari/${satir.cariId}`} className="hover:underline">
          {satir.unvan}
        </Link>
      </td>
      <td>{satir.telefon ?? "—"}</td>
      <td
        className={cn(
          "text-right",
          satir.bakiye > 0
            ? "font-medium text-tehlike"
            : satir.bakiye < 0
              ? "font-medium text-basari"
              : "text-muted-foreground"
        )}
      >
        {para(Math.abs(satir.bakiye))}
      </td>
      <td className="text-right">
        {satir.acikKabulSayisi > 0 ? (
          <span className="font-medium text-uyari">{satir.acikKabulSayisi}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="max-w-[22rem] whitespace-pre-wrap">{satir.neden}</td>
      <td className="text-[0.75rem] text-muted-foreground">
        {tarihSaat(satir.alisTarihi)}
        {satir.ekleyenKod ? ` · ${satir.ekleyenKod}` : ""}
      </td>
      {gecmis ? (
        <td className="max-w-[22rem] text-[0.75rem] text-muted-foreground">
          {tarihSaat(satir.kaldirmaTarihi)}
          {satir.kaldiranKod ? ` · ${satir.kaldiranKod}` : ""}
          {satir.kaldirmaNedeni ? (
            <span className="block whitespace-pre-wrap text-foreground">
              {satir.kaldirmaNedeni}
            </span>
          ) : null}
        </td>
      ) : null}
      {!gecmis && duzeltebilir ? (
        <td className="yazdirma-disi">
          <div className="flex justify-end">
            <KaraListeIslemi cariId={satir.cariId} unvan={satir.unvan} karaListede />
          </div>
        </td>
      ) : null}
    </tr>
  )
}

function Sekme({
  yol,
  etkin,
  children,
}: {
  yol: string
  etkin: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={yol}
      className={cn(
        "-mb-px shrink-0 border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition-colors",
        etkin
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  )
}
