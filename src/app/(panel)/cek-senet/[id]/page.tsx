import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"

import {
  cekSenetGetir,
  DURUM_ADI,
  GECISLER,
  kasaGerektirir,
  KAPALI_DURUMLAR,
  ONAY_ADI,
  TUR_ADI,
  YON_ADI,
} from "../veri"
import { secilebilirKasalar } from "@/app/(panel)/kasa/veri"
import { CekSenetSilDugmesi } from "@/components/cek-senet/cek-senet-sil-dugmesi"
import { DurumIslemleri } from "@/components/cek-senet/durum-islemleri"
import { DurumRozeti } from "@/components/cek-senet/durum-rozeti"
import { OnayDugmeleri } from "@/components/cek-senet/onay-dugmeleri"
import { Button } from "@/components/ui/button"
import { gunBasi, para, sayi, tarih, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Çek / Senet Kartı" }
export const dynamic = "force-dynamic"

export default async function CekSenetKarti({ params }: { params: Promise<{ id: string }> }) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const cek = await cekSenetGetir(id)
  if (!cek) notFound()

  const kasalar = await secilebilirKasalar()
  const duzeltebilir = yetkiVar(kullanici, "tahsilat", "duzelt")
  const silebilir = yetkiVar(kullanici, "tahsilat", "sil")

  const gecisler = cek.onayDurumu === "ONAYLANDI" ? (GECISLER[cek.yon][cek.durum] ?? []) : []
  const kasaliDurumlar = gecisler.filter((g) => kasaGerektirir(cek.yon, g))

  const kapali = KAPALI_DURUMLAR.includes(cek.durum)
  const kalanGun = kapali
    ? null
    : Math.round((gunBasi(cek.vadeTarihi).getTime() - gunBasi().getTime()) / 86_400_000)

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cek-senet" aria-label="Listeye dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
              <span className="font-mono text-muted-foreground">{cek.portfoyNo}</span>
              {YON_ADI[cek.yon]} {TUR_ADI[cek.tur]}
              <DurumRozeti durum={cek.durum} />
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {para(cek.tutar)} · vade {tarih(cek.vadeTarihi)}
              {kalanGun === null
                ? ""
                : kalanGun < 0
                  ? ` · ${Math.abs(kalanGun)} gün geçti`
                  : ` · ${kalanGun} gün kaldı`}
              {cek.silindi ? " · SİLİNDİ" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {duzeltebilir && !cek.silindi && cek.durum === "PORTFOYDE" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/cek-senet/${cek.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
          {silebilir ? (
            <CekSenetSilDugmesi
              id={cek.id}
              silinmis={cek.silindi}
              etiket={`${cek.portfoyNo} (${para(cek.tutar)})`}
            />
          ) : null}
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Kâğıt Bilgileri</h2>
            </div>
            <dl className="grid gap-3 p-4 sm:grid-cols-3">
              <Satir etiket="Tutar" deger={`${para(cek.tutar)} ${cek.paraBirimi}`} />
              <Satir etiket="Vade Tarihi" deger={tarih(cek.vadeTarihi)} />
              <Satir etiket="Keşide Tarihi" deger={tarih(cek.kesideTarihi)} />
              <Satir
                etiket="Cari"
                deger={cek.cari?.unvan ?? "—"}
                yol={cek.cari ? `/cari/${cek.cari.id}` : undefined}
              />
              <Satir etiket={cek.tur === "CEK" ? "Keşideci" : "Borçlu"} deger={cek.borclu ?? "—"} />
              <Satir etiket="Keşide Yeri" deger={cek.kesideYeri ?? "—"} />
              <Satir
                etiket={cek.tur === "CEK" ? "Çek No" : "Seri No"}
                deger={cek.belgeNo ?? "—"}
              />
              {cek.tur === "CEK" ? (
                <>
                  <Satir etiket="Banka" deger={cek.banka ?? "—"} />
                  <Satir etiket="Şube" deger={cek.bankaSube ?? "—"} />
                  <Satir etiket="Hesap No" deger={cek.hesapNo ?? "—"} />
                </>
              ) : null}
              {cek.tahsilKasa ? (
                <Satir
                  etiket={cek.yon === "ALINAN" ? "Tahsil Kasası" : "Ödeme Kasası"}
                  deger={`${cek.tahsilKasa.ad} · ${tarih(cek.tahsilTarihi)}`}
                  yol={`/kasa/${cek.tahsilKasa.id}`}
                />
              ) : null}
              {cek.ciroCari ? (
                <Satir
                  etiket="Ciro Edilen Cari"
                  deger={cek.ciroCari.unvan}
                  yol={`/cari/${cek.ciroCari.id}`}
                />
              ) : null}
            </dl>
            {cek.aciklama ? (
              <p className="border-t border-border px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
                {cek.aciklama}
              </p>
            ) : null}
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Geçmiş</h2>
              <p className="text-[0.75rem] text-muted-foreground">
                Kâğıdın hangi aşamadan geçtiği — kim, ne zaman, hangi kasaya
              </p>
            </div>
            <div className="tablo-sarmal">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Geçiş</th>
                    <th>Açıklama</th>
                    <th>Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  {cek.hareketler.map((h) => {
                    // Durum geçişlerinde `tarih` kullanıcının girdiği işlem
                    // tarihidir (gün başı = 00:00); o satırlarda saat göstermek
                    // yanıltıcı, sadece günü yaz. Kayıt/onay satırları gerçek
                    // zaman damgası taşıdığı için saatli kalır.
                    const geceYarisi = h.tarih.getHours() === 0 && h.tarih.getMinutes() === 0
                    const kasaAdi = h.kasaId
                      ? kasalar.find((k) => k.id === h.kasaId)?.ad ?? null
                      : null
                    return (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap">
                        {geceYarisi ? tarih(h.tarih) : tarihSaat(h.tarih)}
                      </td>
                      <td className="whitespace-nowrap">
                        {h.oncekiDurum && h.oncekiDurum !== h.yeniDurum
                          ? `${DURUM_ADI[h.oncekiDurum]} → ${DURUM_ADI[h.yeniDurum]}`
                          : DURUM_ADI[h.yeniDurum]}
                      </td>
                      <td className="text-muted-foreground">
                        {h.aciklama ?? (kasaAdi ? `Kasa: ${kasaAdi}` : "—")}
                      </td>
                      <td className="font-mono text-[0.75rem] text-muted-foreground">
                        {h.kullaniciKod ?? "—"}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">Onay Durumu</h2>
            </div>
            <div className="p-4">
              <p
                className={`text-[0.9375rem] font-semibold ${
                  cek.onayDurumu === "ONAYLANDI"
                    ? "text-basari"
                    : cek.onayDurumu === "REDDEDILDI"
                      ? "text-tehlike"
                      : "text-uyari"
                }`}
              >
                {ONAY_ADI[cek.onayDurumu]}
              </p>
              {cek.onayTarihi ? (
                <p className="text-[0.75rem] text-muted-foreground">
                  {tarihSaat(cek.onayTarihi)}
                  {cek.onayNotu ? ` — ${cek.onayNotu}` : ""}
                </p>
              ) : (
                <p className="text-[0.75rem] text-muted-foreground">
                  Onaylanana kadar cari bakiyesine işlenmez.
                </p>
              )}
              {duzeltebilir && !cek.silindi ? (
                <div className="mt-3">
                  <OnayDugmeleri id={cek.id} mevcutDurum={cek.onayDurumu} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[0.875rem] font-semibold">İşlemler</h2>
            </div>
            {cek.silindi ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
                Silinmiş kayıtta işlem yapılamaz.
              </p>
            ) : !duzeltebilir ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
                İşlem yapma yetkiniz yok.
              </p>
            ) : cek.onayDurumu !== "ONAYLANDI" ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
                Önce kâğıdı onaylayın.
              </p>
            ) : (
              <DurumIslemleri
                id={cek.id}
                tutar={sayi(cek.tutar)}
                gecisler={gecisler}
                kasalar={kasalar}
                durumAdlari={DURUM_ADI}
                kasaliDurumlar={kasaliDurumlar}
              />
            )}
          </div>

          {cek.kasaHareketleri.length > 0 ? (
            <div className="panel overflow-hidden">
              <div className="border-b border-border px-4 py-2.5">
                <h2 className="text-[0.875rem] font-semibold">Kasa Etkisi</h2>
              </div>
              <div className="tablo-sarmal">
                <table className="veri-tablosu">
                  <tbody>
                    {cek.kasaHareketleri.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <Link href={`/kasa/${h.kasaId}`} className="hover:underline">
                            {h.kasa.ad}
                          </Link>
                        </td>
                        <td
                          className={`text-right tabular-nums ${h.tur === "CIKIS" ? "text-tehlike" : "text-basari"}`}
                        >
                          {h.tur === "CIKIS" ? "−" : "+"}
                          {para(h.tutar)}
                        </td>
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

function Satir({ etiket, deger, yol }: { etiket: string; deger: string; yol?: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{etiket}</dt>
      <dd className="truncate text-[0.8125rem]">
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
