import type { Metadata } from "next"
import Link from "next/link"
import { ScrollText } from "lucide-react"

import {
  logFiltreSecenekleriGetir,
  logFiltreSorgusu,
  logListeKosulu,
  sonBudamaBilgisi,
  varsayilanLogAraligi,
} from "./veri"
import { LogFiltre } from "@/components/ayar/log-filtre"
import { LogTablosu, type LogSatiriVerisi } from "@/components/ayar/log-tablosu"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Kim Ne Yaptı" }
export const dynamic = "force-dynamic"

const SAYFA_BOYU = 100

type Aramalar = {
  bas?: string
  bit?: string
  kullaniciId?: string
  tablo?: string
  islem?: string
  sayfa?: string
}

/**
 * İŞLEM KAYITLARI — ADIM 11.5 (ADIM 11'in beşinci alt adımı)
 *
 * SADECE OKUMA: burada hiçbir düzenleme/silme yok, loglar değiştirilemez —
 * `yetkiliOturum("ayar", "gor")` yeterli, ekle/düzelt/sil kontrolü hiç
 * çağrılmıyor çünkü ekranda o aksiyonlar yok. `ROL_MATRISI`ye göre "ayar"
 * modülüne sadece YÖNETİCİ erişebiliyor (11.1-11.4'le tutarlı — MUHASEBE/
 * SERVİS DANIŞMANI/USTA/DEPO şemasında "ayar" hiç yok).
 */
export default async function IslemKayitlari({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  await yetkiliOturum("ayar", "gor")
  const p = await searchParams

  const varsayilan = varsayilanLogAraligi()
  const filtreler = {
    bas: p.bas ?? varsayilan.bas,
    bit: p.bit ?? varsayilan.bit,
    kullaniciId: p.kullaniciId ?? "",
    tablo: p.tablo ?? "",
    islem: p.islem ?? "",
  }
  const sayfa = Math.max(1, Number(p.sayfa ?? 1) || 1)

  const kosul = logListeKosulu(filtreler)

  const [toplam, kayitlar, secenekler, budama] = await Promise.all([
    prisma.islemLog.count({ where: kosul }),
    prisma.islemLog.findMany({
      where: kosul,
      orderBy: { tarih: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        tarih: true,
        islem: true,
        tablo: true,
        kayitId: true,
        aciklama: true,
        eskiDeger: true,
        yeniDeger: true,
        ip: true,
        kullaniciKod: true,
        kullanici: { select: { ad: true, soyad: true } },
      },
    }),
    logFiltreSecenekleriGetir(),
    sonBudamaBilgisi(),
  ])

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU))

  const satirlar: LogSatiriVerisi[] = kayitlar.map((k) => ({
    id: k.id,
    tarih: k.tarih,
    islem: k.islem,
    // Kullanıcı silinse bile `kullaniciKod` izi kalıyor (bkz. lib/log.ts) —
    // ilişki hâlâ varsa tam adı, yoksa yalnızca kodu gösterilir.
    kullaniciGosterim: k.kullanici
      ? [k.kullanici.ad, k.kullanici.soyad].filter(Boolean).join(" ")
      : (k.kullaniciKod ?? "—"),
    tablo: k.tablo,
    kayitId: k.kayitId,
    aciklama: k.aciklama,
    eskiDeger: k.eskiDeger,
    yeniDeger: k.yeniDeger,
    ip: k.ip,
  }))

  const sayfaYolu = (no: number) => {
    const p = new URLSearchParams()
    if (filtreler.bas !== varsayilan.bas) p.set("bas", filtreler.bas)
    if (filtreler.bit !== varsayilan.bit) p.set("bit", filtreler.bit)
    if (filtreler.kullaniciId) p.set("kullaniciId", filtreler.kullaniciId)
    if (filtreler.tablo) p.set("tablo", filtreler.tablo)
    if (filtreler.islem) p.set("islem", filtreler.islem)
    if (no > 1) p.set("sayfa", String(no))
    const metin = p.toString()
    return metin ? `/ayar/log?${metin}` : "/ayar/log"
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Kim Ne Yaptı</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Kim, ne zaman, ne yaptı — {toplam} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol={`/ayar/log/disa-aktar${logFiltreSorgusu(filtreler)}`} />
        </div>
      </div>

      <p className="yazdirma-disi px-4 pb-1 text-[0.75rem] text-muted-foreground">
        {budama
          ? `Son otomatik bakım: ${tarihSaat(budama.tarih)} · ${(budama.aciklama ?? "").replace(/^otomatik budama:\s*/, "")}`
          : "Otomatik log bakımı henüz çalışmadı (her Pazartesi gece çalışır)."}
      </p>

      <div className="yazdirma-disi">
        <LogFiltre
          bas={filtreler.bas}
          bit={filtreler.bit}
          kullaniciId={filtreler.kullaniciId}
          tablo={filtreler.tablo}
          islem={filtreler.islem}
          kullanicilar={secenekler.kullanicilar}
          tablolar={secenekler.tablolar}
        />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {satirlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <ScrollText className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Bu ölçütlere uyan kayıt bulunamadı</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Tarih aralığını veya filtreleri değiştirip tekrar deneyin.
              </p>
            </div>
          ) : (
            <>
              <div className="yazdirma-alani max-h-[calc(100svh-16rem)] overflow-auto">
                <LogTablosu satirlar={satirlar} />
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
                    <Button variant="outline" size="sm" asChild disabled={sayfa >= sonSayfa}>
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
