/**
 * STOK ORTALAMA MALİYET GERİYE DOLDURMA
 *
 * `ortalamaMaliyet` alanı uzun süre yalnız stok kartının elle düzenlenmesiyle
 * yazılıyordu; alış faturası kesince güncellenmiyordu (12.8'de düzeltildi).
 * Bu yüzden mevcut kartlarda alan çoğunlukla 0 ve envanter / maliyet-satış /
 * onarım kârlılık raporları stoğu sıfır değerle gösteriyor.
 *
 * Bu yardımcı, maliyeti 0 olup son alış fiyatı bilinen kartların
 * `ortalamaMaliyet` alanını `alisFiyat` ile doldurur (ileride yapılan
 * alışlar ağırlıklı ortalamayı buradan hesaplar). Idempotent.
 *
 * seed.ts sonunda çağrılır; ayrıca `tsx prisma/stok-maliyet-tamir.ts`.
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

export async function stokMaliyetleriniDoldur(
  prisma: PrismaClient,
  { sessiz = false }: { sessiz?: boolean } = {}
): Promise<number> {
  const adaylar = await prisma.stok.findMany({
    where: { silindi: false, ortalamaMaliyet: 0, alisFiyat: { gt: 0 } },
    select: { id: true, kod: true, alisFiyat: true },
  })
  for (const s of adaylar) {
    await prisma.stok.update({
      where: { id: s.id },
      data: { ortalamaMaliyet: s.alisFiyat },
    })
  }
  if (!sessiz && adaylar.length) console.log(`  ✓ Stok ort. maliyet dolduruldu: ${adaylar.length} kart`)
  return adaylar.length
}

const buDosya = process.argv[1]?.replace(/\\/g, "/")
if (buDosya && buDosya.endsWith("stok-maliyet-tamir.ts")) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  stokMaliyetleriniDoldur(prisma)
    .then((n) => console.log(n ? `\n${n} kart güncellendi.` : "\nDüzeltilecek kart yok."))
    .finally(() => prisma.$disconnect())
}
