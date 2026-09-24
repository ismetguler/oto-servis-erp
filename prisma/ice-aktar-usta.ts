/**
 * ESKİ SİSTEMDEN İÇE AKTARIM — ustalar → Personel (madde 3.3, TESLIM-PLANI.md).
 *
 * Kaynak: Db_be.accdb (Access) — `2026-09-14_18-17-04/disa-aktar-accdb.ps1`
 * ile önce `ustalar.json`'a dökülmüş olmalı. Sadece 8 kayıt, DeleteTime
 * dolu satır yok, AdSoyad tekrarı yok — bu yüzden birleştirme/mükerrer
 * mantığı yok, satır satır bire bir aktarım.
 *
 * Ustalar tablosunda sadece Id + AdSoyad var; Cari'deki personel özlük
 * alanları (gorevi, iseGirisTarihi, sgkNo, maas ...) kaynakta karşılığı
 * olmadığı için boş bırakılıyor.
 *
 * Kod numarası: NumaratorTur'da PERSONEL için ayrı bir tür yok — Selpar
 * mimarisinde personel de bir Cari kaydı (turu=PERSONEL), bu yüzden aynı
 * CARI_KOD sayacından devam ediyor (madde 3.2'nin bıraktığı yerden), tıpkı
 * ice-aktar-cari-arac.ts'in yaptığı gibi.
 *
 * Boş bir DB'ye, madde 3.2'den SONRA çalıştırılmak üzere yazıldı. Tekrar
 * çalıştırılırsa aynı isimlerle ikinci kez Personel oluşturur (unvan
 * @unique değil) — bu YÜZDEN TEK SEFERLİK.
 *
 * Çalıştırma:  npx tsx prisma/ice-aktar-usta.ts
 */
import "dotenv/config"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const KAYNAK_KLASOR = join(import.meta.dirname, "..", "..", "2026-09-14_18-17-04")

type UstaSatiri = {
  Id: number
  AdSoyad: string
  DeleteTime: string | null
}

function bosMu(s: string | null | undefined): boolean {
  return s === null || s === undefined || s.trim() === ""
}

async function main() {
  console.log("Ustalar içe aktarımı başlıyor…\n")

  const ustalar: UstaSatiri[] = JSON.parse(
    readFileSync(join(KAYNAK_KLASOR, "ustalar.json"), "utf8").replace(/^﻿/, "")
  )

  let cariSayac = (
    await prisma.numarator.upsert({
      where: { tur_yil: { tur: "CARI_KOD", yil: 0 } },
      update: {},
      create: { tur: "CARI_KOD", yil: 0, onEk: "C", sonNo: 0 },
    })
  ).sonNo

  let atlananSilinmis = 0
  let olusturulan = 0

  for (const u of ustalar) {
    if (!bosMu(u.DeleteTime)) {
      atlananSilinmis++
      continue
    }

    const adSoyad = u.AdSoyad.trim()

    cariSayac++
    const kod = `C${String(cariSayac).padStart(6, "0")}`

    await prisma.cari.create({
      data: {
        kod,
        unvan: adSoyad,
        turu: "PERSONEL",
        tipi: "SAHIS",
      },
    })
    olusturulan++
    console.log(`  ✓ ${kod}  ${adSoyad}`)
  }

  await prisma.numarator.update({
    where: { tur_yil: { tur: "CARI_KOD", yil: 0 } },
    data: { sonNo: cariSayac },
  })

  console.log("\n--- ÖZET ---")
  console.log(`Ustalar: ${ustalar.length} satır, ${atlananSilinmis} silinmiş atlandı`)
  console.log(`  → ${olusturulan} Personel (Cari, turu=PERSONEL) oluşturuldu`)
  console.log("\nTamamlandı.")
}

main()
  .catch((hata) => {
    console.error("İçe aktarım başarısız:", hata)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
