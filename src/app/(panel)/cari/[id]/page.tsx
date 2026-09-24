import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Ban, Banknote, CarFront, FileText, Minus, Pencil, Plus } from "lucide-react"

import { CARI_TIP_ADLARI, CARI_TUR_ADLARI } from "../sema"
import { cariKaraListeGecmisi } from "../kara-liste/veri"
import { cariAlisKalemleriGetir } from "../../evrak/alis/veri"
import { cariFiloSozlesmeleriGetir } from "../filo/veri"
import { FiloSozlesmeleri } from "@/components/cari/filo-sozlesmeleri"
import { CariSilDugmesi } from "@/components/cari/cari-sil-dugmesi"
import { HareketIslemi } from "@/components/cari/hareket-islemi"
import { KaraListeIslemi } from "@/components/cari/kara-liste-islemi"
import { Button } from "@/components/ui/button"
import { para, plaka, tarih, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Cari Kartı" }
export const dynamic = "force-dynamic"

export default async function CariKarti({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const cari = await prisma.cari.findUnique({
    where: { id: kayitId },
    include: {
      // Plasiyer, cari tablosunun kendi kendine referansı (turu = PERSONEL
      // olan bir cari). İlişki üzerinden okunuyor: eskiden ünvan için ayrı
      // bir sorgu atılıyordu, artık gerekmiyor.
      plasiyer: { select: { id: true, unvan: true } },
      araclar: {
        where: { silindi: false },
        orderBy: { plaka: "asc" },
        take: 20,
        select: {
          id: true,
          plaka: true,
          marka: true,
          model: true,
          modelYili: true,
          sonKm: true,
        },
      },
      hareketler: {
        where: { silindi: false },
        orderBy: [{ tarih: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          tarih: true,
          tur: true,
          borc: true,
          alacak: true,
          aciklama: true,
          tahsilatId: true,
          kabulId: true,
          cekSenetId: true,
          evrak: { select: { id: true, tur: true } },
        },
      },
      _count: { select: { araclar: true, kabuller: true, evraklar: true } },
    },
  })
  if (!cari) notFound()

  const karaListeGecmisi = await cariKaraListeGecmisi(cari.id)
  // SA-3.1: "kimden ne aldık" — bu cariye kesilmiş alış faturalarının kalemleri.
  const alisKalemleri = await cariAlisKalemleriGetir(cari.id)
  // SA-3.3: filo sözleşmeleri (personel kartında gösterilmiyor — anlamsız).
  const filoSozlesmeleri =
    cari.turu === "PERSONEL" ? [] : await cariFiloSozlesmeleriGetir(cari.id)

  const bakiye = Number(cari.bakiye.toString())
  const duzeltebilir = yetkiVar(kullanici, "cari", "duzelt") && !cari.silindi
  const silebilir = yetkiVar(kullanici, "cari", "sil")
  const aracDuzeltebilir = yetkiVar(kullanici, "arac", "duzelt")
  const tahsilatEkleyebilir = yetkiVar(kullanici, "tahsilat", "ekle") && !cari.silindi

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cari" aria-label="Cari listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              {cari.unvan}
              {cari.karaListe ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-tehlike-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-tehlike">
                  <Ban className="size-3" aria-hidden />
                  Kara liste
                </span>
              ) : null}
              {cari.silindi ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  Silinmiş
                </span>
              ) : !cari.aktif ? (
                <span className="rounded-sm bg-uyari-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-uyari">
                  Pasif
                </span>
              ) : null}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              <span className="font-mono">{cari.kod}</span> ·{" "}
              {CARI_TUR_ADLARI[cari.turu]} · {CARI_TIP_ADLARI[cari.tipi]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cari/${cari.id}/ekstre`}>
              <FileText className="size-4" aria-hidden />
              Ekstre
            </Link>
          </Button>
          {/* Tahsilat/ödeme cari kartından tek tıkla açılır; cari önceden
              seçili gelir (?cari=) — kasadaki en sık iş bu. */}
          {tahsilatEkleyebilir ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tahsilat/yeni?cari=${cari.id}`}>
                  <Banknote className="size-4" aria-hidden />
                  Tahsilat Gir
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tahsilat/odeme?cari=${cari.id}`}>
                  <Minus className="size-4" aria-hidden />
                  Ödeme Gir
                </Link>
              </Button>
            </>
          ) : null}
          {duzeltebilir ? (
            <Button size="sm" asChild>
              <Link href={`/cari/${cari.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
          {duzeltebilir ? (
            <KaraListeIslemi
              cariId={cari.id}
              unvan={cari.unvan}
              karaListede={cari.karaListe}
            />
          ) : null}
          {silebilir ? (
            <CariSilDugmesi
              id={cari.id}
              silinmis={cari.silindi}
              unvan={cari.unvan}
            />
          ) : null}
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-3">
        {/* Sol sütun: bakiye özeti + bilgi panelleri */}
        <div className="flex flex-col gap-4">
          <div className="panel p-3.5">
            <div className="text-[0.75rem] font-medium text-muted-foreground">
              Güncel Bakiye
            </div>
            <div
              className={`rakam mt-1 text-[1.75rem] font-bold leading-none ${
                bakiye > 0
                  ? "text-tehlike"
                  : bakiye < 0
                    ? "text-basari"
                    : "text-foreground"
              }`}
            >
              {para(Math.abs(bakiye))}
            </div>
            <div className="mt-1.5 text-[0.75rem] text-muted-foreground">
              {bakiye > 0
                ? "Borçlu bakiye"
                : bakiye < 0
                  ? "Alacaklı bakiye"
                  : "Bakiye kapalı"}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <Sayac etiket="Araç" deger={cari._count.araclar} />
              <Sayac etiket="Kabul" deger={cari._count.kabuller} />
              <Sayac etiket="Evrak" deger={cari._count.evraklar} />
            </div>
          </div>

          <Panel baslik="İletişim" duzenleYolu={duzeltebilir ? `/cari/${cari.id}/duzenle?sekme=iletisim` : null}>
            <Satir etiket="Yetkili" deger={cari.yetkili} />
            <Satir etiket="Yetkili Tel." deger={cari.yetkiliTelefon} />
            <Satir etiket="Telefon" deger={cari.telefon} />
            <Satir etiket="Cep" deger={cari.gsm} />
            <Satir etiket="E-Posta" deger={cari.email} />
            <Satir
              etiket="Adres"
              deger={
                [cari.adres, [cari.ilce, cari.il].filter(Boolean).join(" / ")]
                  .filter(Boolean)
                  .join(" — ") || null
              }
            />
            <Satir etiket="Sorumlu Personel" deger={cari.plasiyer?.unvan ?? null} />
          </Panel>

          <Panel baslik="Vergi / Banka" duzenleYolu={duzeltebilir ? `/cari/${cari.id}/duzenle?sekme=genel` : null}>
            <Satir etiket="VKN / TCKN" deger={cari.vergiNo} tekTip />
            <Satir etiket="Vergi Dairesi" deger={cari.vergiDair} />
            <Satir etiket="Banka" deger={cari.banka} />
            <Satir etiket="Şube" deger={cari.bankaSube} />
            <Satir etiket="IBAN" deger={cari.ibanNo} tekTip />
          </Panel>

          <Panel baslik="Diğer" duzenleYolu={duzeltebilir ? `/cari/${cari.id}/duzenle?sekme=diger` : null}>
            <Satir etiket="Vade" deger={`${cari.vadeGun} gün`} />
            <Satir etiket="Hesap Limiti" deger={para(cari.hesapLimiti)} />
            <Satir etiket="Risk Limiti" deger={para(cari.riskLimiti)} />
            <Satir etiket="Para Birimi" deger={cari.paraBirimi} />
          </Panel>

          {cari.karaListe ? (
            <div className="panel border-tehlike/30 bg-tehlike-yumusak p-3.5 text-[0.8125rem] text-tehlike">
              <div className="font-semibold">Kara liste nedeni</div>
              <p className="mt-1">{cari.karaListeNedeni ?? "Neden belirtilmemiş."}</p>
            </div>
          ) : null}

          {/* Geçmiş, kara listeden çıkmış cariler için de duruyor: "bu müşteri
              daha önce de sorun çıkarmış mı" sorusunun tek cevabı bu blok. */}
          {karaListeGecmisi.length > 0 ? (
            <div className="panel overflow-hidden">
              <div className="panel-baslik">
                <h2 className="panel-baslik-yazi">
                  Kara Liste Geçmişi ({karaListeGecmisi.length})
                </h2>
              </div>
              <ul className="divide-y divide-border">
                {karaListeGecmisi.map((k) => (
                  <li key={k.id} className="px-3.5 py-2.5 text-[0.8125rem]">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          k.kaldirmaTarihi
                            ? "rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground"
                            : "rounded-sm bg-tehlike-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-tehlike"
                        }
                      >
                        {k.kaldirmaTarihi ? "Kaldırıldı" : "Aktif"}
                      </span>
                      <span className="text-[0.75rem] text-muted-foreground">
                        {tarihSaat(k.alisTarihi)}
                        {k.ekleyenKod ? ` · ${k.ekleyenKod}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{k.neden}</p>
                    {k.kaldirmaTarihi ? (
                      <p className="mt-1 text-[0.75rem] text-muted-foreground">
                        Kaldırma: {tarihSaat(k.kaldirmaTarihi)}
                        {k.kaldiranKod ? ` · ${k.kaldiranKod}` : ""}
                        {k.kaldirmaNedeni ? ` — ${k.kaldirmaNedeni}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {cari.notu ? (
            <Panel baslik="Not" duzenleYolu={duzeltebilir ? `/cari/${cari.id}/duzenle?sekme=diger` : null}>
              <p className="whitespace-pre-wrap px-3.5 py-2.5 text-[0.8125rem]">
                {cari.notu}
              </p>
            </Panel>
          ) : null}
        </div>

        {/* Sağ sütun: araçlar + son hareketler */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="panel overflow-hidden">
            <div className="panel-baslik">
              <h2 className="panel-baslik-yazi">Araçları</h2>
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] text-muted-foreground">
                  {cari._count.araclar} araç
                </span>
                {yetkiVar(kullanici, "arac", "ekle") ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/arac/yeni?cariId=${cari.id}`}>
                      <Plus className="size-3.5" aria-hidden />
                      Araç Ekle
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
            {cari.araclar.length === 0 ? (
              <BosDurum
                ikon={<CarFront className="size-7 text-muted-foreground/40" aria-hidden />}
                baslik="Bu cariye tanımlı araç yok"
                aciklama="Yukarıdaki Araç Ekle düğmesiyle bu cariye ait bir araç kaydı açabilirsiniz."
              />
            ) : (
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Plaka</th>
                      <th>Marka / Model</th>
                      <th className="text-right">Yıl</th>
                      <th className="text-right">Son KM</th>
                      {aracDuzeltebilir ? <th className="w-10" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {cari.araclar.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono font-medium">
                          <Link href={`/arac/${a.id}`} className="text-primary hover:underline">
                            {plaka(a.plaka)}
                          </Link>
                        </td>
                        <td className="text-muted-foreground">
                          {[a.marka, a.model].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="text-right">{a.modelYili ?? "—"}</td>
                        <td className="text-right">
                          {a.sonKm ? a.sonKm.toLocaleString("tr-TR") : "—"}
                        </td>
                        {aracDuzeltebilir ? (
                          <td className="text-right">
                            <Button variant="ghost" size="icon" asChild title="Aracı düzenle">
                              <Link href={`/arac/${a.id}/duzenle`} aria-label="Aracı düzenle">
                                <Pencil className="size-4" aria-hidden />
                              </Link>
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-baslik">
              <h2 className="panel-baslik-yazi">Son Hesap Hareketleri</h2>
              <span className="text-[0.75rem] text-muted-foreground">
                son 20 kayıt
              </span>
            </div>
            {cari.hareketler.length === 0 ? (
              <BosDurum
                baslik="Hesap hareketi yok"
                aciklama="Fatura, tahsilat veya açılış bakiyesi girildiğinde burada görünür."
              />
            ) : (
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Tür</th>
                      <th>Açıklama</th>
                      <th className="text-right">Borç</th>
                      <th className="text-right">Alacak</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {cari.hareketler.map((h) => (
                      <tr key={h.id}>
                        <td>{tarih(h.tarih)}</td>
                        <td className="text-muted-foreground">{HAREKET_ADI[h.tur]}</td>
                        <td className="max-w-[24rem] truncate">{h.aciklama ?? "—"}</td>
                        <td className="text-right">
                          {Number(h.borc.toString()) ? para(h.borc) : "—"}
                        </td>
                        <td className="text-right">
                          {Number(h.alacak.toString()) ? para(h.alacak) : "—"}
                        </td>
                        <td className="text-right">
                          <HareketIslemi
                            cariId={cari.id}
                            tur={h.tur}
                            etiket={h.aciklama ?? HAREKET_ADI[h.tur]}
                            tahsilatId={h.tahsilatId}
                            kaynakYolu={hareketKaynakYolu(h)}
                            acilisSilebilir={duzeltebilir}
                            tahsilatSilebilir={yetkiVar(kullanici, "tahsilat", "sil")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {cari.turu !== "PERSONEL" ? (
            <FiloSozlesmeleri
              cariId={cari.id}
              sozlesmeler={filoSozlesmeleri}
              duzeltebilir={duzeltebilir}
            />
          ) : null}

          {/* SA-3.1: "Kimden Ne Aldık" — bu cariye kesilmiş alış faturalarının
              kalem dökümü. Türe bakılmıyor; alım varsa (müşteri kartında bile)
              görünür. Alım yoksa blok hiç render edilmiyor. */}
          {alisKalemleri.length > 0 ? (
            <div className="panel overflow-hidden">
              <div className="panel-baslik">
                <h2 className="panel-baslik-yazi">Kimden Ne Aldık</h2>
                <span className="text-[0.75rem] text-muted-foreground">
                  alış faturası kalemleri · son {alisKalemleri.length}
                </span>
              </div>
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Fatura No</th>
                      <th>Parça / Malzeme</th>
                      <th className="text-right">Miktar</th>
                      <th className="text-right">Birim Fiyat</th>
                      <th className="text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alisKalemleri.map((k) => (
                      <tr key={k.id}>
                        <td>{tarih(k.tarih)}</td>
                        <td className="font-mono">
                          <Link
                            href={`/evrak/alis/${k.evrakId}`}
                            className="text-primary hover:underline"
                          >
                            {k.evrakNo}
                          </Link>
                          {k.iade ? (
                            <span className="ml-1 rounded-sm bg-uyari-yumusak px-1 py-0.5 text-[0.625rem] font-medium text-uyari">
                              İade
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-[20rem] truncate">
                          {k.stokKodu ? (
                            <span className="font-mono text-muted-foreground">
                              {k.stokKodu}{" "}
                            </span>
                          ) : null}
                          {k.ad}
                        </td>
                        <td className="text-right">
                          {k.miktar.toLocaleString("tr-TR")} {k.birim}
                        </td>
                        <td className="text-right">{para(k.birimFiyat)}</td>
                        <td className="text-right">{para(k.toplam)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Fatura/servis/çek hareketleri kendi kaydından silinir — oraya götüren yol. */
function hareketKaynakYolu(h: {
  kabulId: number | null
  cekSenetId: number | null
  evrak: { id: number; tur: string } | null
}) {
  if (h.evrak) {
    const alis = h.evrak.tur === "ALIS" || h.evrak.tur === "IADE_ALIS"
    return `/evrak/${alis ? "alis" : "satis"}/${h.evrak.id}`
  }
  if (h.kabulId) return `/servis/kabul/${h.kabulId}`
  if (h.cekSenetId) return `/cek-senet/${h.cekSenetId}`
  return null
}

const HAREKET_ADI: Record<string, string> = {
  ACILIS: "Açılış",
  EVRAK: "Fatura",
  KABUL: "Servis",
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
  MAHSUP: "Mahsup",
}

function Panel({
  baslik,
  duzenleYolu,
  children,
}: {
  baslik: string
  /** Verilirse başlığın sağında o bölümün düzenleme sekmesine giden tuş çıkar. */
  duzenleYolu?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-baslik">
        <h2 className="panel-baslik-yazi">{baslik}</h2>
        {duzenleYolu ? <DuzenleTusu yol={duzenleYolu} /> : null}
      </div>
      <dl className="divide-y divide-border/70">{children}</dl>
    </div>
  )
}

function DuzenleTusu({ yol }: { yol: string }) {
  return (
    <Button variant="ghost" size="sm" asChild className="h-7 px-2">
      <Link href={yol}>
        <Pencil className="size-3.5" aria-hidden />
        Düzenle
      </Link>
    </Button>
  )
}

function Satir({
  etiket,
  deger,
  tekTip,
}: {
  etiket: string
  deger: string | null | undefined
  tekTip?: boolean
}) {
  return (
    <div className="flex gap-3 px-3.5 py-1.5 text-[0.8125rem]">
      <dt className="w-32 shrink-0 text-muted-foreground">{etiket}</dt>
      <dd className={`min-w-0 flex-1 break-words ${tekTip ? "font-mono" : ""}`}>
        {deger || "—"}
      </dd>
    </div>
  )
}

function Sayac({ etiket, deger }: { etiket: string; deger: number }) {
  return (
    <div>
      <div className="rakam text-[1.125rem] font-semibold leading-none">{deger}</div>
      <div className="mt-1 text-[0.6875rem] text-muted-foreground">{etiket}</div>
    </div>
  )
}

function BosDurum({
  ikon,
  baslik,
  aciklama,
}: {
  ikon?: React.ReactNode
  baslik: string
  aciklama: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
      {ikon}
      <p className="text-[0.8125rem] font-medium">{baslik}</p>
      <p className="max-w-sm text-[0.75rem] text-muted-foreground">{aciklama}</p>
    </div>
  )
}
