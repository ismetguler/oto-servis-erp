import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

/**
 * Prisma istemcisi — tek örnek (singleton).
 *
 * Next.js geliştirme modunda her dosya değişikliğinde modüller yeniden yüklenir.
 * Bu koruma olmazsa her yenilemede yeni bir bağlantı havuzu açılır ve kısa sürede
 * "too many connections" hatası alınır.
 *
 * Bağlantı standart PostgreSQL sürücüsü (pg) üzerinden kurulur; böylece proje
 * Neon'a da, ileride kendi sunucusundaki bir PostgreSQL'e de aynı kodla bağlanır.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function istemciOlustur() {
  const baglantiAdresi = process.env.DATABASE_URL
  if (!baglantiAdresi) {
    throw new Error(
      "DATABASE_URL tanımlı değil. .env dosyasını .env.example'a bakarak doldurun."
    )
  }

  const adapter = new PrismaPg({ connectionString: baglantiAdresi })

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["warn", "error"],
  })
}

export const prisma = globalForPrisma.prisma ?? istemciOlustur()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
