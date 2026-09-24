/**
 * NUMARATÖR DENKLEŞTİRME
 *
 * Sorun: bir belge (kabul, evrak, fiş…) numaratör sayacı artırılmadan
 * veritabanına yazılırsa (elle SQL, eski demo verisi, yarım kalan migration),
 * `siradakiNumara` bir sonraki çağrıda ZATEN VAR OLAN numarayı üretir ve
 * `@unique` kısıtına takılır — yeni kayıt açılamaz.
 *
 * Bu yardımcı her sayaç için, o sayacın KENDİ ön ekiyle (onEk) başlayıp
 * kalanı SADECE rakam olan gerçek kayıtların en büyük sıra numarasını bulur;
 * sayaç geride kalmışsa ileri alır. Ön ek + saf rakam şartı sayesinde
 * "C000901" gibi bilerek yüksek verilmiş demo kodları veya "TEST-FAT-001"
 * gibi elle numaralar sayacı yanlışlıkla ileri fırlatmaz.
 *
 * Idempotent. seed.ts sonunda çağrılır; ayrıca `tsx prisma/numarator-tamir.ts`.
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

type Kaynak = {
  tur: string
  yilBazli: boolean
  numaralar: (p: PrismaClient) => Promise<string[]>
}

const KAYNAKLAR: Kaynak[] = [
  {
    tur: "KABUL",
    yilBazli: true,
    numaralar: (p) =>
      p.kabul.findMany({ select: { kabulNo: true } }).then((r) => r.map((x) => x.kabulNo)),
  },
]

/** onEk ile başlayıp kalanı SADECE rakam olan kayıtların en büyük sayısı. */
function onEkliMax(numaralar: string[], onEk: string): number {
  let max = 0
  for (const n of numaralar) {
    if (!n.startsWith(onEk)) continue
    const kalan = n.slice(onEk.length)
    if (!/^\d+$/.test(kalan)) continue
    max = Math.max(max, parseInt(kalan, 10))
  }
  return max
}

export async function numaratorleriDenklestir(
  prisma: PrismaClient,
  { sessiz = false }: { sessiz?: boolean } = {}
): Promise<number> {
  const yil = new Date().getFullYear()
  let degisen = 0
  for (const k of KAYNAKLAR) {
    const sayac = await prisma.numarator.findFirst({
      where: { tur: k.tur as never, yil: k.yilBazli ? yil : 0 },
    })
    if (!sayac) continue
    const gercekMax = onEkliMax(await k.numaralar(prisma), sayac.onEk)
    if (gercekMax > sayac.sonNo) {
      await prisma.numarator.update({ where: { id: sayac.id }, data: { sonNo: gercekMax } })
      if (!sessiz) console.log(`  ✓ ${k.tur}: sonNo ${sayac.sonNo} → ${gercekMax}`)
      degisen++
    }
  }
  return degisen
}

// CLI olarak çalıştırıldığında
const buDosya = process.argv[1]?.replace(/\\/g, "/")
if (buDosya && buDosya.endsWith("numarator-tamir.ts")) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  numaratorleriDenklestir(prisma)
    .then((n) => console.log(n ? `\n${n} sayaç denkleştirildi.` : "\nHer şey zaten denk."))
    .finally(() => prisma.$disconnect())
}
