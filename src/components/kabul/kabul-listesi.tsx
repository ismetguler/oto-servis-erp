import Link from "next/link"
import { AlertTriangle, ClipboardList, Plus } from "lucide-react"

import {
  formenleriGetir,
  kabulFiltreSorgusu,
  kabulListeKosulu,
  type KabulFiltreleri,
} from "@/app/(panel)/servis/kabul/veri"
import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import {
  kabulTahsilatOzetleri,
  type KabulTahsilatOzeti,
} from "@/app/(panel)/tahsilat/veri"
import { KabulFiltre } from "@/components/kabul/kabul-filtre"
import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { HizliTahsilat } from "@/components/tahsilat/hizli-tahsilat"
import { Button } from "@/components/ui/button"
import type { KabulDurum } from "@/generated/prisma/enums"
import { para, plaka as plakaBicim, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

const SAYFA_BOYU = 50

export const DURUM_ETIKETI: Record<KabulDurum, string> = {
  ACIK: "Açık",
  BEKLEMEDE: "Beklemede",
  TAMAMLANDI: "Tamamlandı",
  TESLIM_EDILDI: "Teslim Edildi",
  IPTAL: "İptal",
}

const DURUM_SINIFI: Record<KabulDurum, string> = {
  ACIK: "bg-primary/10 text-primary",
  BEKLEMEDE: "bg-vurgu/15 text-vurgu-koyu",
  TAMAMLANDI: "bg-basari-yumusak text-basari",
  TESLIM_EDILDI: "bg-muted text-muted-foreground",
  IPTAL: "bg-tehlike-yumusak text-tehlike",
}

export function DurumRozeti({ durum }: { durum: KabulDurum }) {
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${DURUM_SINIFI[durum]}`}
    >
      {DURUM_ETIKETI[durum]}
    </span>
  )
}

/**
 * Kabul listesi. Üç ekran ("Tüm Kabuller", "Açık Onarımlar", "Kapalı
 * Onarımlar") aynı listeyi farklı ön filtreyle gösteriyor — Selpar'da da
 * bunlar aynı ızgaranın hazır görünümleri.
 */
export async function KabulListesi({
  baslik,
  aciklama,
  yol,
  aramalar,
  durumSabit,
}: {
  baslik: string
  aciklama: string
  yol: string
  aramalar: KabulFiltreleri & { sayfa?: string }
  durumSabit?: boolean
}) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const filtre: KabulFiltreleri = {
    q: (aramalar.q ?? "").trim(),
    durum: aramalar.durum ?? "hepsi",
    bas: aramalar.bas ?? "",
    bit: aramalar.bit ?? "",
    formen: aramalar.formen ?? "",
    fatura: aramalar.fatura ?? "",
  }
  const sayfa = Math.max(1, Number(aramalar.sayfa ?? 1) || 1)
  const kosul = kabulListeKosulu(filtre)

  const [toplam, kayitlar, ozet, formenler] = await Promise.all([
    prisma.kabul.count({ where: kosul }),
    prisma.kabul.findMany({
      where: kosul,
      orderBy: { girisTarihi: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        kabulNo: true,
        durum: true,
        girisTarihi: true,
        tahminiTeslimTarihi: true,
        teslimTarihi: true,
        genelToplam: true,
        faturaKesildi: true,
        odendi: true,
        sikayet: true,
        arac: { select: { id: true, plaka: true, marka: true, model: true } },
        cari: {
          select: {
            id: true,
            unvan: true,
            karaListe: true,
            karaListeNedeni: true,
          },
        },
        formen: { select: { ad: true, soyad: true } },
        _count: { select: { kalemler: true } },
      },
    }),
    prisma.kabul.aggregate({ where: kosul, _sum: { genelToplam: true } }),
    formenleriGetir(),
  ])

  // Hızlı Tahsilat düğmesi için: kasa listesi bir kez, tahsilat özetleri tek
  // groupBy ile (satır başına sorgu 50 kat maliyet olurdu).
  const tahsilatYetkisi =
    yetkiVar(kullanici, "tahsilat", "ekle") && filtre.durum !== "silinen"
  const [ozetler, kasalar] = await Promise.all([
    kabulTahsilatOzetleri(kayitlar),
    tahsilatYetkisi ? secilebilirKasalar() : Promise.resolve([]),
  ])

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU))
  const ekleyebilir = yetkiVar(kullanici, "kabul", "ekle")
  // Bir Usta iş emri listesini görür ama "Kalan" / "Fatura / Tahsilat"
  // sütunları tahsilat modülüne bağlı — mekanikçi müşterinin ödeyip
  // ödemediğini görmez. Genel Toplam (işin değeri) açık kalıyor.
  const tahsilatGorebilir = yetkiVar(kullanici, "tahsilat", "gor")
  const cariGorebilir = yetkiVar(kullanici, "cari", "gor")
  const simdi = new Date()

  const sayfaYolu = (no: number) => {
    const parametre = new URLSearchParams(kabulFiltreSorgusu(filtre).replace(/^\?/, ""))
    if (no > 1) parametre.set("sayfa", String(no))
    const metin = parametre.toString()
    return metin ? `${yol}?${metin}` : yol
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">{baslik}</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            {aciklama} — {toplam} kart · toplam{" "}
            {para(ozet._sum.genelToplam ?? 0)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi
            yol={`/servis/kabul/disa-aktar${kabulFiltreSorgusu(filtre)}`}
          />
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/servis/kabul/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Araç Kabul
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <KabulFiltre
        yol={yol}
        q={filtre.q ?? ""}
        durum={filtre.durum ?? "hepsi"}
        bas={filtre.bas ?? ""}
        bit={filtre.bit ?? ""}
        formen={filtre.formen ?? ""}
        fatura={filtre.fatura ?? ""}
        formenler={formenler}
        durumSabit={durumSabit}
      />

      {/* md ÜSTÜ: tam tablo. Aynı `kayitlar` verisinden çiziliyor,
          mobil kart görünümü için ikinci bir sorgu YOK. */}
      <div className="tablo-sarmal hidden md:block">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[0.75rem] text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Kabul No</th>
              <th className="px-3 py-2 text-left font-medium">Durum</th>
              <th className="px-3 py-2 text-left font-medium">Plaka</th>
              <th className="px-3 py-2 text-left font-medium">Müşteri</th>
              <th className="px-3 py-2 text-left font-medium">Giriş</th>
              <th className="px-3 py-2 text-left font-medium">Tahmini Teslim</th>
              <th className="px-3 py-2 text-left font-medium">İlgilenecek Usta</th>
              <th className="px-3 py-2 text-right font-medium">Satır</th>
              <th className="px-3 py-2 text-right font-medium">Genel Toplam</th>
              {tahsilatGorebilir ? (
                <>
                  <th className="px-3 py-2 text-right font-medium">Kalan</th>
                  <th className="px-3 py-2 text-left font-medium">Fatura / Tahsilat</th>
                </>
              ) : null}
              <th className="px-3 py-2 text-right font-medium yazdirma-disi">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.length === 0 ? (
              <tr>
                <td colSpan={tahsilatGorebilir ? 12 : 10} className="px-3 py-12 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 size-8 opacity-40" aria-hidden />
                  Bu filtreye uyan kabul kartı yok.
                </td>
              </tr>
            ) : (
              kayitlar.map((k) => {
                const ozet = ozetler.get(k.id)
                const gecikti =
                  k.durum !== "TESLIM_EDILDI" &&
                  k.durum !== "IPTAL" &&
                  k.tahminiTeslimTarihi !== null &&
                  k.tahminiTeslimTarihi < simdi

                return (
                  <tr key={k.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/servis/kabul/${k.id}`} className="hover:underline">
                        {k.kabulNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <DurumRozeti durum={k.durum} />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/arac/${k.arac.id}`} className="hover:underline">
                        {plakaBicim(k.arac.plaka)}
                      </Link>
                      <span className="ml-1 text-[0.75rem] text-muted-foreground">
                        {[k.arac.marka, k.arac.model].filter(Boolean).join(" ")}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {cariGorebilir ? (
                        <Link href={`/cari/${k.cari.id}`} className="hover:underline">
                          {k.cari.unvan}
                        </Link>
                      ) : (
                        k.cari.unvan
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {tarihSaat(k.girisTarihi)}
                    </td>
                    <td className={`px-3 py-2 ${gecikti ? "text-tehlike" : "text-muted-foreground"}`}>
                      {k.tahminiTeslimTarihi ? (
                        <span className="inline-flex items-center gap-1">
                          {gecikti ? <AlertTriangle className="size-3.5" aria-hidden /> : null}
                          {tarihSaat(k.tahminiTeslimTarihi)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {k.formen ? [k.formen.ad, k.formen.soyad].filter(Boolean).join(" ") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{k._count.kalemler}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {para(k.genelToplam, false)}
                    </td>
                    {tahsilatGorebilir ? (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <KalanHucresi ozet={ozet} />
                        </td>
                        <td className="px-3 py-2 text-[0.75rem]">
                          <span className={k.faturaKesildi ? "text-basari" : "text-muted-foreground"}>
                            {k.faturaKesildi ? "Faturalı" : "Faturasız"}
                          </span>
                          {" · "}
                          <span className={tahsilatDurumu(ozet, k.odendi).sinif}>
                            {tahsilatDurumu(ozet, k.odendi).metin}
                          </span>
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-2 text-right yazdirma-disi">
                      {/* Silinmiş kartta fiş kesilemez; sunucu da reddediyor,
                          düğme boşuna görünmesin. */}
                      {tahsilatYetkisi && ozet ? (
                        <HizliTahsilat
                          kart={{
                            kabulId: k.id,
                            kabulNo: k.kabulNo,
                            cariUnvan: k.cari.unvan,
                            genelToplam: ozet.genelToplam,
                            tahsilEdilen: ozet.tahsilEdilen,
                            kalan: ozet.kalan,
                            karaListe: k.cari.karaListe,
                            karaListeNedeni: k.cari.karaListeNedeni,
                          }}
                          kasalar={kasalar}
                          boyut="icon"
                          gorunum="ghost"
                          sadeceSimge
                        />
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* md ALTI: satır yerine kart — plaka başlıkta, önemli 4 alan altta,
          kartın tamamı kabul kartına tıklanabilir. */}
      <div className="divide-y divide-border md:hidden">
        {kayitlar.length === 0 ? (
          <div className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 size-8 opacity-40" aria-hidden />
            Bu filtreye uyan kabul kartı yok.
          </div>
        ) : (
          kayitlar.map((k) => {
            const ozet = ozetler.get(k.id)
            return (
              <Link
                key={k.id}
                href={`/servis/kabul/${k.id}`}
                className="block px-4 py-3 active:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{plakaBicim(k.arac.plaka)}</div>
                    <div className="truncate text-[0.75rem] text-muted-foreground">
                      {[k.arac.marka, k.arac.model].filter(Boolean).join(" ")}
                    </div>
                  </div>
                  <DurumRozeti durum={k.durum} />
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
                  <div className="col-span-2 flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">Müşteri</dt>
                    <dd className="truncate">{k.cari.unvan}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">Kabul No</dt>
                    <dd className="truncate font-medium">{k.kabulNo}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">Giriş</dt>
                    <dd className="truncate">{tarihSaat(k.girisTarihi)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">Toplam</dt>
                    <dd className="tabular-nums font-medium">{para(k.genelToplam, false)}</dd>
                  </div>
                  {tahsilatGorebilir ? (
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-muted-foreground">Kalan</dt>
                      <dd className="tabular-nums">
                        <KalanHucresi ozet={ozet} />
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-1.5 text-[0.75rem]" hidden={!tahsilatGorebilir}>
                  <span className={k.faturaKesildi ? "text-basari" : "text-muted-foreground"}>
                    {k.faturaKesildi ? "Faturalı" : "Faturasız"}
                  </span>
                  {" · "}
                  <span className={tahsilatDurumu(ozet, k.odendi).sinif}>
                    {tahsilatDurumu(ozet, k.odendi).metin}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {sonSayfa > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[0.8125rem]">
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
    </div>
  )
}

/**
 * Tahsilat durumu `Kabul.odendi` BAYRAĞINDAN değil gerçek fişlerden okunuyor
 * (komisyon raporundaki ilkeyle aynı).
 *
 * Bayrak hem tahsilat kaydında otomatik yazılıyor hem de kart üstünden elle
 * işaretlenebiliyor; kartın kalemleri sonradan değişince kimse yeniden
 * hesaplamadığı için kayıyordu — tamamı tahsil edilmiş 7.074 TL'lik kart
 * listede "Tahsilat yok" görünüyordu. Özet zaten satır başına hesaplanıyor,
 * doğrusunu o söylüyor.
 */
function tahsilatDurumu(ozet: KabulTahsilatOzeti | undefined, elleIsaretli: boolean) {
  if (!ozet || ozet.genelToplam <= 0.005) {
    return { metin: "Tutar girilmedi", sinif: "text-muted-foreground" }
  }
  if (ozet.kalan < -0.005) {
    return { metin: "Fazla tahsilat", sinif: "text-uyari" }
  }
  if (ozet.kalan <= 0.005) {
    return { metin: "Tahsil edildi", sinif: "text-basari" }
  }
  if (ozet.tahsilEdilen > 0.005) {
    return { metin: "Kısmi tahsilat", sinif: "text-uyari" }
  }
  // Fiş yok ama kullanıcı kartı elle "Tahsil Edildi" işaretlemiş: parayı
  // sistem dışında almış olabilir, bu işaret yok sayılmasın.
  if (elleIsaretli) {
    return { metin: "Tahsil edildi (elle)", sinif: "text-basari" }
  }
  return { metin: "Tahsilat yok", sinif: "text-tehlike" }
}

/** Kalan sütunu — fazla tahsilat sessizce "—" görünmesin. */
function KalanHucresi({ ozet }: { ozet: KabulTahsilatOzeti | undefined }) {
  if (ozet && ozet.kalan > 0.005) {
    return <span className="text-tehlike">{para(ozet.kalan, false)}</span>
  }
  if (ozet && ozet.kalan < -0.005) {
    return (
      <span className="text-uyari">{para(Math.abs(ozet.kalan), false)} fazla</span>
    )
  }
  return <span className="text-muted-foreground">—</span>
}
