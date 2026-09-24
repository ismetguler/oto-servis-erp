/**
 * ESKİ SİSTEMDEN İÇE AKTARIM — cari + araç (madde 3.2, TESLIM-PLANI.md).
 *
 * Kaynak: Db_be.accdb (Access) — `2026-09-14_18-17-04/disa-aktar-accdb.ps1`
 * ile önce `firmalar.json` / `araclar.json`'a dökülmüş olmalı (ODBC ile
 * doğrudan okumak yerine: Node'da Access sürücüsüne bağımlı kalmamak için
 * PowerShell/ODBC katmanı bir kere JSON'a döküyor, bu script sadece JSON
 * okuyor). Kasa/bakiye/servis geçmişi AKTARILMIYOR — sadece Cari + Araç.
 *
 * Tüm kararlar TESLIM-PLANI.md madde 3.1'de yazılı (birleştirme anahtarı,
 * Model/Yıl düzeltmeleri, FirmaId=0 çözümü, alan eşleştirme tablosu).
 *
 * Boş bir DB'ye (madde 1 sonrası) çalıştırılmak üzere yazıldı. Tekrar
 * çalıştırılırsa aynı kod/plakalarla ikinci kez oluşturmaya çalışıp
 * unique kısıtına çarpar — bu YÜZDEN TEK SEFERLİK, dolu DB'de tekrar
 * ÇALIŞTIRILMAMALI.
 *
 * Çalıştırma:  npx tsx prisma/ice-aktar-cari-arac.ts
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

type FirmaSatiri = {
  Id: number
  Ad: string
  Yetkili: string
  Telefon: string
  VD: string
  VN: string
  Adres: string
  InsertTime: string
  DeleteTime: string | null
  IsFirma: boolean
}

type AracSatiri = {
  Id: number
  FirmaId: number
  PlakaNo: string
  Marka: string
  Model: string
  Yil: string
  SaseNo: string
  AdSoyad: string
  Telefon: string
  InsertTime: string
  DeleteTime: string | null
  IsServis: boolean
}

// ---- normalize yardımcıları (madde 3.1 karar a) ----

function normalizeAd(s: string): string {
  return (s ?? "")
    .toLocaleUpperCase("tr-TR")
    .replace(/[İI]/g, "I")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ü/g, "U")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeTel(s: string): string {
  return (s ?? "").replace(/\D/g, "")
}

function bosMu(s: string | null | undefined): boolean {
  return s === null || s === undefined || s.trim() === ""
}

function birlestirmeAnahtari(vn: string, ad: string, telefon: string): string {
  const vnTrim = (vn ?? "").trim()
  if (!bosMu(vnTrim)) return `VN:${vnTrim}`
  return `AD:${normalizeAd(ad)}|TEL:${normalizeTel(telefon)}`
}

// ---- kimlik grubu: gerçek Firmalar satırı veya FirmaId=0 araç sahibi ----

type KimlikKaynagi =
  | { tur: "firma"; firmaId: number }
  | { tur: "aracSahibi"; aracId: number }

type KimlikSatiri = {
  kaynak: KimlikKaynagi
  ad: string
  yetkili: string
  telefon: string
  vd: string
  vn: string
  adres: string
  insertTime: string
  isFirma: boolean
}

async function main() {
  console.log("İçe aktarım başlıyor…\n")

  const jsonOku = (dosya: string) =>
    JSON.parse(readFileSync(join(KAYNAK_KLASOR, dosya), "utf8").replace(/^﻿/, ""))

  const firmalar: FirmaSatiri[] = jsonOku("firmalar.json")
  const araclar: AracSatiri[] = jsonOku("araclar.json")

  // ---- 1) Kimlik satırlarını topla: aktif Firmalar + FirmaId=0 dolu sahipler ----

  const kimlikler: KimlikSatiri[] = []
  let atlananFirmaSilinmis = 0
  for (const f of firmalar) {
    if (!bosMu(f.DeleteTime)) {
      atlananFirmaSilinmis++
      continue
    }
    kimlikler.push({
      kaynak: { tur: "firma", firmaId: f.Id },
      ad: f.Ad ?? "",
      yetkili: f.Yetkili ?? "",
      telefon: f.Telefon ?? "",
      vd: f.VD ?? "",
      vn: f.VN ?? "",
      adres: f.Adres ?? "",
      insertTime: f.InsertTime,
      isFirma: !!f.IsFirma,
    })
  }

  let aracSahibiSayisi = 0
  for (const a of araclar) {
    if (a.FirmaId !== 0) continue
    if (!bosMu(a.DeleteTime)) continue
    if (bosMu(a.AdSoyad) || normalizeTel(a.Telefon).length < 7) continue
    aracSahibiSayisi++
    kimlikler.push({
      kaynak: { tur: "aracSahibi", aracId: a.Id },
      ad: a.AdSoyad,
      yetkili: "",
      telefon: a.Telefon,
      vd: "",
      vn: "",
      adres: "",
      insertTime: a.InsertTime,
      isFirma: false,
    })
  }

  console.log(
    `  · ${firmalar.length} Firmalar satırı (${atlananFirmaSilinmis} silinmiş atlandı), ` +
      `${aracSahibiSayisi} FirmaId=0 araç sahibi eklendi → ${kimlikler.length} kimlik satırı`
  )

  // ---- 2) Birleştirme anahtarına göre grupla ----

  const gruplar = new Map<string, KimlikSatiri[]>()
  for (const k of kimlikler) {
    const anahtar = birlestirmeAnahtari(k.vn, k.ad, k.telefon)
    const grup = gruplar.get(anahtar)
    if (grup) grup.push(k)
    else gruplar.set(anahtar, [k])
  }

  console.log(`  · ${gruplar.size} benzersiz cari grubu bulundu\n`)

  // ---- 3) Numaratör: mevcut sayaçtan devam et ----

  let cariSayac = (
    await prisma.numarator.upsert({
      where: { tur_yil: { tur: "CARI_KOD", yil: 0 } },
      update: {},
      create: { tur: "CARI_KOD", yil: 0, onEk: "C", sonNo: 0 },
    })
  ).sonNo

  // firmaId / aracId (sahipsiz araç sahibi) -> yeni Cari.id
  const firmaIdToCariId = new Map<number, number>()
  const aracSahibiIdToCariId = new Map<number, number>()

  let cariOlusturuldu = 0
  for (const [, grup] of gruplar) {
    const siraliZamanArtan = [...grup].sort((a, b) =>
      a.insertTime.localeCompare(b.insertTime)
    )
    const birincil = siraliZamanArtan[siraliZamanArtan.length - 1] // en son InsertTime

    const alan = (secici: (k: KimlikSatiri) => string): string => {
      const v = secici(birincil)
      if (!bosMu(v)) return v.trim()
      for (const k of siraliZamanArtan) {
        const alt = secici(k)
        if (!bosMu(alt)) return alt.trim()
      }
      return ""
    }

    const ad = alan((k) => k.ad) || "(AD YOK)"
    const yetkili = alan((k) => k.yetkili)
    const telefon = alan((k) => k.telefon)
    const vd = alan((k) => k.vd)
    const vn = alan((k) => k.vn)
    const adres = alan((k) => k.adres)
    const enEskiInsertTime = siraliZamanArtan[0].insertTime

    cariSayac++
    const kod = `C${String(cariSayac).padStart(6, "0")}`

    const cari = await prisma.cari.create({
      data: {
        kod,
        unvan: ad,
        turu: "MUSTERI",
        tipi: birincil.isFirma ? "SIRKET" : "SAHIS",
        yetkili: yetkili || null,
        gsm: telefon || null,
        vergiDair: vd || null,
        vergiNo: vn || null,
        adres: adres || null,
        olusturmaTarihi: new Date(enEskiInsertTime),
      },
      select: { id: true },
    })
    cariOlusturuldu++

    for (const k of grup) {
      if (k.kaynak.tur === "firma") firmaIdToCariId.set(k.kaynak.firmaId, cari.id)
      else aracSahibiIdToCariId.set(k.kaynak.aracId, cari.id)
    }
  }

  await prisma.numarator.update({
    where: { tur_yil: { tur: "CARI_KOD", yil: 0 } },
    data: { sonNo: cariSayac },
  })

  console.log(`  ✓ ${cariOlusturuldu} cari oluşturuldu (kod C${"0".repeat(6)}+)\n`)

  // ---- 4) Araçlar ----
  //
  // Aynı plakaya birden fazla satır düşebiliyor (araç her servise girişte
  // yeniden yazdırılmış — tıpkı Firmalar'daki mükerrerlik gibi). `Arac.plaka`
  // @unique olduğu için plaka başına tek satır seçilir: önce cariId'si
  // çözülebilen satırlar tercih edilir (bir tekrarı sahipsiz FirmaId=0 ile
  // girilmiş olabiliyor), aralarından en son InsertTime'lı olan kazanır;
  // hiçbiri sahiplenilemiyorsa en son InsertTime'lı satır kazanır.

  type AracHazir = {
    kaynak: AracSatiri
    plaka: string
    cariId: number | null
    model: string | null
    modelYili: number | null
    notlar: string[]
  }

  let aracSilinmisAtlandi = 0
  let aracBosPlakaAtlandi = 0
  const plakayaGoreSatirlar = new Map<string, AracHazir[]>()

  for (const a of araclar) {
    if (!bosMu(a.DeleteTime)) {
      aracSilinmisAtlandi++
      continue
    }

    const plaka = (a.PlakaNo ?? "").toLocaleUpperCase("tr-TR").replace(/\s+/g, "")
    if (bosMu(plaka)) {
      aracBosPlakaAtlandi++
      console.warn(`  ⚠ Araç Id=${a.Id}: plaka boş, atlandı.`)
      continue
    }

    // cariId çözümü (madde 3.1 karar c)
    let cariId: number | null = null
    const notlar: string[] = []
    if (a.FirmaId !== 0) {
      cariId = firmaIdToCariId.get(a.FirmaId) ?? null
      if (cariId === null) {
        notlar.push(`Kaynak FirmaId: ${a.FirmaId} (eşleşen cari bulunamadı)`)
      }
    } else if (aracSahibiIdToCariId.has(a.Id)) {
      cariId = aracSahibiIdToCariId.get(a.Id)!
    } else {
      // sahipsiz — cariId null; varsa ham veriyi notlara yaz
      if (!bosMu(a.AdSoyad)) notlar.push(`Kaynak AdSoyad: ${a.AdSoyad}`)
      if (!bosMu(a.Telefon)) notlar.push(`Kaynak Telefon: ${a.Telefon}`)
    }

    // Model/Yıl düzeltmesi (madde 3.1 karar b)
    let model = bosMu(a.Model) ? null : a.Model.trim()
    let modelYili: number | null = null

    if (a.Id === 41) {
      model = "A4"
      modelYili = 2008
      notlar.push(`Kaynak veri düzeltmesi: Model/Yıl takas edilmişti (Model="2008", Yıl="A4")`)
    } else {
      const yilHam = (a.Yil ?? "").trim()
      const yilSayi = Number.parseInt(yilHam, 10)
      if (
        !bosMu(yilHam) &&
        Number.isInteger(yilSayi) &&
        yilSayi >= 1970 &&
        yilSayi <= 2027 &&
        String(yilSayi) === yilHam
      ) {
        modelYili = yilSayi
      } else if (!bosMu(yilHam)) {
        notlar.push(`Kaynak Yil: ${yilHam}`)
      }
    }

    const hazir: AracHazir = { kaynak: a, plaka, cariId, model, modelYili, notlar }
    const liste = plakayaGoreSatirlar.get(plaka)
    if (liste) liste.push(hazir)
    else plakayaGoreSatirlar.set(plaka, [hazir])
  }

  let aracOlusturuldu = 0
  let aracCariIdNull = 0
  let aracPlakaMukerrerAtlandi = 0

  for (const [, satirlar] of plakayaGoreSatirlar) {
    let kazanan = satirlar[0]
    if (satirlar.length > 1) {
      aracPlakaMukerrerAtlandi += satirlar.length - 1
      const sahiplenilenler = satirlar.filter((s) => s.cariId !== null)
      const havuz = sahiplenilenler.length > 0 ? sahiplenilenler : satirlar
      kazanan = havuz.reduce((enIyi, aday) =>
        aday.kaynak.InsertTime.localeCompare(enIyi.kaynak.InsertTime) > 0 ? aday : enIyi
      )
      console.warn(
        `  ⚠ Plaka "${kazanan.plaka}" için ${satirlar.length} satır bulundu ` +
          `(Id: ${satirlar.map((s) => s.kaynak.Id).join(", ")}), Id=${kazanan.kaynak.Id} tutuldu.`
      )
    }

    if (kazanan.cariId === null) aracCariIdNull++

    await prisma.arac.create({
      data: {
        plaka: kazanan.plaka,
        cariId: kazanan.cariId,
        marka: bosMu(kazanan.kaynak.Marka) ? null : kazanan.kaynak.Marka.trim(),
        model: kazanan.model,
        modelYili: kazanan.modelYili,
        saseNo: bosMu(kazanan.kaynak.SaseNo) ? null : kazanan.kaynak.SaseNo.trim(),
        notlar: kazanan.notlar.length > 0 ? kazanan.notlar.join(" | ") : null,
        olusturmaTarihi: new Date(kazanan.kaynak.InsertTime),
      },
    })
    aracOlusturuldu++
  }

  console.log(`  ✓ ${aracOlusturuldu} araç oluşturuldu`)
  console.log(`  · ${aracSilinmisAtlandi} araç silinmiş (DeleteTime dolu) olduğu için atlandı`)
  console.log(`  · ${aracBosPlakaAtlandi} araç boş plaka nedeniyle atlandı`)
  console.log(`  · ${aracPlakaMukerrerAtlandi} araç mükerrer plaka nedeniyle atlandı (aynı plakanın en iyi satırı tutuldu)`)
  console.log(`  · ${aracCariIdNull} araç sahipsiz kaldı (cariId = null)`)

  console.log("\n--- ÖZET ---")
  console.log(`Firmalar: ${firmalar.length} satır, ${atlananFirmaSilinmis} silinmiş atlandı`)
  console.log(`  → ${cariOlusturuldu} cari oluşturuldu (${gruplar.size} benzersiz grup)`)
  console.log(`Araclar: ${araclar.length} satır, ${aracSilinmisAtlandi} silinmiş atlandı, ${aracBosPlakaAtlandi} boş plakalı atlandı, ${aracPlakaMukerrerAtlandi} mükerrer plaka atlandı`)
  console.log(`  → ${aracOlusturuldu} araç oluşturuldu, ${aracCariIdNull} tanesi cariId=null`)
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
