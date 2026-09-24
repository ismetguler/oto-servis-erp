import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ListOrdered, Pencil, Printer } from "lucide-react"

import { StokSilDugmesi } from "@/components/stok/stok-sil-dugmesi"
import { Button } from "@/components/ui/button"
import { URUN_TIPI_ADLARI, urunTipiNormalize } from "@/app/(panel)/stok/sema"
import { miktar, para, yuzde } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Stok Kartı" }
export const dynamic = "force-dynamic"

export default async function StokKarti({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const kullanici = await yetkiliOturum("stok", "gor")

  const { id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()

  const stok = await prisma.stok.findUnique({
    where: { id: kayitId },
    include: {
      depo: { select: { ad: true } },
      _count: { select: { hareketler: true, kabulKalemleri: true, evrakKalemleri: true } },
    },
  })
  if (!stok) notFound()

  const stokMiktari = Number(stok.mevcutMiktar.toString())
  const minSeviye = Number(stok.minSeviye.toString())
  const kritik = minSeviye > 0 && stokMiktari <= minSeviye
  const urunTipi = urunTipiNormalize(stok.tipi)
  const hizmet = urunTipi === "HIZMET"
  const duzeltebilir = yetkiVar(kullanici, "stok", "duzelt") && !stok.silindi
  const silebilir = yetkiVar(kullanici, "stok", "sil")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stok" aria-label="Stok listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              {stok.ad}
              {stok.silindi ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  Silinmiş
                </span>
              ) : !stok.aktif ? (
                <span className="rounded-sm bg-uyari-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-uyari">
                  Pasif
                </span>
              ) : null}
              {kritik ? (
                <span className="rounded-sm bg-tehlike-yumusak px-1.5 py-0.5 text-[0.6875rem] font-medium text-tehlike">
                  Minimum seviyenin altında
                </span>
              ) : null}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              <span className="font-mono">{stok.kod}</span>
              {` · ${URUN_TIPI_ADLARI[urunTipiNormalize(stok.tipi)]}`}
              {stok.barkod ? ` · ${stok.barkod}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/stok/${stok.id}/hareketler`}>
              <ListOrdered className="size-4" aria-hidden />
              Hareket Dökümü
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/stok/etiket?id=${stok.id}`}>
              <Printer className="size-4" aria-hidden />
              Etiket Yazdır
            </Link>
          </Button>
          {duzeltebilir ? (
            <Button size="sm" asChild>
              <Link href={`/stok/${stok.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
          {silebilir ? (
            <StokSilDugmesi id={stok.id} silinmis={stok.silindi} ad={stok.ad} />
          ) : null}
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-3">
        {/* Sol sütun: stok durumu + fiyat özeti */}
        <div className="flex flex-col gap-4">
          <div className="panel p-3.5">
            <div className="text-[0.75rem] font-medium text-muted-foreground">
              Mevcut Miktar
            </div>
            <div
              className={`rakam mt-1 text-[1.75rem] font-bold leading-none ${
                kritik ? "text-tehlike" : "text-foreground"
              }`}
            >
              {miktar(stok.mevcutMiktar)} <span className="text-base font-medium">{stok.birim}</span>
            </div>
            <div className="mt-1.5 text-[0.75rem] text-muted-foreground">
              Min {miktar(stok.minSeviye)} · Maks {miktar(stok.maxSeviye)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <Sayac etiket="Hareket" deger={stok._count.hareketler} />
              <Sayac etiket="Kabul Kullanımı" deger={stok._count.kabulKalemleri} />
              <Sayac etiket="Evrak Kullanımı" deger={stok._count.evrakKalemleri} />
            </div>
          </div>

          <Panel baslik="Fiyat">
            {!hizmet ? <Satir etiket="Alış Fiyatı" deger={para(stok.alisFiyat)} /> : null}
            <Satir etiket="Satış Fiyatı" deger={para(stok.satisFiyat)} />
            {!hizmet ? (
              <Satir etiket="Ortalama Maliyet" deger={para(stok.ortalamaMaliyet)} />
            ) : null}
            <Satir etiket="KDV Oranı" deger={yuzde(stok.kdvOrani)} />
            <Satir etiket="Para Birimi" deger={stok.paraBirimi} />
          </Panel>

          {!hizmet ? (
            <Panel baslik="Stok / Depo">
              <Satir etiket="Depo" deger={stok.depo?.ad ?? null} />
              <Satir etiket="Raf / Konum" deger={stok.rafYeri} />
              <Satir etiket="Ürün Grubu" deger={stok.urunGrubu} />
              <Satir etiket="Grup Kodu" deger={stok.grupKodu} />
              <Satir etiket="GTİP No" deger={stok.gtipNo} />
            </Panel>
          ) : null}
        </div>

        {/* Sağ sütun: kimlik / muadil / lastik / açıklama */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {!hizmet ? (
            <Panel baslik="Ürün Kimliği">
              <Satir etiket="Marka / Üretici" deger={stok.uretici} />
              <Satir etiket="Üretici Kodu" deger={stok.ureticiKodu} tekTip />
              <Satir etiket="Orijinal (OEM) Kodu" deger={stok.orijinalKodu} tekTip />
              <Satir etiket="Muadil Kodları" deger={stok.muadilNo} tekTip />
              <Satir etiket="Özel No" deger={stok.ozelNo} tekTip />
              <Satir etiket="Barkod" deger={stok.barkod} tekTip />
            </Panel>
          ) : null}

          {urunTipi === "ARAC" ? (
            <Panel baslik="Araç Uygunluğu">
              <Satir etiket="Marka" deger={stok.uygunMarka} />
              <Satir etiket="Model" deger={stok.uygunModel} />
              <Satir
                etiket="Model Yılı"
                deger={
                  stok.uygunYilBas || stok.uygunYilBit
                    ? `${stok.uygunYilBas ?? "…"} – ${stok.uygunYilBit ?? "…"}`
                    : null
                }
              />
            </Panel>
          ) : null}

          {stok.desen || stok.mevsim || stok.hizYuk || stok.yakitDirenci || stok.gurultuSeviyesi || stok.gurultuSinifi ? (
            <Panel baslik="Lastik Bilgileri">
              <Satir etiket="Desen" deger={stok.desen} />
              <Satir etiket="Mevsim" deger={stok.mevsim} />
              <Satir etiket="Hız / Yük Endeksi" deger={stok.hizYuk} />
              <Satir etiket="Yakıt Direnci" deger={stok.yakitDirenci} />
              <Satir etiket="Gürültü Seviyesi" deger={stok.gurultuSeviyesi} />
              <Satir etiket="Gürültü Sınıfı" deger={stok.gurultuSinifi} />
            </Panel>
          ) : null}

          {stok.teknikBilgi ? (
            <Panel baslik="Teknik Bilgi">
              <p className="whitespace-pre-wrap px-3.5 py-2.5 text-[0.8125rem]">
                {stok.teknikBilgi}
              </p>
            </Panel>
          ) : null}

          {stok.aciklama ? (
            <Panel baslik="Açıklama">
              <p className="whitespace-pre-wrap px-3.5 py-2.5 text-[0.8125rem]">
                {stok.aciklama}
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
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
      <dt className="w-40 shrink-0 text-muted-foreground">{etiket}</dt>
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
