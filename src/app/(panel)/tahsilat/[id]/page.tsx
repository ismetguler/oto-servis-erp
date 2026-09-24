import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText, Pencil } from "lucide-react"

import { ODEME_SEKLI_ADI, tahsilatGetir, TUR_ADI } from "../veri"
import { DURUM_ADI as CEK_DURUM_ADI } from "@/app/(panel)/cek-senet/veri"
import { TahsilatSilDugmesi } from "@/components/tahsilat/tahsilat-sil-dugmesi"
import { Button } from "@/components/ui/button"
import { para, sayi, tarih, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Tahsilat / Ödeme Fişi" }
export const dynamic = "force-dynamic"

export default async function TahsilatKarti({ params }: { params: Promise<{ id: string }> }) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const fis = await tahsilatGetir(id)
  if (!fis) notFound()

  const duzeltebilir = yetkiVar(kullanici, "tahsilat", "duzelt")
  const silebilir = yetkiVar(kullanici, "tahsilat", "sil")
  const tahsilat = fis.tur === "TAHSILAT"
  const bakiye = sayi(fis.cari.bakiye)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/tahsilat" aria-label="Listeye dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              <span className="font-mono text-muted-foreground">{fis.fisNo}</span>
              <span className={tahsilat ? "text-basari" : "text-tehlike"}>
                {TUR_ADI[fis.tur]}
              </span>
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {para(sayi(fis.tutar))} · {tarih(fis.tarih)} ·{" "}
              {ODEME_SEKLI_ADI[fis.odemeSekli]}
              {fis.silindi ? " · SİLİNDİ" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/baski/tahsilat/${fis.id}`} target="_blank">
              <FileText className="size-4" aria-hidden />
              Yazdır
            </Link>
          </Button>
          {duzeltebilir && !fis.silindi ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/tahsilat/${fis.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
          {silebilir ? (
            <TahsilatSilDugmesi
              id={fis.id}
              silinmis={fis.silindi}
              etiket={`${fis.fisNo} (${para(sayi(fis.tutar))})`}
            />
          ) : null}
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Fiş Bilgileri</h2>
            </div>
            <dl className="grid gap-3 p-4 sm:grid-cols-3">
              <Satir etiket="Fiş / Makbuz No" deger={fis.fisNo} />
              <Satir etiket="Tür" deger={TUR_ADI[fis.tur]} />
              <Satir etiket="Tarih" deger={tarih(fis.tarih)} />
              <Satir
                etiket="Cari"
                deger={`${fis.cari.kod} — ${fis.cari.unvan}`}
                yol={`/cari/${fis.cari.id}`}
              />
              <Satir etiket="Tutar" deger={para(sayi(fis.tutar))} />
              <Satir etiket="Ödeme Şekli" deger={ODEME_SEKLI_ADI[fis.odemeSekli]} />
              <Satir
                etiket="Kasa"
                deger={fis.kasa ? fis.kasa.ad : "—"}
                yol={fis.kasa ? `/kasa/${fis.kasa.id}` : undefined}
              />
              {fis.kabulId ? (
                <Satir
                  etiket="İlgili Kabul"
                  deger={`#${fis.kabulId}`}
                  yol={`/servis/kabul/${fis.kabulId}`}
                />
              ) : null}
              <Satir etiket="Kayıt Zamanı" deger={tarihSaat(fis.olusturmaTarihi)} />
              {fis.odemeSekli === "KREDI_KARTI" ? (
                <>
                  <Satir etiket="Banka / POS" deger={fis.posBanka ?? "—"} />
                  <Satir etiket="Kart Sahibi" deger={fis.posKartSahibi ?? "—"} />
                  <Satir
                    etiket="Kart"
                    deger={fis.posSon4 ? `**** **** **** ${fis.posSon4}` : "—"}
                  />
                  <Satir etiket="Provizyon" deger={fis.posProvizyon ?? "—"} />
                  <Satir
                    etiket="Taksit"
                    deger={fis.posTaksit ? `${fis.posTaksit} taksit` : "Tek çekim"}
                  />
                </>
              ) : null}
            </dl>
            {fis.aciklama ? (
              <p className="border-t border-border px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
                {fis.aciklama}
              </p>
            ) : null}
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Cari Etkisi</h2>
              <p className="text-[0.75rem] text-muted-foreground">
                Fişin cari ekstresine yazdığı satır — bakiye bu satırlardan toplanır
              </p>
            </div>
            {fis.hareketler.length === 0 ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
                Silinmiş fişin cari etkisi yoktur.
              </p>
            ) : (
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Açıklama</th>
                      <th className="text-right">Borç</th>
                      <th className="text-right">Alacak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fis.hareketler.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{tarih(h.tarih)}</td>
                        <td className="text-muted-foreground">{h.aciklama ?? "—"}</td>
                        <td className="text-right tabular-nums">
                          {sayi(h.borc) > 0 ? para(sayi(h.borc)) : "—"}
                        </td>
                        <td className="text-right tabular-nums text-basari">
                          {sayi(h.alacak) > 0 ? para(sayi(h.alacak)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Cari Durumu</h2>
            </div>
            <div className="p-4">
              <Link href={`/cari/${fis.cari.id}`} className="text-[0.875rem] hover:underline">
                {fis.cari.unvan}
              </Link>
              <p
                className={`mt-1 text-[1.0625rem] font-semibold tabular-nums ${
                  bakiye > 0 ? "text-tehlike" : bakiye < 0 ? "text-basari" : ""
                }`}
              >
                {para(Math.abs(bakiye))}{" "}
                <span className="text-[0.75rem] font-normal text-muted-foreground">
                  {bakiye > 0 ? "borçlu" : bakiye < 0 ? "alacaklı (avans)" : "kapalı"}
                </span>
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                <Link href={`/cari/${fis.cari.id}/ekstre`}>Ekstreyi aç</Link>
              </Button>
            </div>
          </div>

          {fis.cekSenet && !fis.cekSenet.silindi ? (
            <div className="panel overflow-hidden">
              <div className="border-b border-border px-4 py-2.5">
                <h2 className="text-[0.875rem] font-semibold">Çek / Senet Kaydı</h2>
                <p className="text-[0.75rem] text-muted-foreground">
                  Bu fişten otomatik açıldı — portföyde takip ediliyor
                </p>
              </div>
              <div className="p-4">
                <Link
                  href={`/cek-senet/${fis.cekSenet.id}`}
                  className="font-mono text-[0.875rem] hover:underline"
                >
                  {fis.cekSenet.portfoyNo}
                </Link>
                <p className="mt-1 text-[0.8125rem]">
                  {fis.cekSenet.tur === "SENET" ? "Senet" : "Çek"} ·{" "}
                  {fis.cekSenet.yon === "ALINAN" ? "Alınan" : "Verilen"} ·{" "}
                  {para(sayi(fis.cekSenet.tutar))}
                </p>
                <dl className="mt-3 grid gap-2 text-[0.8125rem]">
                  <Satir etiket="Vade" deger={tarih(fis.cekSenet.vadeTarihi)} />
                  <Satir etiket="Durum" deger={CEK_DURUM_ADI[fis.cekSenet.durum]} />
                  <Satir etiket="Banka" deger={fis.cekSenet.banka ?? "—"} />
                  <Satir etiket="Belge No" deger={fis.cekSenet.belgeNo ?? "—"} />
                  {fis.cekSenet.tahsilKasa ? (
                    <Satir
                      etiket="Tahsil Kasası"
                      deger={fis.cekSenet.tahsilKasa.ad}
                      yol={`/kasa/${fis.cekSenet.tahsilKasa.id}`}
                    />
                  ) : null}
                </dl>
                <p className="mt-3 rounded-sm border border-border bg-muted/40 px-2 py-1.5 text-[0.75rem] text-muted-foreground">
                  Para kasaya kâğıt <strong>tahsil edildi</strong> olunca girer. Tahsil işlemi
                  Çek-Senet kartından yapılır.
                </p>
              </div>
            </div>
          ) : null}

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Kasa Etkisi</h2>
            </div>
            {fis.kasaHareketleri.length === 0 ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
                {fis.odemeSekli === "CEK" || fis.odemeSekli === "SENET"
                  ? "Çek / senet kasaya ancak tahsil edildiğinde girer."
                  : fis.odemeSekli === "MAHSUP"
                    ? "Mahsup para hareketi değildir."
                    : "Kasa hareketi yok."}
              </p>
            ) : (
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <tbody>
                    {fis.kasaHareketleri.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <Link href={`/kasa/${h.kasaId}`} className="hover:underline">
                            {h.kasa.ad}
                          </Link>
                        </td>
                        <td
                          className={`text-right tabular-nums ${
                            h.tur === "CIKIS" ? "text-tehlike" : "text-basari"
                          }`}
                        >
                          {h.tur === "CIKIS" ? "−" : "+"}
                          {para(sayi(h.tutar))}
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

function Satir({ etiket, deger, yol }: { etiket: string; deger: string; yol?: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{etiket}</dt>
      <dd className="text-[0.8125rem]">
        {yol ? (
          <Link href={yol} className="hover:underline">
            {deger}
          </Link>
        ) : (
          deger
        )}
      </dd>
    </div>
  )
}
