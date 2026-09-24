/**
 * DENEME VERİSİ — sadece geliştirme/test için.
 *
 * `seed.ts` sistemin çalışması için gereken kalıcı verileri (firma, tanımlar,
 * numaratör) kurar; bu dosya ise ekranları gerçek veriyle denemek için örnek
 * cari / araç / stok / işçilik / personel ekler. Canlıya çıkarken
 * çalıştırılmaz. Tekrar tekrar çalıştırılabilir (var olanı tekrar eklemez).
 *
 * Çalıştırma:  npx tsx prisma/deneme-verisi.ts
 */
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  console.log("Deneme verisi yükleniyor…\n")

  const musteri = await prisma.cari.upsert({
    where: { kod: "C000901" },
    update: {},
    create: {
      kod: "C000901",
      unvan: "DENEME NAKLİYAT LTD. ŞTİ.",
      turu: "MUSTERI",
      tipi: "SIRKET",
      vergiNo: "1234567890",
      vergiDair: "KAYSERİ",
      yetkili: "Ahmet Deneme",
      telefon: "03521112233",
      gsm: "05321112233",
      il: "KAYSERİ",
      ilce: "MELİKGAZİ",
    },
  })
  console.log(`  ✓ Müşteri: ${musteri.unvan}`)

  const personel = await prisma.cari.upsert({
    where: { kod: "P000901" },
    update: {},
    create: {
      kod: "P000901",
      unvan: "MEHMET USTA",
      turu: "PERSONEL",
      tipi: "SAHIS",
    },
  })
  console.log(`  ✓ Personel: ${personel.unvan}`)

  const arac = await prisma.arac.upsert({
    where: { plaka: "38ABC123" },
    update: {},
    create: {
      plaka: "38ABC123",
      cariId: musteri.id,
      marka: "FORD",
      modelUst: "TRANSIT",
      model: "TRANSIT 350L",
      modelYili: 2021,
      renk: "BEYAZ",
      yakitTuru: "DİZEL",
      vitesTuru: "MANUEL",
      kasaTipi: "PANELVAN",
      aracTuru: "HAFİF TİCARİ",
      saseNo: "NM0KXXTTFKDU12345",
      motorHacmi: "2.0",
      sonKm: 128_400,
      muayeneBitis: new Date("2026-11-30"),
      trafikSigBitis: new Date("2026-06-15"), // bilerek geçmiş: uyarı denenebilsin
      kaskoBitis: new Date("2027-03-01"),
    },
  })
  console.log(`  ✓ Araç: ${arac.plaka}`)

  const depo = await prisma.depo.findFirst({ where: { varsayilan: true } })

  const stoklar = [
    { kod: "S0001", ad: "YAĞ FİLTRESİ", satisFiyat: 320, alisFiyat: 210 },
    { kod: "S0002", ad: "MOTOR YAĞI 5W30 (1 LT)", satisFiyat: 480, alisFiyat: 340 },
    { kod: "S0003", ad: "ÖN FREN BALATASI TAKIM", satisFiyat: 1850, alisFiyat: 1200 },
    { kod: "S0004", ad: "POLEN FİLTRESİ", satisFiyat: 410, alisFiyat: 260 },
  ]

  for (const s of stoklar) {
    await prisma.stok.upsert({
      where: { kod: s.kod },
      update: {},
      create: {
        ...s,
        tipi: "PARCA",
        birim: "ADET",
        mevcutMiktar: 25,
        minSeviye: 5,
        kdvOrani: 20,
        depoId: depo?.id ?? null,
      },
    })
  }
  console.log(`  ✓ Stok: ${stoklar.length} kart`)

  const mekanik = await prisma.tanim.findFirst({
    where: { tur: "ISCILIK_BOLUMU", ad: "MEKANİK" },
  })
  const periyodik = await prisma.tanim.findFirst({
    where: { tur: "ISCILIK_BOLUMU", ad: "PERİYODİK BAKIM" },
  })

  const iscilikler = [
    { kod: "I0001", ad: "PERİYODİK BAKIM İŞÇİLİĞİ", sure: 1.5, fiyat: 1500, bolumId: periyodik?.id },
    { kod: "I0002", ad: "FREN BALATA DEĞİŞİMİ", sure: 1, fiyat: 900, bolumId: mekanik?.id },
    { kod: "I0003", ad: "ARIZA TESPİT / DİAGNOSTİK", sure: 0.5, fiyat: 600, bolumId: mekanik?.id },
  ]

  for (const i of iscilikler) {
    await prisma.iscilik.upsert({
      where: { kod: i.kod },
      update: {},
      create: { ...i, kdvOrani: 20 },
    })
  }
  console.log(`  ✓ İşçilik: ${iscilikler.length} kart`)

  console.log("\nTamamlandı.")
}

main()
  .catch((hata) => {
    console.error(hata)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
