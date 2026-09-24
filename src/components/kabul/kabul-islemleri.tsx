"use client"

import { useTransition } from "react"
import { CheckCircle2, FileText, PauseCircle, ReceiptText, RotateCcw, Trash2, Truck, Wallet } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import {
  kabulBayrakDegistir,
  kabulDurumDegistir,
  kabulSilmeDurumu,
} from "@/app/(panel)/servis/kabul/actions"
import type { KabulDurum } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { para } from "@/lib/bicim"

/**
 * Kabul kartının durum/teslim/fatura düğmeleri.
 *
 * Teslim etme ayrı bir düğme: kaydetme sırasında yanlışlıkla kapanmasın diye
 * (kart kapandığında cariye borç yazılıyor ve satırlar kilitleniyor —
 * geri alınabilir ama kullanıcıyı şaşırtmamalı).
 */
export function KabulIslemleri({
  kabulId,
  durum,
  silinmis,
  faturaKesildi,
  odendi,
  kabulNo,
  genelToplam,
  duzeltebilir,
  silebilir,
  fatura,
}: {
  kabulId: number
  durum: KabulDurum
  silinmis: boolean
  faturaKesildi: boolean
  odendi: boolean
  kabulNo: string
  /** Onay sorusunda tutarı göstermek için — "Tahsil Edildi" işareti parayla ilgili, kullanıcı neyi onayladığını görmeli. */
  genelToplam: number
  duzeltebilir: boolean
  silebilir: boolean
  /** Bu karta bağlı geçerli fatura (adım 9.2) — yoksa dönüştürme düğmesi çıkar. */
  fatura: { id: number; evrakNo: string } | null
}) {
  const [bekliyor, basla] = useTransition()

  function durumaGec(yeni: KabulDurum, soru?: string) {
    if (soru && !confirm(soru)) return
    basla(async () => {
      const sonuc = await kabulDurumDegistir(kabulId, yeni)
      if (sonuc.hata) toast.error(sonuc.hata)
      else {
        toast.success("Kart durumu güncellendi.")
        // Teslim geri alınınca borç kalkar ama tahsilat durur; bu bilgi
        // kaybolmasın diye ayrı ve uzun süreli uyarı gösteriliyor.
        if (sonuc.uyari) toast.warning(sonuc.uyari, { duration: 10000 })
      }
    })
  }

  function bayrakDegistir(alan: "faturaKesildi" | "odendi", deger: boolean) {
    const soru =
      alan === "odendi"
        ? deger
          ? `${kabulNo} nolu kart için ${para(genelToplam)} tahsil edildi olarak işaretlensin mi?`
          : `${kabulNo} için "Tahsil Edildi" işareti kaldırılsın mı?`
        : deger
          ? `${kabulNo} faturalandı olarak işaretlensin mi?`
          : `${kabulNo} için "Faturalandı" işareti kaldırılsın mı?`
    if (!confirm(soru)) return
    basla(async () => {
      const sonuc = await kabulBayrakDegistir(kabulId, alan, deger)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success("İşaret güncellendi.")
    })
  }

  function silmeDurumu() {
    const soru = silinmis
      ? `${kabulNo} geri alınsın mı?`
      : `${kabulNo} silinsin mi? Parça çıkışları stoğa geri yüklenir, cari borcu iptal edilir.`
    if (!confirm(soru)) return
    basla(async () => {
      const sonuc = await kabulSilmeDurumu(kabulId, !silinmis)
      if (sonuc.hata) toast.error(sonuc.hata)
      else toast.success(silinmis ? "Kart geri alındı." : "Kart silindi.")
    })
  }

  const kapali = durum === "TESLIM_EDILDI"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {duzeltebilir && !kapali ? (
        <>
          {durum !== "BEKLEMEDE" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={bekliyor}
              onClick={() => durumaGec("BEKLEMEDE")}
            >
              <PauseCircle className="size-4" aria-hidden />
              Beklemeye Al
            </Button>
          ) : null}
          {durum !== "TAMAMLANDI" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={bekliyor}
              onClick={() => durumaGec("TAMAMLANDI")}
            >
              <CheckCircle2 className="size-4" aria-hidden />
              İşi Tamamla
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={bekliyor}
            onClick={() =>
              durumaGec(
                "TESLIM_EDILDI",
                "Araç teslim edilsin mi? Kart kapanır, satırlar kilitlenir ve genel toplam cariye borç yazılır."
              )
            }
          >
            <Truck className="size-4" aria-hidden />
            Aracı Teslim Et
          </Button>
        </>
      ) : null}

      {duzeltebilir && kapali ? (
        <Button
          variant="outline"
          size="sm"
          disabled={bekliyor}
          onClick={() =>
            durumaGec("ACIK", "Kart geri açılsın mı? Cariye yazılan borç hareketi silinir.")
          }
        >
          <RotateCcw className="size-4" aria-hidden />
          Kartı Geri Aç
        </Button>
      ) : null}

      {/*
        KABULDEN FATURAYA (adım 9.2). Kart kapanmadan faturalanamaz: satırlar
        hâlâ değişebilir olurdu. Fatura zaten varsa düğme yerini o faturaya
        giden bağlantıya bırakıyor — ikinci kez dönüştürme sunulmuyor.
      */}
      {fatura ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/evrak/satis/${fatura.id}`}>
            <ReceiptText className="size-4" aria-hidden />
            Faturayı Gör ({fatura.evrakNo})
          </Link>
        </Button>
      ) : duzeltebilir && kapali && !silinmis ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/evrak/satis/yeni?kabulId=${kabulId}`}>
            <ReceiptText className="size-4" aria-hidden />
            Faturaya Dönüştür
          </Link>
        </Button>
      ) : null}

      {duzeltebilir ? (
        <>
          <Button
            variant={faturaKesildi ? "secondary" : "ghost"}
            size="sm"
            disabled={bekliyor}
            onClick={() => bayrakDegistir("faturaKesildi", !faturaKesildi)}
          >
            <FileText className="size-4" aria-hidden />
            {faturaKesildi ? "Faturası Kesildi" : "Faturalandı İşaretle"}
          </Button>
          <Button
            variant={odendi ? "secondary" : "ghost"}
            size="sm"
            disabled={bekliyor}
            onClick={() => bayrakDegistir("odendi", !odendi)}
          >
            <Wallet className="size-4" aria-hidden />
            {odendi ? "Tahsil Edildi" : "Tahsil Edildi İşaretle"}
          </Button>
        </>
      ) : null}

      {silebilir ? (
        <Button
          variant={silinmis ? "outline" : "ghost"}
          size="sm"
          disabled={bekliyor}
          onClick={silmeDurumu}
          className={silinmis ? undefined : "text-tehlike hover:text-tehlike"}
        >
          {silinmis ? (
            <RotateCcw className="size-4" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          {silinmis ? "Geri Al" : "Sil"}
        </Button>
      ) : null}
    </div>
  )
}
