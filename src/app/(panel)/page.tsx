import type { Metadata } from "next"
import Link from "next/link"
import {
  AlarmClock,
  Banknote,
  CalendarCheck,
  CarFront,
  ClipboardList,
  FileWarning,
  Gauge,
  HandCoins,
  Inbox,
  PackageMinus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { kritikStokIdleriGetir } from "./stok/veri"
import { IstatistikKart } from "@/components/panel/istatistik-kart"
import { gunBasi, gunSonu, para, plaka, tarih } from "@/lib/bicim"
import { oturumZorunlu } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar, type Modul } from "@/lib/yetki"

export const metadata: Metadata = { title: "Ana Sayfa" }

// Panodaki sayılar her zaman güncel olsun.
export const dynamic = "force-dynamic"

export default async function AnaSayfa() {
  const kullanici = await oturumZorunlu()

  const simdi = new Date()
  const bugunBas = gunBasi(simdi)
  const bugunSon = gunSonu(simdi)
  const onBesGunSonra = new Date(simdi.getTime() + 15 * 86_400_000)
  const otuzGunSonra = new Date(simdi.getTime() + 30 * 86_400_000)

  const [
    bugunAcilan,
    acikOnarim,
    bugunTeslim,
    gecikmis,
    faturasiz,
    tahsilatsiz,
    bugunTahsilat,
    bugunCiro,
    alacak,
    borc,
    kritikStok,
    bakimiGelen,
    muayenesiGecen,
    bekleyenAraclar,
  ] = await Promise.all([
    prisma.kabul.count({
      where: { silindi: false, girisTarihi: { gte: bugunBas, lte: bugunSon } },
    }),
    prisma.kabul.count({
      where: { silindi: false, durum: { in: ["ACIK", "BEKLEMEDE"] } },
    }),
    prisma.kabul.count({
      where: {
        silindi: false,
        durum: { notIn: ["TESLIM_EDILDI", "IPTAL"] },
        tahminiTeslimTarihi: { gte: bugunBas, lte: bugunSon },
      },
    }),
    prisma.kabul.count({
      where: {
        silindi: false,
        durum: { notIn: ["TESLIM_EDILDI", "IPTAL"] },
        tahminiTeslimTarihi: { lt: bugunBas },
      },
    }),
    prisma.kabul.count({
      where: { silindi: false, durum: "TESLIM_EDILDI", faturaKesildi: false },
    }),
    prisma.kabul.count({
      where: { silindi: false, faturaKesildi: true, odendi: false },
    }),
    prisma.tahsilat.aggregate({
      _sum: { tutar: true },
      where: {
        silindi: false,
        tur: "TAHSILAT",
        tarih: { gte: bugunBas, lte: bugunSon },
      },
    }),
    prisma.evrak.aggregate({
      _sum: { genelToplam: true },
      where: {
        silindi: false,
        durum: "KESILDI",
        tur: { in: ["SATIS", "SERVIS", "PERAKENDE"] },
        tarih: { gte: bugunBas, lte: bugunSon },
      },
    }),
    prisma.cari.aggregate({
      _sum: { bakiye: true },
      where: { silindi: false, bakiye: { gt: 0 } },
    }),
    prisma.cari.aggregate({
      _sum: { bakiye: true },
      where: { silindi: false, bakiye: { lt: 0 } },
    }),
    kritikStokIdleriGetir(),
    prisma.arac.count({
      where: {
        silindi: false,
        sonrakiBakimTarih: { not: null, lte: onBesGunSonra },
      },
    }),
    prisma.arac.count({
      where: { silindi: false, muayeneBitis: { not: null, lte: otuzGunSonra } },
    }),
    prisma.kabul.findMany({
      where: { silindi: false, durum: { in: ["ACIK", "BEKLEMEDE", "TAMAMLANDI"] } },
      orderBy: { girisTarihi: "desc" },
      take: 8,
      select: {
        id: true,
        kabulNo: true,
        girisTarihi: true,
        tahminiTeslimTarihi: true,
        durum: true,
        genelToplam: true,
        arac: { select: { id: true, plaka: true, marka: true, model: true } },
        cari: { select: { id: true, unvan: true } },
      },
    }),
  ])

  // Her kart bir modüle bağlı: kullanıcının o modülde "gör" yetkisi yoksa kart
  // HİÇ çizilmez. Yoksa bir Usta ana sayfada dükkânın cirosunu / alacağını /
  // borcunu görebiliyordu (menüde o ekranlar gizli olsa bile). Yönetici zaten
  // hepsini görür; Muhasebe finansal kartları, Usta yalnız servis/stok/araç
  // kartlarını görür.
  const tumKartlar: (Parameters<typeof IstatistikKart>[0] & { modul: Modul })[] = [
    {
      modul: "kabul",
      baslik: "Bugün Açılan Kabul",
      deger: bugunAcilan,
      ikon: Inbox,
      ton: "bilgi" as const,
      altBilgi: tarih(simdi),
    },
    {
      modul: "kabul",
      baslik: "Açık Onarım",
      deger: acikOnarim,
      ikon: ClipboardList,
      ton: acikOnarim > 0 ? ("bilgi" as const) : ("notr" as const),
      altBilgi: "Serviste devam eden iş",
      yol: "/servis/acik",
    },
    {
      modul: "kabul",
      baslik: "Bugün Teslim Edilecek",
      deger: bugunTeslim,
      ikon: CalendarCheck,
      ton: bugunTeslim > 0 ? ("uyari" as const) : ("notr" as const),
      yol: "/servis/acik",
    },
    {
      modul: "kabul",
      baslik: "Teslimatı Geçen",
      deger: gecikmis,
      ikon: AlarmClock,
      ton: gecikmis > 0 ? ("tehlike" as const) : ("notr" as const),
      altBilgi: "Söz verilen tarih geçti",
      yol: "/servis/acik",
    },
    {
      modul: "evrak",
      baslik: "Faturası Kesilmeyen",
      deger: faturasiz,
      ikon: FileWarning,
      ton: faturasiz > 0 ? ("uyari" as const) : ("notr" as const),
      yol: "/evrak/servis",
    },
    {
      modul: "tahsilat",
      baslik: "Tahsilatı Yapılmayan",
      deger: tahsilatsiz,
      ikon: HandCoins,
      ton: tahsilatsiz > 0 ? ("tehlike" as const) : ("notr" as const),
      yol: "/servis/tahsilat?durum=yapilmayan",
    },
    {
      modul: "tahsilat",
      baslik: "Bugünkü Tahsilat",
      deger: para(bugunTahsilat._sum.tutar),
      ikon: Banknote,
      ton: "basari" as const,
      yol: "/tahsilat",
    },
    {
      modul: "evrak",
      baslik: "Bugünkü Ciro",
      deger: para(bugunCiro._sum.genelToplam),
      ikon: Gauge,
      ton: "basari" as const,
      altBilgi: "Kesilen faturalar",
      yol: "/evrak/satis",
    },
    {
      modul: "cari",
      baslik: "Toplam Alacak",
      deger: para(alacak._sum.bakiye),
      ikon: TrendingUp,
      ton: "uyari" as const,
      altBilgi: "Müşterilerden",
      yol: yetkiVar(kullanici, "rapor", "gor") ? "/rapor/yaslandirma" : "/cari/mizan",
    },
    {
      modul: "cari",
      baslik: "Toplam Borç",
      deger: para(Math.abs(Number(borc._sum.bakiye ?? 0))),
      ikon: TrendingDown,
      ton: "notr" as const,
      altBilgi: "Tedarikçilere",
    },
    {
      modul: "stok",
      baslik: "Kritik Stok",
      deger: kritikStok.length,
      ikon: PackageMinus,
      ton: kritikStok.length > 0 ? ("tehlike" as const) : ("notr" as const),
      altBilgi: "Minimum seviyenin altında",
      yol: "/stok/minimum",
    },
    {
      modul: "arac",
      baslik: "Bakımı / Muayenesi Gelen",
      deger: bakimiGelen + muayenesiGecen,
      ikon: ShieldAlert,
      ton: bakimiGelen + muayenesiGecen > 0 ? ("uyari" as const) : ("notr" as const),
      altBilgi: "Önümüzdeki 30 gün",
      yol: "/arac/takip",
    },
  ]

  const kartlar = tumKartlar.filter((k) => yetkiVar(kullanici, k.modul, "gor"))

  const kabulGorebilir = yetkiVar(kullanici, "kabul", "gor")
  const cariGorebilir = yetkiVar(kullanici, "cari", "gor")
  const aracGorebilir = yetkiVar(kullanici, "arac", "gor")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Günlük Faaliyet Özeti
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Hoş geldiniz {kullanici.ad} — {tarih(simdi)}
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="[&>*]:min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {kartlar.map((k) => (
            <IstatistikKart key={k.baslik} {...k} />
          ))}
        </div>

        {kabulGorebilir ? (
        <div className="mt-4 panel">
          <div className="panel-baslik">
            <h2 className="panel-baslik-yazi">Serviste Bekleyen Araçlar</h2>
            <span className="text-[0.75rem] text-muted-foreground">
              {bekleyenAraclar.length} kayıt
            </span>
          </div>

          {bekleyenAraclar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <CarFront className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                Şu anda serviste bekleyen araç yok
              </p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Araç kabul ekranından yeni bir iş emri açtığınızda burada
                listelenecek.
              </p>
            </div>
          ) : (
            <div className="tablo-sarmal">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kabul No</th>
                    <th>Plaka</th>
                    <th>Araç</th>
                    <th>Müşteri</th>
                    <th>Giriş</th>
                    <th>Tahmini Teslim</th>
                    <th className="text-right">Tutar</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {bekleyenAraclar.map((k) => (
                    <tr key={k.id}>
                      <td className="font-mono text-[0.75rem]">
                        <Link href={`/servis/kabul/${k.id}`} className="text-primary hover:underline">
                          {k.kabulNo}
                        </Link>
                      </td>
                      <td className="font-mono font-medium">
                        {aracGorebilir ? (
                          <Link href={`/arac/${k.arac.id}`} className="text-primary hover:underline">
                            {plaka(k.arac.plaka)}
                          </Link>
                        ) : (
                          plaka(k.arac.plaka)
                        )}
                      </td>
                      <td className="text-muted-foreground">
                        {[k.arac.marka, k.arac.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="max-w-[16rem] truncate">
                        {cariGorebilir ? (
                          <Link href={`/cari/${k.cari.id}`} className="text-primary hover:underline">
                            {k.cari.unvan}
                          </Link>
                        ) : (
                          k.cari.unvan
                        )}
                      </td>
                      <td>{tarih(k.girisTarihi)}</td>
                      <td>{tarih(k.tahminiTeslimTarihi)}</td>
                      <td className="text-right">{para(k.genelToplam)}</td>
                      <td>
                        <DurumRozeti durum={k.durum} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        ) : null}
      </div>
    </div>
  )
}

const DURUM_ETIKET: Record<string, { ad: string; sinif: string }> = {
  ACIK: { ad: "Açık", sinif: "bg-bilgi-yumusak text-bilgi" },
  BEKLEMEDE: { ad: "Beklemede", sinif: "bg-uyari-yumusak text-uyari" },
  TAMAMLANDI: { ad: "Tamamlandı", sinif: "bg-basari-yumusak text-basari" },
  TESLIM_EDILDI: { ad: "Teslim Edildi", sinif: "bg-muted text-muted-foreground" },
  IPTAL: { ad: "İptal", sinif: "bg-tehlike-yumusak text-tehlike" },
}

function DurumRozeti({ durum }: { durum: string }) {
  const e = DURUM_ETIKET[durum] ?? DURUM_ETIKET.ACIK
  return (
    <span
      className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${e.sinif}`}
    >
      {e.ad}
    </span>
  )
}
