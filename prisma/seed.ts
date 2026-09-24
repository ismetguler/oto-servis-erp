import "dotenv/config"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { TanimTur } from "../src/generated/prisma/enums"
import { numaratorleriDenklestir } from "./numarator-tamir"
import { stokMaliyetleriniDoldur } from "./stok-maliyet-tamir"

/**
 * BAŞLANGIÇ VERİSİ
 *
 * Boş bir veritabanını çalışır hâle getirir:
 *   - firma kaydı (tek satır)
 *   - yönetici kullanıcı
 *   - merkez depo
 *   - araç markaları, renkler, yakıt/vites türleri, işçilik bölümleri gibi
 *     olmazsa olmaz tanım listeleri
 *
 * Tekrar tekrar çalıştırılabilir (upsert kullanır), veri bozmaz.
 *   çalıştırmak için:  npm run db:seed
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const YONETICI_KOD = process.env.SEED_ADMIN_KOD ?? "admin"
const YONETICI_SIFRE = process.env.SEED_ADMIN_SIFRE ?? "Servis2026!"

const MARKALAR = [
  "AUDI", "BMW", "CHEVROLET", "CITROEN", "CUPRA", "DACIA", "DS", "FIAT",
  "FORD", "HONDA", "HYUNDAI", "ISUZU", "IVECO", "JEEP", "KIA", "LAND ROVER",
  "MAN", "MAZDA", "MERCEDES-BENZ", "MG", "MINI", "MITSUBISHI", "NISSAN",
  "OPEL", "PEUGEOT", "PORSCHE", "RENAULT", "SEAT", "SKODA", "SSANGYONG",
  "SUBARU", "SUZUKI", "TOFAŞ", "TOGG", "TOYOTA", "VOLKSWAGEN", "VOLVO",
]

const RENKLER = [
  "BEYAZ", "SİYAH", "GRİ", "GÜMÜŞ", "KIRMIZI", "MAVİ", "LACİVERT",
  "YEŞİL", "KAHVERENGİ", "BEJ", "SARI", "TURUNCU", "BORDO",
]

const YAKIT_TURLERI = ["BENZİN", "DİZEL", "LPG", "BENZİN + LPG", "HİBRİT", "ELEKTRİK"]
const VITES_TURLERI = ["MANUEL", "OTOMATİK", "YARI OTOMATİK", "CVT", "DSG"]
const KASA_TIPLERI = [
  "SEDAN", "HATCHBACK", "STATION WAGON", "SUV", "COUPE", "CABRIO",
  "MINIVAN", "PANELVAN", "PICKUP", "KAMYONET", "KAMYON", "OTOBÜS",
]
const ARAC_TURLERI = ["BİNEK", "HAFİF TİCARİ", "AĞIR TİCARİ", "MOTOSİKLET", "İŞ MAKİNESİ"]
const ARAC_NEREDE = [
  "KABUL ALANI", "LİFT 1", "LİFT 2", "LİFT 3", "YIKAMA", "BOYAHANE",
  "TEST SÜRÜŞÜ", "PARÇA BEKLİYOR", "DIŞ SERVİSTE", "TESLİME HAZIR",
]
const ISCILIK_BOLUMLERI = [
  "MEKANİK", "ELEKTRİK", "KAPORTA", "BOYA", "DÖŞEME", "LASTİK",
  "KLİMA", "EGZOZ", "FREN SİSTEMİ", "PERİYODİK BAKIM", "DİAGNOSTİK",
]
const ISTEK_TURLERI = ["PERİYODİK BAKIM", "ARIZA", "KAZA / HASAR", "MUAYENE HAZIRLIK", "GARANTİ", "EKSPERTİZ"]
const KART_TURLERI = ["NORMAL", "GARANTİ", "SİGORTA", "İÇ İŞ", "FİLO"]
// Selpar Araç Kabul ekranındaki "bakım şekli" ve "proje" dropdownları.
const BAKIM_SEKILLERI = [
  "10.000 KM BAKIM", "20.000 KM BAKIM", "30.000 KM BAKIM", "40.000 KM BAKIM",
  "60.000 KM BAKIM", "ARA BAKIM", "GENEL BAKIM", "YILLIK BAKIM",
]
const PROJELER = ["FİLO SÖZLEŞMESİ", "SİGORTA ANLAŞMALI", "KAMPANYA", "İÇ ARAÇ"]

/**
 * Araç marka/model kataloğunu `arac-model-katalog.json`'dan yükler
 * (SA-5 / madde 15). Katalogda hiç kayıt yoksa toplu ekler; doluysa
 * atlar — ayrıntılı/idempotent yükleme `prisma/arac-model-seed.ts`'te.
 */
async function aracModelKatalogunuYukle() {
  const mevcut = await prisma.aracModelKatalog.count()
  if (mevcut > 0) {
    console.log(`  ✓ Araç model kataloğu (zaten ${mevcut} kayıt, atlandı)`)
    return
  }
  const dosya = join(import.meta.dirname, "arac-model-katalog.json")
  const liste: { marka: string; model: string }[] = JSON.parse(
    readFileSync(dosya, "utf8")
  )
  for (let i = 0; i < liste.length; i += 200) {
    await prisma.aracModelKatalog.createMany({
      data: liste.slice(i, i + 200).map((c) => ({ ...c, kilitli: true })),
      skipDuplicates: true,
    })
  }
  console.log(`  ✓ Araç model kataloğu (${liste.length} kayıt yüklendi)`)
}

async function main() {
  console.log("Başlangıç verisi yükleniyor…\n")

  // ---- 1) Firma (tek satır, id = 1) ----
  const firma = await prisma.firma.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      unvan: "GÜNDÜZ OTO SERVİS SAN. VE TİC. LTD. ŞTİ.",
      il: "KAYSERİ",
      varsayilanKdv: 20,
    },
  })
  console.log(`  ✓ Firma: ${firma.unvan}`)

  // ---- 2) Yönetici kullanıcı ----
  const mevcut = await prisma.kullanici.findUnique({ where: { kod: YONETICI_KOD } })
  if (mevcut) {
    console.log(`  · Yönetici zaten var: ${YONETICI_KOD} (şifre değiştirilmedi)`)
  } else {
    await prisma.kullanici.create({
      data: {
        kod: YONETICI_KOD,
        ad: "Sistem",
        soyad: "Yöneticisi",
        sifreHash: await bcrypt.hash(YONETICI_SIFRE, 12),
        rol: "YONETICI",
      },
    })
    console.log(`  ✓ Yönetici oluşturuldu: ${YONETICI_KOD} / ${YONETICI_SIFRE}`)
  }

  // ---- 3) Depolar ----
  await prisma.depo.upsert({
    where: { kod: "MERKEZ" },
    update: {},
    create: { kod: "MERKEZ", ad: "Merkez Depo", varsayilan: true },
  })
  // Şube deposu: depo transferinin (8.6) hedefi olarak en az iki depo gerekir.
  await prisma.depo.upsert({
    where: { kod: "SUBE1" },
    update: {},
    create: { kod: "SUBE1", ad: "Şube 1 Deposu" },
  })
  console.log("  ✓ Depolar (Merkez, Şube 1)")

  // ---- 4) Tanım listeleri ----
  const gruplar: Array<[TanimTur, string[]]> = [
    [TanimTur.ARAC_MARKA, MARKALAR],
    [TanimTur.ARAC_RENK, RENKLER],
    [TanimTur.YAKIT_TURU, YAKIT_TURLERI],
    [TanimTur.VITES_TURU, VITES_TURLERI],
    [TanimTur.KASA_TIPI, KASA_TIPLERI],
    [TanimTur.ARAC_TURU, ARAC_TURLERI],
    [TanimTur.ARAC_NEREDE, ARAC_NEREDE],
    [TanimTur.ISCILIK_BOLUMU, ISCILIK_BOLUMLERI],
    [TanimTur.ISTEK_TURU, ISTEK_TURLERI],
    [TanimTur.KART_TURU, KART_TURLERI],
    [TanimTur.BAKIM_SEKLI, BAKIM_SEKILLERI],
    [TanimTur.PROJE, PROJELER],
  ]

  for (const [tur, adlar] of gruplar) {
    let eklenen = 0
    for (const [sira, ad] of adlar.entries()) {
      const varMi = await prisma.tanim.findFirst({
        where: { tur, ad, ustId: null },
        select: { id: true },
      })
      if (!varMi) {
        await prisma.tanim.create({ data: { tur, ad, sira } })
        eklenen++
      }
    }
    console.log(`  ✓ ${tur}: ${adlar.length} kayıt (${eklenen} yeni)`)
  }

  // ---- 5) Numaratörler ----
  const yil = new Date().getFullYear()

  // Evrak numaraları her yıl 1'den başlar; cari ve stok kodu ise ömür boyu
  // artar (müşteri kodu yıl değişti diye tekrar edemez). Yıl bazlı olmayan
  // sayaçlar YILSIZ (0) satırında tutulur — bkz. src/lib/numarator.ts
  const yilBazli = [
    { tur: "KABUL" as const, onEk: `KB${yil}-` },
    { tur: "SERVIS_FATURA" as const, onEk: "SF-" },
    { tur: "SATIS_FATURA" as const, onEk: "ST-" },
    { tur: "ALIS_FATURA" as const, onEk: "AL-" },
    // Ön ekte yıl OLMAK ZORUNDA: sayaç her yıl sıfırlandığı için yılsız ön ek
    // 2027'de aynı fiş numarasını yeniden üretir ve @@unique([tur, fisNo])
    // kısıtına takılırdı (KABUL'de baştan doğru yapılmıştı).
    { tur: "TAHSILAT" as const, onEk: `TH${yil}-` },
    { tur: "TEDIYE" as const, onEk: `TD${yil}-` },
  ]
  for (const n of yilBazli) {
    const varMi = await prisma.numarator.findFirst({ where: { tur: n.tur, yil } })
    if (!varMi) await prisma.numarator.create({ data: { ...n, yil, sonNo: 0 } })
  }

  const yilsiz = [
    { tur: "CARI_KOD" as const, onEk: "C" },
    { tur: "STOK_KOD" as const, onEk: "S" },
  ]
  for (const n of yilsiz) {
    // Şemanın ilk hâlinde bu iki sayaç yanlışlıkla yıl bazlı açılmıştı;
    // kullanılmamış eski satırları temizliyoruz ki iki sayaç yan yana durmasın.
    await prisma.numarator.deleteMany({ where: { tur: n.tur, yil: { not: 0 }, sonNo: 0 } })
    const varMi = await prisma.numarator.findFirst({ where: { tur: n.tur, yil: 0 } })
    if (!varMi) await prisma.numarator.create({ data: { ...n, yil: 0, sonNo: 0 } })
  }
  console.log(`  ✓ Numaratörler (${yil} + yılsız)`)

  // Sayaçlar, dışarıdan (elle SQL / eski demo verisi) eklenmiş belge
  // numaralarının gerisinde kalmışsa ileri al — yoksa ilk yeni kayıt
  // "zaten var olan numara" hatasıyla açılamaz.
  const denk = await numaratorleriDenklestir(prisma)
  console.log(`  ✓ Numaratör denkleştirme (${denk} düzeltme)`)

  // Ort. maliyeti hiç yazılmamış kartları son alış fiyatıyla doldur.
  await stokMaliyetleriniDoldur(prisma)

  // Araç marka/model kataloğu (SA-5). Zaten doluysa dokunmaz.
  await aracModelKatalogunuYukle()

  console.log("\nTamamlandı.")
  if (!mevcut) {
    console.log(`\n  GİRİŞ:  kod = ${YONETICI_KOD}   şifre = ${YONETICI_SIFRE}`)
    console.log("  ⚠ İlk girişten sonra bu şifreyi mutlaka değiştirin.\n")
  }
}

main()
  .catch((hata) => {
    console.error("Başlangıç verisi yüklenemedi:", hata)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
