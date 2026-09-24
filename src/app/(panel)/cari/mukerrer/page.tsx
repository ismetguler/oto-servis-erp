import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, CopyCheck, Merge } from "lucide-react"

import { CARI_TUR_ADLARI } from "../sema"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { para, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Aynı Cari İki Kez Açılmış mı" }
export const dynamic = "force-dynamic"

/**
 * MÜKERRER CARİ KONTROLÜ (Selpar: "VKN Aynı Olanlar")
 *
 * Aynı müşteri farklı kişilerce iki kez açıldığında bakiyesi ikiye bölünür
 * ve hiçbir rapor doğru çıkmaz. Bu ekran çakışmaları erken yakalar:
 *  - aynı VKN/TCKN ile açılmış kayıtlar
 *  - aynı ünvanla açılmış kayıtlar
 *  - aynı telefon numarasıyla açılmış kayıtlar
 *
 * Otomatik birleştirme YAPILMIYOR: hangisinin doğru kayıt olduğuna insan
 * karar vermeli, yanlış birleştirme geri alınamaz. Ekran yalnızca çakışmayı
 * gösterir ve /cari/birlestir ekranını iki kayıt seçili olarak açar.
 */
export default async function MukerrerKontrol() {
  const kullanici = await yetkiliOturum("cari", "gor")
  // Birleştirme silme yetkisi ister: bir kartı kapatıyor ve geri alınamıyor.
  const birlestirebilir = yetkiVar(kullanici, "cari", "sil")

  // Gruplama SQL tarafında yapılıyor: binlerce cariyi belleğe çekip
  // JavaScript'te karşılaştırmak gereksiz yere yavaş olurdu.
  const [vknGruplari, unvanGruplari, telefonGruplari] = await Promise.all([
    prisma.$queryRaw<{ deger: string; adet: bigint }[]>`
      SELECT "vergiNo" AS deger, COUNT(*)::bigint AS adet
      FROM cariler
      WHERE silindi = false AND "vergiNo" IS NOT NULL AND "vergiNo" <> ''
      GROUP BY "vergiNo" HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC`,
    prisma.$queryRaw<{ deger: string; adet: bigint }[]>`
      SELECT upper(unvan) AS deger, COUNT(*)::bigint AS adet
      FROM cariler
      WHERE silindi = false
      GROUP BY upper(unvan) HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC`,
    prisma.$queryRaw<{ deger: string; adet: bigint }[]>`
      SELECT numara AS deger, COUNT(*)::bigint AS adet FROM (
        SELECT regexp_replace(COALESCE(NULLIF(gsm, ''), telefon), '[^0-9]', '', 'g') AS numara
        FROM cariler
        WHERE silindi = false
          AND COALESCE(NULLIF(gsm, ''), telefon) IS NOT NULL
      ) t
      WHERE length(numara) >= 10
      GROUP BY numara HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC`,
  ])

  const vknDegerleri = vknGruplari.map((g) => g.deger)
  const unvanDegerleri = unvanGruplari.map((g) => g.deger)

  const [vknKayitlari, unvanKayitlari] = await Promise.all([
    vknDegerleri.length
      ? prisma.cari.findMany({
          where: { silindi: false, vergiNo: { in: vknDegerleri } },
          orderBy: [{ vergiNo: "asc" }, { id: "asc" }],
          select: secim,
        })
      : Promise.resolve([]),
    unvanDegerleri.length
      ? prisma.cari.findMany({
          where: { silindi: false },
          orderBy: { unvan: "asc" },
          select: secim,
        })
      : Promise.resolve([]),
  ])

  // Ünvan karşılaştırması SQL'de büyük harfe çevrilerek yapıldığı için
  // eşleşen kayıtları burada da aynı şekilde süzüyoruz.
  const unvanKumesi = new Set(unvanDegerleri)
  const unvanEslesenler = unvanKayitlari.filter((c) =>
    unvanKumesi.has(c.unvan.toLocaleUpperCase("tr-TR"))
  )

  const toplamSorun =
    vknGruplari.length + unvanGruplari.length + telefonGruplari.length

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">
            Aynı Cari İki Kez Açılmış mı
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Aynı müşterinin iki kez açılmış olabileceği kayıtlar
          </p>
        </div>
        <YazdirDugmesi />
      </div>

      <div className="flex flex-col gap-4 p-4">
        {toplamSorun === 0 ? (
          <div className="panel flex flex-col items-center gap-2 px-4 py-16 text-center">
            <CheckCircle2 className="size-8 text-basari" aria-hidden />
            <p className="text-[0.875rem] font-medium">Mükerrer kayıt bulunamadı</p>
            <p className="max-w-md text-[0.8125rem] text-muted-foreground">
              Vergi numarası, ünvan ve telefon bazında çakışan cari yok.
              Bu ekranı zaman zaman tekrar kontrol edin.
            </p>
          </div>
        ) : (
          <>
            <Kutu
              baslik="Aynı Vergi No / TCKN"
              adet={vknGruplari.length}
              aciklama="Kesin çakışma sayılır: aynı vergi numarası tek bir mükellefe aittir."
            >
              {vknGruplari.map((g) => (
                <Grup
                  key={g.deger}
                  etiket={g.deger}
                  adet={Number(g.adet)}
                  kayitlar={vknKayitlari.filter((c) => c.vergiNo === g.deger)}
                  birlestirebilir={birlestirebilir}
                />
              ))}
            </Kutu>

            <Kutu
              baslik="Aynı Ünvan"
              adet={unvanGruplari.length}
              aciklama="Büyük/küçük harf farkı dikkate alınmadan karşılaştırılır."
            >
              {unvanGruplari.map((g) => (
                <Grup
                  key={g.deger}
                  etiket={g.deger}
                  adet={Number(g.adet)}
                  kayitlar={unvanEslesenler.filter(
                    (c) => c.unvan.toLocaleUpperCase("tr-TR") === g.deger
                  )}
                  birlestirebilir={birlestirebilir}
                />
              ))}
            </Kutu>

            <Kutu
              baslik="Aynı Telefon"
              adet={telefonGruplari.length}
              aciklama="Rakam dışı karakterler yok sayılarak karşılaştırılır. Aile bireyleri aynı numarayı kullanıyor olabilir — kontrol edin."
            >
              {telefonGruplari.length === 0 ? null : (
                <ul className="divide-y divide-border/70">
                  {telefonGruplari.map((g) => (
                    <li
                      key={g.deger}
                      className="flex items-center justify-between px-3.5 py-2 text-[0.8125rem]"
                    >
                      <span className="font-mono">{g.deger}</span>
                      <Link
                        href={`/cari?q=${g.deger}`}
                        className="text-primary hover:underline"
                      >
                        {Number(g.adet)} kayıt — listede gör
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Kutu>
          </>
        )}
      </div>
    </div>
  )
}

const secim = {
  id: true,
  kod: true,
  unvan: true,
  turu: true,
  vergiNo: true,
  gsm: true,
  telefon: true,
  bakiye: true,
  olusturmaTarihi: true,
} as const

type Kayit = {
  id: number
  kod: string
  unvan: string
  turu: keyof typeof CARI_TUR_ADLARI
  vergiNo: string | null
  gsm: string | null
  telefon: string | null
  bakiye: { toString(): string }
  olusturmaTarihi: Date
}

function Kutu({
  baslik,
  adet,
  aciklama,
  children,
}: {
  baslik: string
  adet: number
  aciklama: string
  children: React.ReactNode
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-baslik">
        <h2 className="panel-baslik-yazi">{baslik}</h2>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${
            adet > 0
              ? "bg-uyari-yumusak text-uyari"
              : "bg-basari-yumusak text-basari"
          }`}
        >
          {adet} çakışma
        </span>
      </div>
      <p className="border-b border-border/70 px-3.5 py-2 text-[0.75rem] text-muted-foreground">
        {aciklama}
      </p>
      {adet === 0 ? (
        <p className="px-3.5 py-6 text-center text-[0.8125rem] text-muted-foreground">
          Çakışma yok.
        </p>
      ) : (
        children
      )}
    </div>
  )
}

function Grup({
  etiket,
  adet,
  kayitlar,
  birlestirebilir,
}: {
  etiket: string
  adet: number
  kayitlar: Kayit[]
  birlestirebilir: boolean
}) {
  // İki kayıtlık çakışmada hedef ÖNCE açılan kart: geçmişi ve büyük ihtimalle
  // evrakları onda, sonradan açılan kopya kapanmalı. Kullanıcı birleştirme
  // ekranında yönü tek tıkla çevirebiliyor, bu sadece makul bir ön seçim.
  const sirali = [...kayitlar].sort(
    (a, b) => a.olusturmaTarihi.getTime() - b.olusturmaTarihi.getTime()
  )
  const ciftYolu =
    birlestirebilir && sirali.length === 2
      ? `/cari/birlestir?kaynak=${sirali[1].id}&hedef=${sirali[0].id}`
      : null

  return (
    <div className="border-b border-border/70 last:border-b-0">
      <div className="flex items-center gap-2 bg-secondary/40 px-3.5 py-1.5 text-[0.75rem]">
        <CopyCheck className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="font-mono font-medium">{etiket}</span>
        <span className="text-muted-foreground">— {adet} kayıt</span>
        {ciftYolu ? (
          <Link
            href={ciftYolu}
            className="ml-auto inline-flex items-center gap-1 rounded-sm border border-input bg-background px-2 py-0.5 font-medium hover:bg-accent"
          >
            <Merge className="size-3" aria-hidden />
            Birleştir
          </Link>
        ) : null}
      </div>
      {/* Birleştir sütunuyla birlikte tablo dar ekranlarda taşıyor; panel
          "overflow-hidden" olduğu için kırpılmasın diye kendi içinde kayıyor. */}
      <div className="tablo-sarmal">
      <table className="veri-tablosu">
        <tbody>
          {kayitlar.map((c) => (
            <tr key={c.id}>
              <td className="w-28 font-mono text-[0.75rem]">
                <Link href={`/cari/${c.id}`} className="text-primary hover:underline">
                  {c.kod}
                </Link>
              </td>
              <td className="font-medium">{c.unvan}</td>
              <td className="w-28 text-muted-foreground">
                {CARI_TUR_ADLARI[c.turu]}
              </td>
              <td className="w-36">{c.gsm ?? c.telefon ?? "—"}</td>
              <td className="w-40 text-muted-foreground">
                {tarihSaat(c.olusturmaTarihi)}
              </td>
              <td className="w-32 text-right font-medium">
                {para(Math.abs(Number(c.bakiye.toString())))}
              </td>
              <td className="w-20 text-right">
                {birlestirebilir ? (
                  <Link
                    href={`/cari/birlestir?kaynak=${c.id}`}
                    className="text-[0.75rem] text-primary hover:underline"
                    title="Bu kaydı kapatıp başka bir karta taşı"
                  >
                    birleştir
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
