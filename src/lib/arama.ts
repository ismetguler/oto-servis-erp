/**
 * TÜRKÇE ARAMA YARDIMCISI
 *
 * İki sorunu birden çözer:
 *
 * 1. **Harf körlüğü** — Prisma `mode: "insensitive"` PostgreSQL `lower()`
 *    kullanır: `lower('I')='i'`, `lower('İ')='i̇'`, `lower('ı')='ı'` → "USTASI"
 *    araması "ustası" kaydını BULMAZ.
 * 2. **Aksan körlüğü** — yaşlı esnaf "yag filtresi" yazar, kayıt "YAĞ FİLTRESİ"
 *    olduğu için hiçbir şey çıkmaz.
 *
 * Çözüm: arama teriminin Türkçe harf çiftlerinden (i/ı · g/ğ · s/ş · c/ç ·
 * o/ö · u/ü) birini içeren her konum için İKİ varyantı da üretip `OR` ile
 * hepsini `contains` ederiz. Kalan büyük/küçük harf farkını yine
 * `mode: "insensitive"` hallediyor. Terim kısa olduğundan (genelde 1-2
 * kelime) varyant sayısı küçük kalır; çift-üretilebilir 6'dan fazla harf
 * varsa (≥64 varyant) varyant üretmeden düz insensitive eşleşmeye düşülür.
 */

/** Aranınca birbirinin yerine geçen harf çiftleri (hepsi küçük hâliyle sonuç). */
const KARAKTER_GRUPLARI: [string, string[]][] = [
  ["iıİI", ["i", "ı"]],
  ["gğGĞ", ["g", "ğ"]],
  ["sşSŞ", ["s", "ş"]],
  ["cçCÇ", ["c", "ç"]],
  ["oöOÖ", ["o", "ö"]],
  ["uüUÜ", ["u", "ü"]],
]

const GRUP_HARITASI = new Map<string, string[]>()
for (const [harfler, secenekler] of KARAKTER_GRUPLARI) {
  for (const h of harfler) GRUP_HARITASI.set(h, secenekler)
}

const MAKS_KONUM = 6

/**
 * Arama terimini Türkçe harf körlüğünü kapatacak varyant kümesine açar.
 * Değişken harf yoksa tek elemanlı ([terim]) döner.
 */
export function aramaVaryantlari(terim: string): string[] {
  const t = terim.trim()
  if (!t) return []

  const konumlar: { i: number; secenekler: string[] }[] = []
  for (let i = 0; i < t.length; i++) {
    const s = GRUP_HARITASI.get(t[i])
    if (s) konumlar.push({ i, secenekler: s })
  }
  if (konumlar.length === 0 || konumlar.length > MAKS_KONUM) return [t]

  const kume = new Set<string>()
  const toplam = 1 << konumlar.length
  for (let maske = 0; maske < toplam; maske++) {
    const harfler = t.split("")
    konumlar.forEach((k, idx) => {
      harfler[k.i] = k.secenekler[(maske >> idx) & 1]
    })
    kume.add(harfler.join(""))
  }
  return [...kume]
}

/**
 * Tek bir alan için Türkçe-duyarlı `OR` parçaları. Nokta içeren alan adı
 * (`"cari.unvan"`) iç içe koşula çevrilir. Tür parametresi çağıran tarafın
 * `Prisma.<Model>WhereInput` beklentisine uysun diye var — gövde düz nesne
 * üretiyor, tek iç cast burada.
 */
export function aramaAlanKosullari<T = Record<string, unknown>>(
  alan: string,
  terim: string
): T[] {
  return aramaVaryantlari(terim).map(
    (v) => iceGom(alan, { contains: v, mode: "insensitive" }) as T
  )
}

/**
 * Birden çok alan için Türkçe-duyarlı `OR` dizisi. Sonuç doğrudan bir
 * Prisma `where.OR` dizisine konabilir ya da başka OR girdileriyle
 * birleştirilebilir.
 */
export function aramaKosullari<T = Record<string, unknown>>(
  alanlar: string[],
  terim: string
): T[] {
  const varyantlar = aramaVaryantlari(terim)
  const kosullar: T[] = []
  for (const alan of alanlar) {
    for (const v of varyantlar) {
      kosullar.push(iceGom(alan, { contains: v, mode: "insensitive" }) as T)
    }
  }
  return kosullar
}

function iceGom(yol: string, deger: unknown): Record<string, unknown> {
  const parcalar = yol.split(".")
  const kok: Record<string, unknown> = {}
  let imlec = kok
  parcalar.forEach((p, i) => {
    if (i === parcalar.length - 1) {
      imlec[p] = deger
    } else {
      const sonraki: Record<string, unknown> = {}
      imlec[p] = sonraki
      imlec = sonraki
    }
  })
  return kok
}
