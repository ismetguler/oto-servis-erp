import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BookOpen, Pencil } from "lucide-react"

import { HAREKET_TUR_ADI, KASA_TUR_ADI, masrafTurleri, secilebilirKasalar } from "../veri"
import { HareketFormu } from "@/components/kasa/hareket-formu"
import { HareketSilDugmesi } from "@/components/kasa/hareket-sil-dugmesi"
import { Button } from "@/components/ui/button"
import { para, sayi, tarih, yuzde } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Kasa Kartı" }
export const dynamic = "force-dynamic"

export default async function KasaKarti({ params }: { params: Promise<{ id: string }> }) {
  const kullanici = await yetkiliOturum("tahsilat", "gor")
  const { id: idMetni } = await params
  const id = Number(idMetni)
  if (!Number.isInteger(id)) notFound()

  const kasa = await prisma.kasa.findUnique({
    where: { id },
    include: {
      hareketler: {
        where: { silindi: false },
        orderBy: [{ tarih: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          tarih: true,
          tur: true,
          tutar: true,
          aciklama: true,
          belgeNo: true,
          masrafTuru: true,
          virmanGrubu: true,
          tahsilatId: true,
          cekSenetId: true,
          cari: { select: { id: true, unvan: true } },
          karsiKasa: { select: { id: true, ad: true } },
        },
      },
    },
  })
  if (!kasa) notFound()

  const [kasalar, masraflar] = await Promise.all([secilebilirKasalar(), masrafTurleri()])

  const ekleyebilir = yetkiVar(kullanici, "tahsilat", "ekle") && kasa.aktif && !kasa.silindi
  const duzeltebilir = yetkiVar(kullanici, "tahsilat", "duzelt")
  const silebilir = yetkiVar(kullanici, "tahsilat", "sil")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/kasa" aria-label="Kasa listesine dön">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-[1.0625rem] font-semibold tracking-tight">
              <span className="font-mono text-muted-foreground">{kasa.kod}</span> {kasa.ad}
            </h1>
            <p className="text-[0.8125rem] text-muted-foreground">
              {KASA_TUR_ADI[kasa.tur]} kasası · {kasa.paraBirimi}
              {kasa.tur === "POS" ? ` · komisyon ${yuzde(kasa.posKomisyonOrani)}` : ""}
              {kasa.aktif ? "" : " · pasif"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/kasa/defter?kasa=${kasa.id}`}>
              <BookOpen className="size-4" aria-hidden />
              Defteri Aç
            </Link>
          </Button>
          {duzeltebilir && !kasa.silindi ? (
            <Button size="sm" asChild>
              <Link href={`/kasa/${kasa.id}/duzenle`}>
                <Pencil className="size-4" aria-hidden />
                Düzenle
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="[&>*]:min-w-0 grid gap-4 p-4 lg:grid-cols-[20rem_1fr]">
        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <p className="form-etiket">Güncel Bakiye</p>
            <p
              className={`mt-1 text-[1.5rem] font-semibold tabular-nums ${sayi(kasa.bakiye) < 0 ? "text-tehlike" : ""}`}
            >
              {para(kasa.bakiye)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.8125rem]">
              <Satir etiket="Açılış" deger={para(kasa.acilisBakiye)} />
              {kasa.tur === "BANKA" ? (
                <>
                  <Satir etiket="Banka" deger={kasa.banka ?? "—"} />
                  <Satir etiket="Şube" deger={kasa.bankaSube ?? "—"} />
                  <Satir etiket="Hesap No" deger={kasa.hesapNo ?? "—"} />
                  <Satir etiket="IBAN" deger={kasa.ibanNo ?? "—"} />
                </>
              ) : null}
            </dl>
            {kasa.notu ? (
              <p className="mt-3 rounded-sm bg-muted/40 px-2 py-1.5 text-[0.8125rem] text-muted-foreground">
                {kasa.notu}
              </p>
            ) : null}
          </div>

          {ekleyebilir ? (
            <div>
              <h2 className="mb-2 text-[0.875rem] font-semibold">Hızlı Giriş / Çıkış</h2>
              <HareketFormu
                kasalar={kasalar}
                masraflar={masraflar}
                varsayilanKasaId={kasa.id}
              />
            </div>
          ) : null}
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-[0.875rem] font-semibold">Son Hareketler</h2>
            <p className="text-[0.75rem] text-muted-foreground">
              En son 50 satır · tamamı için kasa defterine bakın
            </p>
          </div>
          {kasa.hareketler.length === 0 ? (
            <p className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
              Bu kasada henüz hareket yok.
            </p>
          ) : (
            <div className="max-h-[calc(100svh-14rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tür</th>
                    <th>Açıklama</th>
                    <th>Cari</th>
                    <th className="text-right">Giriş</th>
                    <th className="text-right">Çıkış</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {kasa.hareketler.map((h) => {
                    const artiMi = h.tur !== "CIKIS" && h.tur !== "VIRMAN_CIKIS"
                    const tutar = sayi(h.tutar)
                    const kaynakli = Boolean(h.tahsilatId || h.cekSenetId)
                    return (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{tarih(h.tarih)}</td>
                        <td className="whitespace-nowrap text-muted-foreground">
                          {HAREKET_TUR_ADI[h.tur]}
                        </td>
                        <td>
                          {h.aciklama ?? "—"}
                          {/* Virman açıklaması zaten iki kasayı da yazıyor;
                              karşı kasa adını tekrar parantezle eklemek mükerrer. */}
                          {h.karsiKasa && !h.virmanGrubu ? (
                            <span className="ml-1 text-[0.75rem] text-muted-foreground">
                              ({h.karsiKasa.ad})
                            </span>
                          ) : null}
                          {h.masrafTuru ? (
                            <span className="ml-1 rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                              {h.masrafTuru}
                            </span>
                          ) : null}
                          {h.belgeNo ? (
                            <span className="ml-1 font-mono text-[0.75rem] text-muted-foreground">
                              {h.belgeNo}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-muted-foreground">
                          {h.cari ? (
                            <Link href={`/cari/${h.cari.id}`} className="hover:underline">
                              {h.cari.unvan}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-right tabular-nums text-basari">
                          {artiMi ? para(tutar) : "—"}
                        </td>
                        <td className="text-right tabular-nums text-tehlike">
                          {artiMi ? "—" : para(tutar)}
                        </td>
                        <td>
                          {silebilir && h.tur !== "ACILIS" && !kaynakli ? (
                            <HareketSilDugmesi
                              id={h.id}
                              virman={Boolean(h.virmanGrubu)}
                              aciklama={`${tarih(h.tarih)} — ${h.aciklama ?? ""} (${para(tutar)})`}
                            />
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Satir({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{etiket}</dt>
      <dd className="truncate">{deger}</dd>
    </div>
  )
}
