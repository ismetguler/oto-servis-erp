/**
 * ESKİ SİSTEMDEN İÇE AKTARIM — işçilik + parça kataloğu.
 *
 * Kaynak: `Db_be.accdb` → `Stoklar` tablosu (`2026-09-14_18-17-04/stoklar.json`,
 * disa-aktar-accdb.ps1 ile dökülür). Bu tablo parça VE işçilik kalemlerinin
 * karışık listesi — `Iscilik` bayrağı güvenilmez (sadece 8 satırda işaretli,
 * hepsi silinmiş). Ayrım isim bazlı bir anahtar kelime listesiyle yapılıyor
 * (aşağıdaki ISCILIK_ANAHTAR_KELIME / ISCILIK_TEK_KELIME).
 *
 * Fiyat bilgisi kaynakta yok (fiyatlar `Servis` tablosunda işlem bazlıydı,
 * kalıcı bir liste fiyatı hiç tutulmamış) — bu yüzden hepsi 0 TL ile aktarılır,
 * İşletme ilk kullanımda güncel fiyatları kendisi girecek.
 *
 * Çalıştırma:
 *   npx tsx prisma/ice-aktar-iscilik-stok.ts --dry-run   (sadece sınıflandırmayı yazdırır, DB'ye dokunmaz)
 *   npx tsx prisma/ice-aktar-iscilik-stok.ts             (gerçekten aktarır — boş DB'de TEK SEFERLİK)
 */
import "dotenv/config"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient, type Prisma } from "../src/generated/prisma/client"

async function siradakiNumara(
  tx: Prisma.TransactionClient,
  tur: "ISCILIK_KOD" | "STOK_KOD",
  { varsayilanOnEk, basamak }: { varsayilanOnEk: string; basamak: number }
): Promise<string> {
  const yil = 0
  await tx.numarator.upsert({
    where: { tur_yil: { tur, yil } },
    update: {},
    create: { tur, yil, onEk: varsayilanOnEk, sonNo: 0 },
  })
  const sayac = await tx.numarator.update({
    where: { tur_yil: { tur, yil } },
    data: { sonNo: { increment: 1 } },
    select: { onEk: true, sonNo: true },
  })
  return `${sayac.onEk}${String(sayac.sonNo).padStart(basamak, "0")}`
}

const KAYNAK_KLASOR = join(import.meta.dirname, "..", "..", "2026-09-14_18-17-04")
const DRY_RUN = process.argv.includes("--dry-run")

type StokSatiri = {
  Id: number
  Kod: string
  Aciklama: string
  InsertTime: string | null
  DeleteTime: string | null
  Iscilik: boolean
}

// İsimde geçerse işçilik/hizmet sayılır (parça değil).
const ISCILIK_ANAHTAR_KELIME = [
  "İŞCİLİK",
  "İŞÇİLİK",
  "İŞLERİ",
  "İŞLEMİ",
  "AYAR",
  "AYARI",
  "TEMİZLİK",
  "TEMİZLİĞİ",
  "TEMİZLEME",
  "TEMİZLEYİCİ",
  "YIKAMA",
  "TESTİ",
  "BALANS",
  "BAKIM",
  "REVİZYON",
  "PROGLAMLAMA",
  "PROGRAMLAMA",
  "KAYNAK",
  "KALİBRASYON",
  "ONARIM",
  "TAMİR",
  "TAMİRİ",
  "DEĞİŞİM",
  "SÖK TAK",
]

// Anahtar kelimeye takılsa da aslında ürün/parça olan istisnalar.
const PARCA_ISTISNA = new Set([
  "TEMİZLEME SPREYİ",
  "MOTOR TEMİZLEME SPREY",
  "TEMİZLEME BENZİNİ",
  "VİTES TAMİR TAKIM",
])

// Tek başına bu kelimelerden oluşan satırlar (meslek/dış hizmet adı) → işçilik.
const ISCILIK_TEK_KELIME = new Set([
  "TORNACI",
  "LPGCİ",
  "EGSOZCU",
  "KİLİTÇİ",
  "ŞASECİ",
  "REKTEFİYECİ",
  "AMARTİSÖRCÜ",
  "KURTARICI",
  "KAPAKÇI",
  "POMPACI",
  "BEYİNCİ",
  "ENJEKTÖR POMPACI",
  "DİSK TORNASI",
  "KAMPANA TORNA",
  "VOLANT TORNA",
])

function bosMu(s: string | null | undefined): boolean {
  return s === null || s === undefined || s.trim() === ""
}

function isciliMi(ad: string): boolean {
  const u = ad.toLocaleUpperCase("tr-TR").trim()
  if (PARCA_ISTISNA.has(u)) return false
  if (ISCILIK_TEK_KELIME.has(u)) return true
  return ISCILIK_ANAHTAR_KELIME.some((kelime) => u.includes(kelime))
}

async function main() {
  console.log(`İçe aktarım başlıyor… ${DRY_RUN ? "(DRY RUN — DB'ye yazılmayacak)" : ""}\n`)

  const jsonOku = (dosya: string) =>
    JSON.parse(readFileSync(join(KAYNAK_KLASOR, dosya), "utf8").replace(/^﻿/, ""))

  const satirlar: StokSatiri[] = jsonOku("stoklar.json")

  const iscilikler: { kaynakId: number; ad: string; insertTime: string | null }[] = []
  const stoklar: { kaynakId: number; ad: string; insertTime: string | null }[] = []
  let silinmisAtlandi = 0
  let bosAtlandi = 0

  for (const s of satirlar) {
    if (!bosMu(s.DeleteTime)) {
      silinmisAtlandi++
      continue
    }
    const ad = (s.Aciklama ?? s.Kod ?? "").trim()
    if (bosMu(ad)) {
      bosAtlandi++
      continue
    }
    const hedef = isciliMi(ad) ? iscilikler : stoklar
    hedef.push({ kaynakId: s.Id, ad, insertTime: s.InsertTime })
  }

  console.log(`  · ${satirlar.length} Stoklar satırı`)
  console.log(`  · ${silinmisAtlandi} silinmiş (DeleteTime dolu) atlandı`)
  console.log(`  · ${bosAtlandi} boş isim atlandı`)
  console.log(`  → ${iscilikler.length} işçilik, ${stoklar.length} parça/stok olarak sınıflandırıldı\n`)

  if (DRY_RUN) {
    const rapor = [
      `=== İŞÇİLİK (${iscilikler.length}) ===`,
      ...iscilikler.map((i) => `${i.kaynakId}\t${i.ad}`),
      "",
      `=== PARÇA / STOK (${stoklar.length}) ===`,
      ...stoklar.map((s) => `${s.kaynakId}\t${s.ad}`),
    ].join("\n")
    const raporYolu = join(KAYNAK_KLASOR, "iscilik-stok-siniflandirma.txt")
    writeFileSync(raporYolu, rapor, "utf8")
    console.log(`Dry run tamam. Sınıflandırma listesi yazıldı: ${raporYolu}`)
    return
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })

  try {
    let iscilikOlusturuldu = 0
    for (const i of iscilikler) {
      const kod = await prisma.$transaction((tx) =>
        siradakiNumara(tx, "ISCILIK_KOD", { varsayilanOnEk: "IS", basamak: 5 })
      )
      await prisma.iscilik.create({
        data: {
          kod,
          ad: i.ad,
          sure: 0,
          fiyat: 0,
          olusturmaTarihi: i.insertTime ? new Date(i.insertTime) : new Date(),
        },
      })
      iscilikOlusturuldu++
    }
    console.log(`  ✓ ${iscilikOlusturuldu} işçilik oluşturuldu`)

    let stokOlusturuldu = 0
    for (const s of stoklar) {
      const kod = await prisma.$transaction((tx) =>
        siradakiNumara(tx, "STOK_KOD", { varsayilanOnEk: "S", basamak: 6 })
      )
      await prisma.stok.create({
        data: {
          kod,
          ad: s.ad,
          tipi: "PARCA",
          alisFiyat: 0,
          satisFiyat: 0,
          olusturmaTarihi: s.insertTime ? new Date(s.insertTime) : new Date(),
        },
      })
      stokOlusturuldu++
    }
    console.log(`  ✓ ${stokOlusturuldu} parça/stok oluşturuldu`)
    console.log("\nTamamlandı.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((hata) => {
  console.error("İçe aktarım başarısız:", hata)
  process.exit(1)
})
