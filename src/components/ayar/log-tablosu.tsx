"use client"

import { Fragment, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { LOG_ISLEM_ADLARI, LOG_ISLEM_ROZET } from "@/app/(panel)/ayar/log/sema"
import type { LogIslem } from "@/generated/prisma/enums"
import { tarihSaat } from "@/lib/bicim"

export type LogSatiriVerisi = {
  id: number
  tarih: Date
  islem: LogIslem
  kullaniciGosterim: string
  tablo: string | null
  kayitId: number | null
  aciklama: string | null
  eskiDeger: unknown
  yeniDeger: unknown
  ip: string | null
}

/**
 * SATIR TIKLANINCA EŞKİ/YENİ DEĞER KARŞILAŞTIRMASI (ADIM 11.5.4)
 *
 * Bu ekran SADECE OKUMA olduğu için genişletme tamamen istemci tarafında —
 * sunucudan ek veri istemez, `eskiDeger`/`yeniDeger` zaten satırla geldi.
 * Aşırı mühendislik yapılmadı: iki JSON yan yana değil, "alan: eski → yeni"
 * biçiminde tek liste — değişen alan kalın, değişmeyen soluk gösteriliyor.
 */
export function LogTablosu({ satirlar }: { satirlar: LogSatiriVerisi[] }) {
  const [acikId, setAcikId] = useState<number | null>(null)

  return (
    <div className="tablo-sarmal">
      <table className="veri-tablosu">
        <thead>
          <tr>
            <th className="w-8" />
            <th>Tarih / Saat</th>
            <th>Kullanıcı</th>
            <th>İşlem</th>
            <th>Tablo</th>
            <th>Açıklama</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => {
            const acik = acikId === s.id
            const detayVar = s.eskiDeger != null || s.yeniDeger != null
            return (
              <Fragment key={s.id}>
                <tr
                  onClick={() => detayVar && setAcikId(acik ? null : s.id)}
                  className={detayVar ? "cursor-pointer hover:bg-secondary/40" : undefined}
                >
                  <td className="text-muted-foreground">
                    {detayVar ? (
                      acik ? (
                        <ChevronDown className="size-3.5" aria-hidden />
                      ) : (
                        <ChevronRight className="size-3.5" aria-hidden />
                      )
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap font-mono text-[0.75rem]">
                    {tarihSaat(s.tarih)}
                  </td>
                  <td>{s.kullaniciGosterim}</td>
                  <td>
                    <span
                      className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${LOG_ISLEM_ROZET[s.islem]}`}
                    >
                      {LOG_ISLEM_ADLARI[s.islem]}
                    </span>
                  </td>
                  <td className="text-muted-foreground">
                    {s.tablo ?? "—"}
                    {s.kayitId ? ` #${s.kayitId}` : ""}
                  </td>
                  <td className="max-w-[28rem] truncate">{s.aciklama ?? "—"}</td>
                  <td className="font-mono text-[0.75rem] text-muted-foreground">{s.ip ?? "—"}</td>
                </tr>
                {acik ? (
                  <tr className="bg-secondary/20">
                    <td />
                    <td colSpan={6} className="px-3 py-3">
                      <DegerKarsilastirma eski={s.eskiDeger} yeni={s.yeniDeger} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** İki JSON'u alan alan karşılaştırır — sadece değişen alanlar vurgulanır. */
function DegerKarsilastirma({ eski, yeni }: { eski: unknown; yeni: unknown }) {
  const eskiNesne = nesneyeCevir(eski)
  const yeniNesne = nesneyeCevir(yeni)
  const anahtarlar = [...new Set([...Object.keys(eskiNesne), ...Object.keys(yeniNesne)])].sort()

  if (anahtarlar.length === 0) {
    return <p className="text-[0.8125rem] text-muted-foreground">Kayıtlı ayrıntı yok.</p>
  }

  return (
    <div className="grid gap-1 text-[0.8125rem]">
      {anahtarlar.map((anahtar) => {
        const eskiDeger = deger(eskiNesne[anahtar])
        const yeniDeger = deger(yeniNesne[anahtar])
        const degisti = eskiDeger !== yeniDeger
        return (
          <div key={anahtar} className="flex flex-wrap gap-1.5">
            <span className="font-mono text-[0.75rem] text-muted-foreground">{anahtar}:</span>
            {anahtar in eskiNesne ? (
              <span className={degisti ? "text-tehlike line-through" : "text-muted-foreground"}>
                {eskiDeger}
              </span>
            ) : null}
            {anahtar in eskiNesne && anahtar in yeniNesne ? (
              <span className="text-muted-foreground">→</span>
            ) : null}
            {anahtar in yeniNesne ? (
              <span className={degisti ? "font-medium text-basari" : "text-muted-foreground"}>
                {yeniDeger}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** `logKaydet` zaten şifre gibi alanları "***" ile maskeliyor — burada TEKRAR maskelenmiyor. */
function nesneyeCevir(deger: unknown): Record<string, unknown> {
  if (deger && typeof deger === "object" && !Array.isArray(deger)) {
    return deger as Record<string, unknown>
  }
  return {}
}

function deger(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Evet" : "Hayır"
  return String(v)
}
