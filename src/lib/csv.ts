import "server-only"

/**
 * CSV ÜRETİMİ (Excel uyumlu)
 *
 * İki ayrıntı Türkiye'de kritik:
 *  1. Ayırıcı virgül DEĞİL noktalı virgül. Türkçe Windows'ta Excel'in
 *     beklediği ayırıcı budur; virgül kullanılırsa tüm satır tek hücreye düşer.
 *  2. Dosyanın başına BOM konur. Konmazsa Excel dosyayı UTF-8 saymaz ve
 *     "ÖZ ANADOLU" yerine "Ã–Z ANADOLU" görünür.
 *
 * Tutarlar da Türkçe yazımla (1.250,50) yazılır ki Excel sayı olarak alsın.
 */

const AYIRICI = ";"
const BOM = "﻿"

export type CsvHucre = string | number | null | undefined

function hucre(deger: CsvHucre): string {
  if (deger === null || deger === undefined) return ""
  const metin = String(deger)
  // Ayırıcı, tırnak veya satır sonu içeren hücre tırnaklanır;
  // içindeki tırnak da ikiye katlanır (CSV standardı).
  if (metin.includes(AYIRICI) || metin.includes('"') || /[\r\n]/.test(metin)) {
    return `"${metin.replace(/"/g, '""')}"`
  }
  return metin
}

export function csvOlustur(basliklar: string[], satirlar: CsvHucre[][]): string {
  const govde = [basliklar, ...satirlar]
    .map((satir) => satir.map(hucre).join(AYIRICI))
    .join("\r\n")
  return BOM + govde
}

/** Excel'in sayı olarak tanıyacağı Türkçe yazım: 1250.5 -> "1.250,50" */
export function csvTutar(deger: unknown): string {
  const sayi = Number(String(deger ?? 0))
  if (!Number.isFinite(sayi)) return "0,00"
  return sayi.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** 24.08.2026 — Excel tarih olarak tanır. */
export function csvTarih(deger: Date | null | undefined): string {
  if (!deger) return ""
  return deger.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** İndirilen dosyanın tarayıcıya "kaydet" dedirtmesi için gereken başlıklar. */
export function csvYaniti(icerik: string, dosyaAdi: string): Response {
  return new Response(icerik, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
      // Rapor her indirilişte güncel veriyi vermeli, ara bellekten gelmemeli.
      "Cache-Control": "no-store",
    },
  })
}
