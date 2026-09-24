import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  FileText,
  History,
  Pencil,
  ShieldAlert,
} from "lucide-react"

import { personelleriGetir } from "../veri"
import { kabulunFaturasi } from "@/app/(panel)/evrak/satis/veri"
import { uygulanabilirPaketler } from "../../bakim-paketi/veri"
import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import { kabulTahsilatlari, kabulTahsilatOzeti } from "@/app/(panel)/tahsilat/veri"
import { ODEME_SEKLI_ADI, TUR_ADI } from "@/app/(panel)/tahsilat/veri"
import { KabulIslemleri } from "@/components/kabul/kabul-islemleri"
import { DurumRozeti } from "@/components/kabul/kabul-listesi"
import { KalemTablosu, type KalemSatiri } from "@/components/kabul/kalem-tablosu"
import { HizliTahsilat } from "@/components/tahsilat/hizli-tahsilat"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { para, plaka as plakaBicim, tarih, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Kabul Kartı" }
export const dynamic = "force-dynamic"

export default async function KabulKarti({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const [kabul, personeller, paketKayitlari] = await Promise.all([
    prisma.kabul.findUnique({
      where: { id: kayitId },
      include: {
        cari: {
          select: {
            id: true,
            kod: true,
            unvan: true,
            yetkili: true,
            telefon: true,
            gsm: true,
            vergiNo: true,
            bakiye: true,
            karaListe: true,
            karaListeNedeni: true,
            notu: true,
          },
        },
        arac: true,
        formen: { select: { ad: true, soyad: true } },
        olusturan: { select: { ad: true, soyad: true } },
        personeller: { select: { personel: { select: { id: true, unvan: true } } } },
        kalemler: { orderBy: { sira: "asc" } },
      },
    }),
    personelleriGetir(),
    uygulanabilirPaketler(),
  ])
  if (!kabul) notFound()

  // Hızlı Tahsilat paneli: yetki yoksa hiç sorgulanmıyor.
  const tahsilatYetkisi = yetkiVar(kullanici, "tahsilat", "ekle") && !kabul.silindi
  const [tahsilatOzeti, tahsilatFisleri, kasalar, fatura] = await Promise.all([
    kabulTahsilatOzeti(kabul.id),
    kabulTahsilatlari(kabul.id),
    tahsilatYetkisi ? secilebilirKasalar() : Promise.resolve([]),
    // Bu karta bağlı geçerli fatura (adım 9.2): düğme "dönüştür" mü olacak
    // yoksa faturaya bağlantı mı, buradan belli oluyor.
    kabulunFaturasi(kabul.id),
  ])

  const duzeltebilir = yetkiVar(kullanici, "kabul", "duzelt") && !kabul.silindi
  const silebilir = yetkiVar(kullanici, "kabul", "sil")
  // Bir Usta iş emrini görebilir ama müşterinin cari bakiyesini / tahsilat
  // dökümünü (fişler, kasa adları, kalan) görmemeli — bunlar cari/tahsilat
  // modülüne bağlı. Kart toplamı ve kalemler işin kendisi, onlar açık kalıyor.
  const cariGorebilir = yetkiVar(kullanici, "cari", "gor")
  const tahsilatGorebilir = yetkiVar(kullanici, "tahsilat", "gor")
  const kapali = kabul.durum === "TESLIM_EDILDI"
  const simdi = new Date()

  // Prisma Decimal'ler istemci bileşenine geçemez (serialize edilemez) —
  // sınırda düz sayıya çevriliyor.
  const kalemler: KalemSatiri[] = kabul.kalemler.map((k) => ({
    id: k.id,
    sira: k.sira,
    tur: k.tur,
    stokId: k.stokId,
    iscilikId: k.iscilikId,
    personelId: k.personelId,
    aciklama: k.aciklama,
    birim: k.birim,
    miktar: Number(k.miktar.toString()),
    birimFiyat: Number(k.birimFiyat.toString()),
    kdvOrani: Number(k.kdvOrani.toString()),
    garantili: k.garantili,
  }))

  const paketler = paketKayitlari.map((p) => ({
    id: p.id,
    kod: p.kod,
    ad: p.ad,
    km: p.km,
    marka: p.marka,
    aracTuru: p.aracTuru,
    satirSayisi: p._count.kalemler,
  }))

  const gecikti =
    !kapali &&
    kabul.durum !== "IPTAL" &&
    kabul.tahminiTeslimTarihi !== null &&
    kabul.tahminiTeslimTarihi < simdi

  const takipler: [string, Date | null][] = [
    ["Trafik Sigortası", kabul.arac.trafikSigBitis],
    ["Kasko", kabul.arac.kaskoBitis],
    ["Garanti", kabul.arac.garantiBitis],
    ["Muayene", kabul.arac.muayeneBitis],
    ["Akü", kabul.arac.akuBitis],
    ["LPG Tank", kabul.arac.lpgTankSonTarih],
  ]

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/servis/kabul" aria-label="Kabul listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              {kabul.kabulNo}
              <DurumRozeti durum={kabul.durum} />
              {kabul.silindi ? (
                <span className="rounded-sm bg-tehlike-yumusak px-1.5 py-0.5 text-[0.6875rem] text-tehlike">
                  SİLİNDİ
                </span>
              ) : null}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              <Link href={`/arac/${kabul.arac.id}`} className="text-primary hover:underline">
                {plakaBicim(kabul.arac.plaka)}
              </Link>{" "}
              · {[kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ") || "—"} ·{" "}
              <Link href={`/cari/${kabul.cari.id}`} className="text-primary hover:underline">
                {kabul.cari.unvan}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Aynı aracın geçmişi tek tıkla: "bu işi daha önce yapmış mıyız"
              sorusu kabul kartındayken soruluyor. Bu kartın kendisi listeye
              girmesin diye `haric` ile dışarıda bırakılıyor. */}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/servis/onceki?aracId=${kabul.aracId}&haric=${kabul.id}`}>
              <History className="size-4" aria-hidden />
              Önceki Onarımlar
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="size-4" aria-hidden />
                Yazdır
                <ChevronDown className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/baski/kabul-karti/${kabul.id}`} target="_blank">
                  Kabul Kartı
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/baski/kabul-formu/${kabul.id}`} target="_blank">
                  Kabul Formu (Araç Teslim Alınırken)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/baski/hesap-dokumu/${kabul.id}`} target="_blank">
                  Hesap Dökümü
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/baski/teslim-formu/${kabul.id}`} target="_blank">
                  Teslim Formu (Araç Teslim Edilirken)
                </Link>
              </DropdownMenuItem>
              {/* 11.9 — YALNIZ dış hizmet satırlarının dökümü. Kabul
                  Kartı'ndan farkı o TÜM kalemleri basıyor, bu sadece
                  dışarıya yaptırılan işleri (kâğıt sağlayıcıya gidiyor). */}
              <DropdownMenuItem asChild>
                <Link href={`/baski/dis-hizmet/${kabul.id}`} target="_blank">
                  Dış Hizmet Formu
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {duzeltebilir && !kapali ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/servis/kabul/${kabul.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5 yazdirma-disi">
        <KabulIslemleri
          kabulId={kabul.id}
          durum={kabul.durum}
          silinmis={kabul.silindi}
          faturaKesildi={kabul.faturaKesildi}
          odendi={kabul.odendi}
          kabulNo={kabul.kabulNo}
          genelToplam={tahsilatOzeti.genelToplam}
          duzeltebilir={duzeltebilir}
          silebilir={silebilir}
          fatura={fatura ? { id: fatura.id, evrakNo: fatura.evrakNo } : null}
        />
        {tahsilatYetkisi ? (
          <HizliTahsilat
            kart={{
              kabulId: kabul.id,
              kabulNo: kabul.kabulNo,
              cariUnvan: kabul.cari.unvan,
              genelToplam: tahsilatOzeti.genelToplam,
              tahsilEdilen: tahsilatOzeti.tahsilEdilen,
              kalan: tahsilatOzeti.kalan,
              karaListe: kabul.cari.karaListe,
              karaListeNedeni: kabul.cari.karaListeNedeni,
            }}
            kasalar={kasalar}
          />
        ) : null}
      </div>

      {gecikti ? (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Tahmini teslim tarihi geçti ({tarihSaat(kabul.tahminiTeslimTarihi)}).
        </div>
      ) : null}

      {kabul.cari.karaListe ? (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          Bu müşteri kara listede.
        </div>
      ) : null}

      <div className="[&>*]:min-w-0 grid gap-3 p-4 lg:grid-cols-3">
        <Kutu baslik="Kabul Bilgileri" genis>
          <BilgiIzgarasi
            satirlar={[
              ["Kart Türü", kabul.kartTuru],
              ["Özel Kabul No", kabul.kabulOzelNo],
              ["Giriş", tarihSaat(kabul.girisTarihi)],
              ["Giriş Km", kabul.girisKm?.toLocaleString("tr-TR")],
              ["Tahmini Teslim", tarihSaat(kabul.tahminiTeslimTarihi)],
              ["Teslim Tarihi", tarihSaat(kabul.teslimTarihi)],
              [
                "İlgilenecek Usta",
                kabul.formen ? [kabul.formen.ad, kabul.formen.soyad].filter(Boolean).join(" ") : null,
              ],
              ["İstek Türü", kabul.istekTuru],
              ["Bakım Şekli", kabul.bakimSekli],
              ["Proje", kabul.projesi],
              ["Filo Şirketi", kabul.filoSirketi],
              ["Tahmini Tutar", para(kabul.tahminiTutar)],
              ["Evrak KDV Oranı", `%${Number(kabul.evrakKdvOrani.toString())}`],
              ["Fiyat Girişi", kabul.kdvDahilGirilir ? "KDV dahil" : "KDV hariç"],
              ["Sonraki Geliş", tarih(kabul.sonrakiGelisTarihi)],
              ["Sonraki Geliş Km", kabul.sonrakiGelisKm?.toLocaleString("tr-TR")],
              [
                "Kartta Çalışanlar",
                kabul.personeller.map((p) => p.personel.unvan).join(", ") || null,
              ],
            ]}
          />

          <MetinBloklari
            bloklar={[
              ["Müşteri Şikâyeti", kabul.sikayet],
              ["Yapılan İşler", kabul.yapilanIsler],
              ["Araçtaki Özel Eşya", kabul.ozelEsya],
              ["Araca Ait Notlar", kabul.aracNotlari],
              ["Cari Notu", kabul.cariNotu],
              ["Teslim Notu", kabul.teslimNotu],
            ]}
          />
        </Kutu>

        <div className="flex flex-col gap-3">
          <Kutu baslik="Araç">
            <BilgiIzgarasi
              tekSutun
              satirlar={[
                ["Plaka", plakaBicim(kabul.arac.plaka)],
                ["Marka / Model", [kabul.arac.marka, kabul.arac.model].filter(Boolean).join(" ")],
                ["Model Yılı", kabul.arac.modelYili],
                ["Renk", kabul.arac.renk],
                ["Şase No", kabul.arac.saseNo],
                ["Yakıt / Vites", [kabul.arac.yakitTuru, kabul.arac.vitesTuru].filter(Boolean).join(" / ")],
                ["Kayıtlı Son Km", kabul.arac.sonKm?.toLocaleString("tr-TR")],
              ]}
            />
            <Link
              href={`/arac/${kabul.arac.id}`}
              className="mt-2 inline-block text-[0.75rem] text-primary hover:underline"
            >
              Araç kartını aç →
            </Link>
          </Kutu>

          <Kutu baslik="Garanti / Sigorta">
            <BilgiIzgarasi
              tekSutun
              satirlar={takipler.map(([etiket, deger]) => [
                etiket,
                deger ? `${tarih(deger)}${deger < simdi ? " · SÜRESİ GEÇTİ" : ""}` : null,
              ])}
            />
          </Kutu>

          <Kutu baslik="Müşteri">
            <BilgiIzgarasi
              tekSutun
              satirlar={[
                ["Cari Kodu", kabul.cari.kod],
                ["Ünvan", kabul.cari.unvan],
                ["Yetkili", kabul.cari.yetkili],
                ["Telefon", kabul.cari.telefon],
                ["GSM", kabul.cari.gsm],
                ["VKN / TCKN", kabul.cari.vergiNo],
                ...(cariGorebilir
                  ? ([["Bakiye", para(kabul.cari.bakiye)]] as [string, string][])
                  : []),
                ["Cari Notu", kabul.cari.notu],
              ]}
            />
            {cariGorebilir ? (
              <Link
                href={`/cari/${kabul.cari.id}/ekstre`}
                className="mt-2 inline-block text-[0.75rem] text-primary hover:underline"
              >
                Cari ekstresini aç →
              </Link>
            ) : null}
          </Kutu>

          {/* Bu kartın parası: kart toplamı ile kesilmiş fişlerin farkı.
              Cari bakiyesinden ayrı bir bilgi — müşterinin başka kartlardan
              da borcu olabilir, buradaki "kalan" yalnız bu iş emrini anlatır.
              Tahsilat modülüne yetkisi olmayan (ör. Usta) bu kutuyu görmez. */}
          {tahsilatGorebilir ? (
          <Kutu baslik="Tahsilat">
            <BilgiIzgarasi
              tekSutun
              satirlar={[
                ["Kart Toplamı", para(tahsilatOzeti.genelToplam)],
                ["Tahsil Edilen", para(tahsilatOzeti.tahsilEdilen)],
                [
                  "Kalan",
                  `${para(tahsilatOzeti.kalan)}${tahsilatOzeti.kalan > 0.005 ? " · AÇIK" : ""}`,
                ],
              ]}
            />

            {tahsilatFisleri.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-[0.75rem]">
                {tahsilatFisleri.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <Link href={`/tahsilat/${f.id}`} className="text-primary hover:underline">
                      {f.fisNo}
                    </Link>
                    <span className="text-muted-foreground">
                      {tarih(f.tarih)} · {ODEME_SEKLI_ADI[f.odemeSekli]}
                      {f.kasaAd ? ` · ${f.kasaAd}` : ""}
                    </span>
                    <span
                      className={`tabular-nums ${f.tur === "TAHSILAT" ? "text-basari" : "text-tehlike"}`}
                    >
                      {f.tur === "TEDIYE" ? "-" : ""}
                      {para(f.tutar, false)}
                      <span className="sr-only"> {TUR_ADI[f.tur]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
                Bu karta bağlı tahsilat fişi yok.
              </p>
            )}
          </Kutu>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-4">
        <KalemTablosu
          kabulId={kabul.id}
          kalemler={kalemler}
          kdvDahilGirilir={kabul.kdvDahilGirilir}
          varsayilanKdv={Number(kabul.evrakKdvOrani.toString())}
          personeller={personeller}
          paketler={paketler}
          duzenlenebilir={duzeltebilir && !kapali}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[0.75rem] text-muted-foreground yazdirma-disi">
        <History className="size-3.5" aria-hidden />
        Kartı açan:{" "}
        {kabul.olusturan
          ? [kabul.olusturan.ad, kabul.olusturan.soyad].filter(Boolean).join(" ")
          : "—"}{" "}
        · Oluşturma: {tarihSaat(kabul.olusturmaTarihi)} · Son güncelleme:{" "}
        {tarihSaat(kabul.guncellemeTarihi)}
      </div>
    </div>
  )
}

function Kutu({
  baslik,
  genis,
  children,
}: {
  baslik: string
  genis?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-md border border-border bg-card ${genis ? "lg:col-span-2" : ""}`}
    >
      <h2 className="border-b border-border px-3 py-2 text-[0.8125rem] font-semibold">
        {baslik}
      </h2>
      <div className="p-3">{children}</div>
    </section>
  )
}

function BilgiIzgarasi({
  satirlar,
  tekSutun,
}: {
  satirlar: [string, string | number | null | undefined][]
  tekSutun?: boolean
}) {
  return (
    <dl
      className={`grid gap-x-6 gap-y-1 ${tekSutun ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}
    >
      {satirlar.map(([etiket, deger]) => (
        <div
          key={etiket}
          className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0"
        >
          <dt className="text-[0.75rem] text-muted-foreground">{etiket}</dt>
          <dd
            className={`text-right text-[0.8125rem] font-medium ${
              String(deger ?? "").includes("GEÇTİ") ? "text-tehlike" : ""
            }`}
          >
            {deger === null || deger === undefined || deger === "" ? "—" : deger}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MetinBloklari({ bloklar }: { bloklar: [string, string | null][] }) {
  const dolu = bloklar.filter(([, deger]) => deger)
  if (dolu.length === 0) return null

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {dolu.map(([etiket, deger]) => (
        <div key={etiket} className="rounded-sm bg-muted/40 p-2">
          <p className="text-[0.6875rem] font-medium text-muted-foreground">{etiket}</p>
          <p className="whitespace-pre-wrap text-[0.8125rem]">{deger}</p>
        </div>
      ))}
    </div>
  )
}
