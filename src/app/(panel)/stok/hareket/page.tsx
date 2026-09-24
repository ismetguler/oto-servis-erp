import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftRight } from "lucide-react"

import {
  hareketSorgusu,
  hareketVerisi,
  HAREKET_LIMIT,
  HAREKET_TUR_ADI,
  secilebilirStoklar,
  varsayilanAralik,
  type StokHareketFiltreleri,
} from "./veri"
import { HareketFiltre } from "@/components/stok/hareket-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { miktar, para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Stok Hareketleri" }
export const dynamic = "force-dynamic"

export default async function StokHareketleri({
  searchParams,
}: {
  searchParams: Promise<StokHareketFiltreleri>
}) {
  await yetkiliOturum("stok", "gor")
  const p = await searchParams
  const v = varsayilanAralik()

  const f: StokHareketFiltreleri = {
    stok: p.stok ?? "tumu",
    q: (p.q ?? "").trim(),
    tur: p.tur ?? "tumu",
    bas: p.bas && p.bas !== "" ? p.bas : v.bas,
    bit: p.bit && p.bit !== "" ? p.bit : v.bit,
  }

  const [veri, stoklar] = await Promise.all([hareketVerisi(f), secilebilirStoklar()])
  const seciliStok = veri.tekStok ? stoklar.find((s) => s.id === Number(f.stok)) : undefined

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Stok Hareketleri</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {seciliStok ? `${seciliStok.kod} — ${seciliStok.ad}` : "Tüm stok kartları"} ·{" "}
            {tarih(f.bas)} – {tarih(f.bit)} · {veri.satirlar.length} satır
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/stok/hareket/disa-aktar${hareketSorgusu(f)}`} />
        </div>
      </div>

      <div className="yazdirma-disi">
        <HareketFiltre
          stoklar={stoklar}
          stok={f.stok ?? "tumu"}
          q={f.q ?? ""}
          tur={f.tur ?? "tumu"}
          bas={f.bas ?? ""}
          bit={f.bit ?? ""}
        />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Kutu etiket="Dönem Girişi" deger={miktar(veri.toplamGiris)} renk="basari" />
        <Kutu etiket="Dönem Çıkışı" deger={miktar(veri.toplamCikis)} renk="tehlike" />
      </div>

      <div className="px-4 pb-4">
        <div className="panel overflow-hidden">
          {veri.satirlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <ArrowLeftRight className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Bu aralıkta hareket yok</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Tarih aralığını genişletin ya da filtreyi temizleyin.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-20rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Stok Kartı</th>
                    <th>Tür</th>
                    <th>Belge / Açıklama</th>
                    <th className="text-right">Giriş</th>
                    <th className="text-right">Çıkış</th>
                    <th className="text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {veri.satirlar.map((h) => (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap">{tarih(h.tarih)}</td>
                      <td>
                        <Link href={`/stok/${h.stokId}`} className="hover:underline">
                          {h.stokKodu} — {h.stokAdi}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {HAREKET_TUR_ADI[h.tur]}
                      </td>
                      <td className="max-w-[20rem] truncate">
                        {h.belgeYolu ? (
                          <Link href={h.belgeYolu} className="text-primary hover:underline">
                            {h.belgeEtiketi}
                          </Link>
                        ) : (
                          h.belgeEtiketi
                        )}
                      </td>
                      <td className="text-right tabular-nums text-basari">
                        {h.giris > 0 ? `${miktar(h.giris)} ${h.birim}` : "—"}
                      </td>
                      <td className="text-right tabular-nums text-tehlike">
                        {h.cikis > 0 ? `${miktar(h.cikis)} ${h.birim}` : "—"}
                      </td>
                      <td className="text-right tabular-nums">{h.tutar ? para(h.tutar) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                    <td colSpan={4} className="px-3 py-2 text-right">
                      Dönem Toplamı
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-basari">
                      {miktar(veri.toplamGiris)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-tehlike">
                      {miktar(veri.toplamCikis)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{para(veri.toplamTutar)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        {veri.satirlar.length === HAREKET_LIMIT ? (
          <p className="mt-2 text-[0.75rem] text-muted-foreground">
            İlk {HAREKET_LIMIT} satır gösteriliyor — daha fazlası için tarih aralığını daraltın.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Kutu({
  etiket,
  deger,
  renk,
}: {
  etiket: string
  deger: string
  renk?: "basari" | "tehlike"
}) {
  return (
    <div className="panel p-3">
      <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{etiket}</p>
      <p
        className={`mt-0.5 text-[1.125rem] font-semibold tabular-nums ${
          renk === "basari" ? "text-basari" : renk === "tehlike" ? "text-tehlike" : ""
        }`}
      >
        {deger}
      </p>
    </div>
  )
}
