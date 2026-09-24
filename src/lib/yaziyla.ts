/**
 * TUTARI YAZIYLA — makbuz / fatura çıktılarında "yalnız ... ile" satırı için.
 *
 * Neden burada: tek bir yerde tutulsun ki her belge aynı Türkçe yazımı
 * kullansın (para() biçimlendirmesinin sözle karşılığı). Tahsilat makbuzu
 * (12.9) ilk kullanan; ileride fatura şablonları da buradan besleyebilir.
 *
 * Kapsam: 0 – 999.999.999,99 ₺. Kuruş iki haneye yuvarlanır. Bu ERP tek
 * işletmelik bir oto servis; milyar üstü tutar beklenmiyor, sınır aşılırsa
 * sadece rakamla yazılan tutar zaten belgede duruyor.
 */

const BIRLER = [
  "",
  "bir",
  "iki",
  "üç",
  "dört",
  "beş",
  "altı",
  "yedi",
  "sekiz",
  "dokuz",
]
const ONLAR = [
  "",
  "on",
  "yirmi",
  "otuz",
  "kırk",
  "elli",
  "altmış",
  "yetmiş",
  "seksen",
  "doksan",
]

/** 0–999 arası bir sayıyı yazıya çevirir. */
function ucHane(n: number): string {
  const yuz = Math.floor(n / 100)
  const kalan = n % 100
  const on = Math.floor(kalan / 10)
  const bir = kalan % 10

  const parcalar: string[] = []
  // "yüz" (bir yüz değil), "iki yüz" ...
  if (yuz === 1) parcalar.push("yüz")
  else if (yuz > 1) parcalar.push(`${BIRLER[yuz]} yüz`)
  if (on > 0) parcalar.push(ONLAR[on])
  if (bir > 0) parcalar.push(BIRLER[bir])

  return parcalar.join(" ")
}

/** 1250.5 -> "bin iki yüz elli" */
export function sayiyiYaziyaCevir(tamsayi: number): string {
  let n = Math.floor(Math.abs(tamsayi))
  if (n === 0) return "sıfır"

  const gruplar: number[] = []
  while (n > 0) {
    gruplar.push(n % 1000)
    n = Math.floor(n / 1000)
  }

  const ADLAR = ["", "bin", "milyon", "milyar"]
  const parcalar: string[] = []
  for (let i = gruplar.length - 1; i >= 0; i--) {
    const grup = gruplar[i]
    if (grup === 0) continue
    // "bir bin" değil sadece "bin"
    if (i === 1 && grup === 1) {
      parcalar.push("bin")
      continue
    }
    parcalar.push(`${ucHane(grup)}${i > 0 ? ` ${ADLAR[i]}` : ""}`.trim())
  }

  return parcalar.join(" ")
}

/**
 * 1250.5 -> "bin iki yüz elli türk lirası elli kuruş"
 * Kuruş yoksa yalnız lira kısmı yazılır.
 */
export function tutariYaziyaCevir(tutar: number): string {
  const yuvarli = Math.round(Math.abs(tutar) * 100) / 100
  const lira = Math.floor(yuvarli)
  const kurus = Math.round((yuvarli - lira) * 100)

  const parcalar: string[] = [`${sayiyiYaziyaCevir(lira)} türk lirası`]
  if (kurus > 0) parcalar.push(`${sayiyiYaziyaCevir(kurus)} kuruş`)

  const metin = parcalar.join(" ")
  return metin.charAt(0).toLocaleUpperCase("tr") + metin.slice(1)
}
