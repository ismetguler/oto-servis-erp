import "server-only"

import { tarih as tarihBicim, tarihSaat } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * İŞLEM KAYDI HAFTALIK ÖZET (SA-6)
 *
 * `/api/bakim/log-mail` bunu kullanır: verilen aralık için `islem_loglari`
 * özeti (tip + kullanıcı kırılımı) ve tam CSV döküm üretir. Mail gövdesi +
 * CSV eki buradan çıkar; ekran/başka yerde kullanılmaz.
 */
const ISLEM_ADI: Record<string, string> = {
  GIRIS: "Giriş",
  GIRIS_BASARISIZ: "Başarısız giriş",
  CIKIS: "Çıkış",
  EKLE: "Ekleme",
  GUNCELLE: "Güncelleme",
  SIL: "Silme",
  GERI_AL: "Geri alma",
  YAZDIR: "Yazdırma",
  DISA_AKTAR: "Dışa aktarma",
}

export type LogOzet = {
  bas: Date
  bit: Date
  toplam: number
  tipDagilimi: { islem: string; ad: string; adet: number }[]
  kullaniciDagilimi: { kullanici: string; adet: number }[]
  csv: string
}

function kullaniciAdi(k: {
  kullanici: { ad: string | null; soyad: string | null } | null
  kullaniciKod: string | null
}): string {
  if (k.kullanici) {
    const tam = [k.kullanici.ad, k.kullanici.soyad].filter(Boolean).join(" ")
    if (tam) return tam
  }
  return k.kullaniciKod ?? "—"
}

export async function logOzetiUret(bas: Date, bit: Date): Promise<LogOzet> {
  const kayitlar = await prisma.islemLog.findMany({
    where: { tarih: { gte: bas, lte: bit } },
    orderBy: { tarih: "asc" },
    select: {
      tarih: true,
      islem: true,
      tablo: true,
      kayitId: true,
      aciklama: true,
      ip: true,
      kullaniciKod: true,
      kullanici: { select: { ad: true, soyad: true } },
    },
  })

  const tipSayac = new Map<string, number>()
  const kulSayac = new Map<string, number>()
  for (const k of kayitlar) {
    tipSayac.set(k.islem, (tipSayac.get(k.islem) ?? 0) + 1)
    const kul = kullaniciAdi(k)
    kulSayac.set(kul, (kulSayac.get(kul) ?? 0) + 1)
  }

  const tipDagilimi = [...tipSayac.entries()]
    .map(([islem, adet]) => ({ islem, ad: ISLEM_ADI[islem] ?? islem, adet }))
    .sort((a, b) => b.adet - a.adet)
  const kullaniciDagilimi = [...kulSayac.entries()]
    .map(([kullanici, adet]) => ({ kullanici, adet }))
    .sort((a, b) => b.adet - a.adet)

  // CSV — Excel'in Türkçe yerelinde açılabilsin diye ; ayraç + BOM (mevcut
  // dışa aktarma route'larıyla aynı yaklaşım).
  const alan = (d: unknown) => String(d ?? "").replace(/[\r\n;]+/g, " ").trim()
  const satirlar = [
    ["Tarih", "İşlem", "Tablo", "Kayıt", "Kullanıcı", "Açıklama", "IP"].join(";"),
    ...kayitlar.map((k) =>
      [
        tarihSaat(k.tarih),
        ISLEM_ADI[k.islem] ?? k.islem,
        alan(k.tablo),
        alan(k.kayitId),
        alan(kullaniciAdi(k)),
        alan(k.aciklama),
        alan(k.ip),
      ].join(";")
    ),
  ]
  const csv = "﻿" + satirlar.join("\r\n")

  return { bas, bit, toplam: kayitlar.length, tipDagilimi, kullaniciDagilimi, csv }
}

/** Mail gövdesi (düz metin). */
export function ozetMetni(o: LogOzet): string {
  const L: string[] = []
  L.push("İşlem kaydı — haftalık özet")
  L.push(`Dönem: ${tarihBicim(o.bas)} – ${tarihBicim(o.bit)}`)
  L.push("")
  L.push(`Toplam işlem: ${o.toplam}`)
  L.push("")
  L.push("İşlem türüne göre:")
  for (const t of o.tipDagilimi) L.push(`  • ${t.ad}: ${t.adet}`)
  if (o.tipDagilimi.length === 0) L.push("  • (bu dönemde kayıt yok)")
  L.push("")
  L.push("Kullanıcıya göre:")
  for (const k of o.kullaniciDagilimi) L.push(`  • ${k.kullanici}: ${k.adet}`)
  if (o.kullaniciDagilimi.length === 0) L.push("  • (bu dönemde kayıt yok)")
  L.push("")
  L.push("Ayrıntılı döküm ekteki CSV dosyasındadır.")
  L.push(
    "Not: Bu özet gönderildikten sonra bu döneme ait giriş/çıkış/yazdırma kayıtları " +
      "sistemden silinir, ekleme/güncelleme kayıtlarının eski/yeni değer ayrıntısı " +
      "boşaltılır. Silme ve şüpheli giriş kayıtları korunur."
  )
  return L.join("\n")
}
