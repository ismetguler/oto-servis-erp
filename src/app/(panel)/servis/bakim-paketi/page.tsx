import type { Metadata } from "next"
import Link from "next/link"
import { Package2, Pencil, Plus } from "lucide-react"

import { paketFiltreSorgusu, paketKalemleriGetir, paketListeKosulu } from "./veri"
import { PaketSilDugmesi } from "@/components/bakim-paketi/paket-sil-dugmesi"
import { PaketFiltre } from "@/components/bakim-paketi/paket-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Bakım Paketleri" }
export const dynamic = "force-dynamic"

type Aramalar = { q?: string; durum?: string }

export default async function BakimPaketiListesi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const durum = p.durum ?? "aktif"
  const kosul = paketListeKosulu({ q, durum })

  const kayitlar = await prisma.bakimPaketi.findMany({
    where: kosul,
    orderBy: [{ ad: "asc" }],
    select: {
      id: true,
      kod: true,
      ad: true,
      km: true,
      marka: true,
      aracTuru: true,
      aktif: true,
      silindi: true,
      _count: { select: { kalemler: true } },
    },
  })

  // Paket tutarı katalogdan hesaplandığı için listede de satırlar okunuyor.
  // Kayıt sayısı az (onlarca) olduğundan tek tek okumak sorun değil.
  const tutarlar = await Promise.all(
    kayitlar.map(async (k) => {
      const kalemler = await paketKalemleriGetir(k.id)
      const toplam = kalemler.reduce(
        (t, s) => t + s.miktar * s.gecerliFiyat * (1 + s.kdvOrani / 100),
        0
      )
      const uyari = kalemler.some((s) => s.uyari)
      return { id: k.id, toplam, uyari }
    })
  )
  const tutarHaritasi = new Map(tutarlar.map((t) => [t.id, t]))

  const ekleyebilir = yetkiVar(kullanici, "kabul", "ekle")
  const duzeltebilir = yetkiVar(kullanici, "kabul", "duzelt")
  const silebilir = yetkiVar(kullanici, "kabul", "sil")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Bakım Paketleri</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Hazır parça + işçilik kalıpları — kabul kartında tek hamlede eklenir ·{" "}
            {kayitlar.length} paket
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/servis/bakim-paketi/disa-aktar${paketFiltreSorgusu({ q, durum })}`}
          />
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/servis/bakim-paketi/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Paket
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <PaketFiltre q={q} durum={durum} />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Package2 className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q || durum !== "aktif" ? "Bu ölçütlere uyan paket yok" : "Henüz bakım paketi yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                &quot;20.000 km bakımı&quot; gibi sık tekrarlanan işleri bir kez tanımlayın;
                kabul kartında bütün satırlar tek tıkla eklensin.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-16rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Paket Adı</th>
                    <th className="text-right">Km</th>
                    <th>Marka</th>
                    <th>Araç Türü</th>
                    <th className="text-right">Satır</th>
                    <th className="text-right">Güncel Tutar</th>
                    <th>Durum</th>
                    <th className="yazdirma-disi text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((k) => {
                    const t = tutarHaritasi.get(k.id)
                    return (
                      <tr key={k.id}>
                        <td className="font-mono text-[0.75rem]">
                          <Link
                            href={`/servis/bakim-paketi/${k.id}`}
                            className="text-primary hover:underline"
                          >
                            {k.kod}
                          </Link>
                        </td>
                        <td className="max-w-[24rem] truncate font-medium">
                          <Link href={`/servis/bakim-paketi/${k.id}`} className="hover:underline">
                            {k.ad}
                          </Link>
                        </td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {k.km ? k.km.toLocaleString("tr-TR") : "—"}
                        </td>
                        <td className="text-muted-foreground">{k.marka ?? "—"}</td>
                        <td className="text-muted-foreground">{k.aracTuru ?? "—"}</td>
                        <td className="text-right tabular-nums">{k._count.kalemler}</td>
                        <td className="text-right tabular-nums">
                          {para(t?.toplam ?? 0)}
                          {t?.uyari ? (
                            <span className="ml-1 text-[0.6875rem] text-uyari">!</span>
                          ) : null}
                        </td>
                        <td>
                          {k.silindi ? (
                            <Rozet metin="Silinmiş" sinif="bg-muted text-muted-foreground" />
                          ) : k.aktif ? (
                            <Rozet metin="Aktif" sinif="bg-basari-yumusak text-basari" />
                          ) : (
                            <Rozet metin="Pasif" sinif="bg-uyari-yumusak text-uyari" />
                          )}
                        </td>
                        <td className="yazdirma-disi">
                          <div className="flex items-center justify-end gap-1">
                            {duzeltebilir && !k.silindi ? (
                              <Button variant="ghost" size="icon" asChild title="Düzenle">
                                <Link
                                  href={`/servis/bakim-paketi/${k.id}/duzenle`}
                                  aria-label={`${k.ad} paketini düzenle`}
                                >
                                  <Pencil className="size-4" aria-hidden />
                                </Link>
                              </Button>
                            ) : null}
                            {silebilir ? (
                              <PaketSilDugmesi id={k.id} silinmis={k.silindi} ad={k.ad} />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Rozet({ metin, sinif }: { metin: string; sinif: string }) {
  return (
    <span
      className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${sinif}`}
    >
      {metin}
    </span>
  )
}
