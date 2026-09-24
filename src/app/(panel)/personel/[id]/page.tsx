import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Banknote,
  FileText,
  Minus,
  Pencil,
  Receipt,
  Users,
} from "lucide-react"

import { CariSilDugmesi } from "@/components/cari/cari-sil-dugmesi"
import { DurumRozeti } from "@/components/kabul/kabul-listesi"
import { Button } from "@/components/ui/button"
import { para, plaka, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

/**
 * PERSONEL KARTI
 *
 * Cari kartının personel hâli: araç listesi yerine "üstlendiği işler" ve
 * "sorumlu olduğu cariler" var, ayrıca özlük kutusu (görev, işe giriş, maaş)
 * eklendi. Hesap hareketleri aynı `cari_hareketleri` tablosundan geliyor —
 * personele yapılan ödeme de cari hareketidir.
 */
export const metadata: Metadata = { title: "Personel Kartı" }
export const dynamic = "force-dynamic"

export default async function PersonelKarti({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const personel = await prisma.cari.findUnique({
    where: { id: kayitId },
    include: {
      plasiyerCarileri: {
        where: { silindi: false },
        orderBy: { unvan: "asc" },
        take: 20,
        select: { id: true, kod: true, unvan: true, bakiye: true },
      },
      kabulGorevleri: {
        orderBy: { kabulId: "desc" },
        take: 20,
        select: {
          id: true,
          kabul: {
            select: {
              id: true,
              kabulNo: true,
              durum: true,
              girisTarihi: true,
              genelToplam: true,
              arac: { select: { id: true, plaka: true } },
              cari: { select: { id: true, unvan: true } },
            },
          },
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
        },
      },
      _count: { select: { plasiyerCarileri: true, kabulGorevleri: true } },
    },
  })
  // Müşteri/tedarikçi kartı personel ekranında açılmıyor: aynı tabloda
  // dursalar da ekranlar ayrı, karışırsa kullanıcı kartı yanlış yerde arar.
  if (!personel || personel.turu !== "PERSONEL") notFound()

  const bakiye = Number(personel.bakiye.toString())
  const duzeltebilir = yetkiVar(kullanici, "cari", "duzelt") && !personel.silindi
  const silebilir = yetkiVar(kullanici, "cari", "sil")
  const tahsilatEkleyebilir =
    yetkiVar(kullanici, "tahsilat", "ekle") && !personel.silindi

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/personel" aria-label="Personel listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              {personel.unvan}
              {personel.silindi ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  Silinmiş
                </span>
              ) : personel.istenCikisTarihi ? (
                <span className="rounded-sm bg-tehlike-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-tehlike">
                  İşten ayrıldı
                </span>
              ) : !personel.aktif ? (
                <span className="rounded-sm bg-uyari-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-uyari">
                  Pasif
                </span>
              ) : null}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              <span className="font-mono">{personel.kod}</span>
              {personel.gorevi ? ` · ${personel.gorevi}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Ekstre cari modülünün ekranı: personelin hesabı da cari hesabı,
              ayrı bir ekstre ekranı yazmak aynı tabloyu iki kez okumak olurdu. */}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cari/${personel.id}/ekstre`}>
              <FileText className="size-4" aria-hidden />
              Ekstre
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/personel/satis-tahsilat?personel=${personel.id}`}>
              <Receipt className="size-4" aria-hidden />
              Satış-Tahsilat
            </Link>
          </Button>
          {tahsilatEkleyebilir ? (
            <>
              {/* Personelde ödeme = maaş/kesinti ödemesi. Fiş ekranı ortak,
                  cari önceden seçili. */}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tahsilat/odeme?cari=${personel.id}`}>
                  <Minus className="size-4" aria-hidden />
                  Ödeme Gir
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tahsilat/yeni?cari=${personel.id}`}>
                  <Banknote className="size-4" aria-hidden />
                  Tahsilat Gir
                </Link>
              </Button>
            </>
          ) : null}
          {duzeltebilir ? (
            <Button size="sm" asChild>
              <Link href={`/personel/${personel.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
          {silebilir ? (
            <CariSilDugmesi
              id={personel.id}
              silinmis={personel.silindi}
              unvan={personel.unvan}
            />
          ) : null}
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-3">
        {/* Sol sütun: bakiye + özlük panelleri */}
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
                ? "Borçlu bakiye (avans)"
                : bakiye < 0
                  ? "Alacaklı bakiye (hak ediş)"
                  : "Bakiye kapalı"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center">
              <Sayac etiket="Üstlendiği iş" deger={personel._count.kabulGorevleri} />
              <Sayac etiket="Sorumlu cari" deger={personel._count.plasiyerCarileri} />
            </div>
          </div>

          <Panel baslik="Özlük">
            <Satir etiket="Görev" deger={personel.gorevi} />
            <Satir
              etiket="İşe Giriş"
              deger={personel.iseGirisTarihi ? tarih(personel.iseGirisTarihi) : null}
            />
            <Satir
              etiket="İşten Çıkış"
              deger={
                personel.istenCikisTarihi ? tarih(personel.istenCikisTarihi) : null
              }
            />
            <Satir
              etiket="Doğum Tarihi"
              deger={personel.dogumTarihi ? tarih(personel.dogumTarihi) : null}
            />
            <Satir etiket="TCKN" deger={personel.vergiNo} tekTip />
            <Satir etiket="SGK No" deger={personel.sgkNo} tekTip />
            <Satir
              etiket="Maaş"
              deger={Number(personel.maas.toString()) ? para(personel.maas) : null}
            />
          </Panel>

          <Panel baslik="İletişim">
            <Satir etiket="Telefon" deger={personel.telefon} />
            <Satir etiket="Cep" deger={personel.gsm} />
            <Satir etiket="E-Posta" deger={personel.email} />
            <Satir
              etiket="Adres"
              deger={
                [
                  personel.adres,
                  [personel.ilce, personel.il].filter(Boolean).join(" / "),
                ]
                  .filter(Boolean)
                  .join(" — ") || null
              }
            />
          </Panel>

          <Panel baslik="Banka">
            <Satir etiket="Banka" deger={personel.banka} />
            <Satir etiket="Şube" deger={personel.bankaSube} />
            <Satir etiket="IBAN" deger={personel.ibanNo} tekTip />
          </Panel>

          {personel.notu ? (
            <Panel baslik="Not">
              <p className="whitespace-pre-wrap px-3.5 py-2.5 text-[0.8125rem]">
                {personel.notu}
              </p>
            </Panel>
          ) : null}
        </div>

        {/* Sağ sütun: işler, sorumlu cariler, hesap hareketleri */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="panel overflow-hidden">
            <div className="panel-baslik">
              <h2 className="panel-baslik-yazi">Üstlendiği İşler</h2>
              <span className="text-[0.75rem] text-muted-foreground">son 20 kayıt</span>
            </div>
            {personel.kabulGorevleri.length === 0 ? (
              <BosDurum
                baslik="Bu personele atanmış iş yok"
                aciklama="Araç kabul kartında personel seçildiğinde işler burada listelenir."
              />
            ) : (
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kabul No</th>
                      <th>Tarih</th>
                      <th>Plaka</th>
                      <th>Müşteri</th>
                      <th>Durum</th>
                      <th className="text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personel.kabulGorevleri.map((g) => (
                      <tr key={g.id}>
                        <td className="font-mono text-[0.75rem]">
                          <Link
                            href={`/servis/kabul/${g.kabul.id}`}
                            className="text-primary hover:underline"
                          >
                            {g.kabul.kabulNo}
                          </Link>
                        </td>
                        <td>{tarih(g.kabul.girisTarihi)}</td>
                        <td className="font-mono">
                          <Link
                            href={`/arac/${g.kabul.arac.id}`}
                            className="text-primary hover:underline"
                          >
                            {plaka(g.kabul.arac.plaka)}
                          </Link>
                        </td>
                        <td className="max-w-[16rem] truncate">
                          <Link
                            href={`/cari/${g.kabul.cari.id}`}
                            className="text-primary hover:underline"
                          >
                            {g.kabul.cari.unvan}
                          </Link>
                        </td>
                        <td>
                          <DurumRozeti durum={g.kabul.durum} />
                        </td>
                        <td className="text-right">{para(g.kabul.genelToplam)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-baslik">
              <h2 className="panel-baslik-yazi">Sorumlu Olduğu Cariler</h2>
              <span className="text-[0.75rem] text-muted-foreground">
                {personel._count.plasiyerCarileri} cari
              </span>
            </div>
            {personel.plasiyerCarileri.length === 0 ? (
              <BosDurum
                ikon={<Users className="size-7 text-muted-foreground/40" aria-hidden />}
                baslik="Sorumlu olarak atanmış cari yok"
                aciklama="Cari kartındaki Sorumlu Personel alanında bu personel seçilirse burada görünür."
              />
            ) : (
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Ünvan</th>
                      <th className="text-right">Bakiye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personel.plasiyerCarileri.map((c) => (
                      <tr key={c.id}>
                        <td className="font-mono text-[0.75rem]">
                          <Link
                            href={`/cari/${c.id}`}
                            className="text-primary hover:underline"
                          >
                            {c.kod}
                          </Link>
                        </td>
                        <td className="max-w-[24rem] truncate">{c.unvan}</td>
                        <td className="text-right">
                          {para(Number(c.bakiye.toString()))}
                        </td>
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
              <span className="text-[0.75rem] text-muted-foreground">son 20 kayıt</span>
            </div>
            {personel.hareketler.length === 0 ? (
              <BosDurum
                baslik="Hesap hareketi yok"
                aciklama="Avans, kesinti veya açılış bakiyesi girildiğinde burada görünür."
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
                    </tr>
                  </thead>
                  <tbody>
                    {personel.hareketler.map((h) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const HAREKET_ADI: Record<string, string> = {
  ACILIS: "Açılış",
  EVRAK: "Fatura",
  KABUL: "Servis",
  TAHSILAT: "Tahsilat",
  TEDIYE: "Ödeme",
  MAHSUP: "Mahsup",
}

function Panel({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-baslik">
        <h2 className="panel-baslik-yazi">{baslik}</h2>
      </div>
      <dl className="divide-y divide-border/70">{children}</dl>
    </div>
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
