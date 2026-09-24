import type { Metadata } from "next"
import Link from "next/link"
import { IdCard, Plus } from "lucide-react"

import {
  gorevSecenekleriGetir,
  personelFiltreSorgusu,
  personelListeKosulu,
} from "./veri"
import { PersonelFiltre } from "@/components/cari/personel-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { para, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

/**
 * PERSONEL LİSTESİ
 *
 * Cari listesinin bir filtresi değil ayrı ekran: sütunlar farklı (görev, işe
 * giriş, maaş) ve servis müdürü "personelim" derken müşteri
 * kartlarını görmek istemiyor. Veri kaynağı yine `cariler` tablosu.
 */
export const metadata: Metadata = { title: "Personel Listesi" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 50

type Aramalar = { q?: string; durum?: string; gorev?: string; sayfa?: string }

export default async function PersonelListesi({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const kullanici = await yetkiliOturum("cari", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const durum = p.durum ?? "aktif"
  const gorev = p.gorev ?? ""
  const sayfa = Math.max(1, Number(p.sayfa ?? 1) || 1)

  const kosul = personelListeKosulu({ q, durum, gorev })

  const [toplam, kayitlar, ozet, gorevler] = await Promise.all([
    prisma.cari.count({ where: kosul }),
    prisma.cari.findMany({
      where: kosul,
      orderBy: { unvan: "asc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        kod: true,
        unvan: true,
        gorevi: true,
        telefon: true,
        gsm: true,
        iseGirisTarihi: true,
        istenCikisTarihi: true,
        maas: true,
        bakiye: true,
        aktif: true,
        // Sorumlu olduğu cariler (plasiyer bağı) ve üstlendiği işler:
        // "bu kişi kaç yerde geçiyor" sorusu listede görünsün.
        _count: { select: { plasiyerCarileri: true, kabulGorevleri: true } },
      },
    }),
    prisma.cari.aggregate({ where: kosul, _sum: { bakiye: true, maas: true } }),
    gorevSecenekleriGetir(),
  ])

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU))
  const ekleyebilir = yetkiVar(kullanici, "cari", "ekle")

  /** Sayfa değiştirirken mevcut filtreleri koru. */
  const sayfaYolu = (no: number) => {
    const parametre = new URLSearchParams()
    if (q) parametre.set("q", q)
    if (durum !== "aktif") parametre.set("durum", durum)
    if (gorev) parametre.set("gorev", gorev)
    if (no > 1) parametre.set("sayfa", String(no))
    const metin = parametre.toString()
    return metin ? `/personel?${metin}` : "/personel"
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            {durum === "ayrilan" ? "İşten Ayrılanlar" : "Personel Listesi"}
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Usta, danışman ve diğer çalışan kartları — {toplam} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/personel/disa-aktar${personelFiltreSorgusu({ q, durum, gorev })}`}
          />
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/personel/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Personel
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <PersonelFiltre q={q} durum={durum} gorev={gorev} gorevler={gorevler} />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <IdCard className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q || gorev || durum !== "aktif"
                  ? "Bu ölçütlere uyan personel bulunamadı"
                  : "Henüz personel kaydı yok"}
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                {q || gorev || durum !== "aktif"
                  ? "Arama kelimesini veya filtreleri değiştirip tekrar deneyin."
                  : "İlk personeli eklemek için sağ üstteki Yeni Personel düğmesini kullanın."}
              </p>
            </div>
          ) : (
            <>
              <div className="yazdirma-alani max-h-[calc(100svh-16rem)] overflow-auto">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Ad Soyad</th>
                      <th>Görev</th>
                      <th>Telefon</th>
                      <th>İşe Giriş</th>
                      <th>Çıkış</th>
                      <th className="text-right">Maaş</th>
                      <th className="text-right">Sorumlu Cari</th>
                      <th className="text-right">İş</th>
                      <th className="text-right">Bakiye</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map((k) => {
                      const bakiye = Number(k.bakiye.toString())
                      return (
                        <tr key={k.id}>
                          <td className="font-mono text-[0.75rem]">
                            <Link
                              href={`/personel/${k.id}`}
                              className="text-primary hover:underline"
                            >
                              {k.kod}
                            </Link>
                          </td>
                          <td className="max-w-[18rem] truncate font-medium">
                            <Link href={`/personel/${k.id}`} className="hover:underline">
                              {k.unvan}
                            </Link>
                          </td>
                          <td className="text-muted-foreground">{k.gorevi ?? "—"}</td>
                          <td>{k.gsm ?? k.telefon ?? "—"}</td>
                          <td className="text-muted-foreground">
                            {k.iseGirisTarihi ? tarih(k.iseGirisTarihi) : "—"}
                          </td>
                          <td className="text-muted-foreground">
                            {k.istenCikisTarihi ? tarih(k.istenCikisTarihi) : "—"}
                          </td>
                          <td className="text-right">
                            {Number(k.maas.toString()) ? para(k.maas) : "—"}
                          </td>
                          <td className="text-right text-muted-foreground">
                            {k._count.plasiyerCarileri || "—"}
                          </td>
                          <td className="text-right text-muted-foreground">
                            {k._count.kabulGorevleri || "—"}
                          </td>
                          <td
                            className={
                              // Personelde (+) bakiye "bize borçlu" (avans
                              // aldı), (−) "biz ona borçluyuz" (hak ediş).
                              bakiye > 0
                                ? "text-right font-medium text-tehlike"
                                : bakiye < 0
                                  ? "text-right font-medium text-basari"
                                  : "text-right text-muted-foreground"
                            }
                          >
                            {para(Math.abs(bakiye))}
                          </td>
                          <td>
                            <DurumRozeti
                              aktif={k.aktif}
                              ayrildi={k.istenCikisTarihi !== null}
                              silinen={durum === "silinen"}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                      <td colSpan={6} className="px-3 py-2 text-right text-[0.75rem]">
                        Filtredeki {toplam} kaydın toplamı
                      </td>
                      <td className="px-3 py-2 text-right">
                        {para(Number(ozet._sum.maas?.toString() ?? 0))}
                      </td>
                      <td colSpan={3} />
                      <td className="px-3 py-2 text-right">
                        {para(Number(ozet._sum.bakiye?.toString() ?? 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {sonSayfa > 1 ? (
                <div className="yazdirma-disi flex items-center justify-between border-t border-border px-3 py-2 text-[0.8125rem]">
                  <span className="text-muted-foreground">
                    Sayfa {sayfa} / {sonSayfa}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild disabled={sayfa <= 1}>
                      <Link href={sayfaYolu(Math.max(1, sayfa - 1))}>Önceki</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={sayfa >= sonSayfa}
                    >
                      <Link href={sayfaYolu(Math.min(sonSayfa, sayfa + 1))}>Sonraki</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DurumRozeti({
  aktif,
  ayrildi,
  silinen,
}: {
  aktif: boolean
  ayrildi: boolean
  silinen: boolean
}) {
  const rozetler: Array<[string, string]> = []
  if (silinen) rozetler.push(["Silinmiş", "bg-muted text-muted-foreground"])
  if (ayrildi) rozetler.push(["Ayrıldı", "bg-tehlike-yumusak text-tehlike"])
  if (!aktif && !silinen) rozetler.push(["Pasif", "bg-uyari-yumusak text-uyari"])
  if (rozetler.length === 0) rozetler.push(["Çalışıyor", "bg-basari-yumusak text-basari"])

  return (
    <div className="flex flex-wrap gap-1">
      {rozetler.map(([ad, sinif]) => (
        <span
          key={ad}
          className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${sinif}`}
        >
          {ad}
        </span>
      ))}
    </div>
  )
}
