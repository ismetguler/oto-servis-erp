/**
 * Araç marka/model kataloğunu (SA-5 / madde 15) doldurur.
 *
 * Kaynak: `prisma/arac-model-katalog.json` — abhionlyone/us-car-models-data
 * (MIT, 2005–2024) tekilleştirilmiş (marka, model) çiftleri + elle eklenmiş
 * Türkiye pazarı markaları. Üretim betiği repo dışıdır; JSON dosyası
 * versiyonlanır, tek gerçek kaynak odur.
 *
 * Tüm satırlar `kilitli = true` yazılır → Ayarlar > Araç Modelleri
 * ekranından değiştirilemez / silinemez. Kullanıcı yalnızca yeni
 * (kilitli = false) satır ekler.
 *
 * Idempotent: `@@unique([marka, model])` üzerinden `upsert`. Var olan elle
 * eklenmiş bir satırla çakışırsa onu kilitler (katalog artık resmî kaynak).
 *
 * Çalıştırma:  npx tsx prisma/arac-model-seed.ts
 */
import "dotenv/config"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

type Cesit = { marka: string; model: string }

async function main() {
  const dosya = join(import.meta.dirname, "arac-model-katalog.json")
  const liste: Cesit[] = JSON.parse(readFileSync(dosya, "utf8"))

  console.log(`${liste.length} kayıt yükleniyor…`)
  let eklenen = 0
  let guncellenen = 0

  // Neon havuzlu bağlantıda tek tek upsert güvenli; 25'lik gruplar hâlinde.
  for (let i = 0; i < liste.length; i += 25) {
    const grup = liste.slice(i, i + 25)
    const sonuclar = await prisma.$transaction(
      grup.map((c) =>
        prisma.aracModelKatalog.upsert({
          where: { marka_model: { marka: c.marka, model: c.model } },
          create: { marka: c.marka, model: c.model, kilitli: true },
          update: { kilitli: true, aktif: true },
        })
      )
    )
    for (const s of sonuclar) {
      if (s.olusturmaTarihi.getTime() === s.guncellemeTarihi.getTime()) eklenen++
      else guncellenen++
    }
  }

  const toplam = await prisma.aracModelKatalog.count()
  const markaSayisi = (
    await prisma.aracModelKatalog.findMany({
      distinct: ["marka"],
      select: { marka: true },
    })
  ).length

  console.log(
    `Bitti — yeni: ${eklenen}, güncellenen: ${guncellenen}. ` +
      `Katalogda toplam ${toplam} model / ${markaSayisi} marka.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
