/**
 * DENEME HAREKET VERİSİ — sadece demo instance için.
 *
 * `deneme-verisi.ts` usta veriyi (cari / araç / stok / işçilik) kurar ama hiç
 * HAREKET üretmez; bu yüzden demo linkinde ana sayfa ve tüm raporlar sıfır
 * görünür. Bu dosya birkaç örnek iş emri + tahsilat + satış faturası ekleyerek
 * ekranları canlı gösterir. Selim abinin incelemesi için.
 *
 * Canlıya çıkarken ASLA çalıştırılmaz (build/postinstall'da yer almıyor).
 * Tekrar çalıştırılabilir: DEMO-A kabulü zaten varsa hiçbir şey yapmaz.
 *
 * Not: server action'lar (`"use server"` + oturum + redirect) bir script'ten
 * çağrılamadığı için, kabul/tahsilat/fatura yazma mantığı burada elle ama
 * BİREBİR aynı sırayla tekrarlanıyor — tutar hesabı gerçek kodun kullandığı
 * `src/lib/hesap.ts` fonksiyonlarından geçiyor ki ekranla kuruş kuruş tutsun.
 *
 * Çalıştırma:  npx tsx prisma/deneme-hareket.ts
 */
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import type { Prisma } from "../src/generated/prisma/client"
import type { NumaratorTur } from "../src/generated/prisma/enums"
import { kabulToplamlari, kalemHesapla, kurusaYuvarla } from "../src/lib/hesap"
import type { ToplamSatiri } from "../src/lib/hesap"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

type Islem = Prisma.TransactionClient

/** `src/lib/numarator.ts` ile aynı atomik sayaç mantığı (o dosya "server-only"). */
async function siradakiNumara(
  tx: Islem,
  tur: NumaratorTur,
  onEk: string,
  basamak: number,
  yilBazli: boolean
): Promise<string> {
  const yil = yilBazli ? new Date().getFullYear() : 0
  await tx.numarator.upsert({
    where: { tur_yil: { tur, yil } },
    update: {},
    create: { tur, yil, onEk, sonNo: 0 },
  })
  const sayac = await tx.numarator.update({
    where: { tur_yil: { tur, yil } },
    data: { sonNo: { increment: 1 } },
    select: { onEk: true, sonNo: true },
  })
  return `${sayac.onEk}${String(sayac.sonNo).padStart(basamak, "0")}`
}

/** Gün cinsinden geçmişe kaydırılmış tarih. */
function gunOnce(gun: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - gun)
  return d
}

type KalemTanim = {
  tur: "PARCA" | "ISCILIK"
  aciklama: string
  stokKod?: string
  iscilikKod?: string
  miktar: number
  birimFiyat: number
  ustaya?: boolean
}

async function main() {
  console.log("Demo hareket verisi yükleniyor…\n")

  const [musteri, personel, arac, admin] = await Promise.all([
    prisma.cari.findUnique({ where: { kod: "C000901" } }),
    prisma.cari.findUnique({ where: { kod: "P000901" } }),
    prisma.arac.findUnique({ where: { plaka: "38ABC123" } }),
    prisma.kullanici.findFirst({ where: { rol: "YONETICI" }, orderBy: { id: "asc" } }),
  ])

  if (!musteri || !personel || !arac || !admin) {
    throw new Error("Önce `npm run db:seed:demo` çalıştırılmalı (usta veri eksik).")
  }

  const zatenVar = await prisma.kabul.findFirst({ where: { kabulOzelNo: "DEMO-A" } })
  if (zatenVar) {
    console.log("  • DEMO-A kabulü zaten var — hiçbir şey yapılmadı.")
    return
  }

  const stoklar = await prisma.stok.findMany({
    where: { kod: { in: ["S0001", "S0002", "S0003", "S0004"] } },
  })
  const iscilikler = await prisma.iscilik.findMany({
    where: { kod: { in: ["I0001", "I0002", "I0003"] } },
  })
  const stokBul = (kod: string) => stoklar.find((s) => s.kod === kod)!
  const iscilikBul = (kod: string) => iscilikler.find((i) => i.kod === kod)!

  /**
   * Bir kabul kartını kalemleriyle, stok çıkışıyla ve (teslimse) cari borcuyla
   * birlikte yazar. Gerçek `kabulKaydet` + `kalemKaydet` + `kabulDurumDegistir`
   * zincirinin yaptığı işin script karşılığı.
   */
  async function kabulYaz(opts: {
    ozelNo: string
    girisTarihi: Date
    teslimTarihi: Date | null
    durum: "ACIK" | "TESLIM_EDILDI"
    sikayet: string
    yapilanIsler?: string
    kalemler: KalemTanim[]
  }): Promise<{ id: number; genelToplam: number }> {
    return prisma.$transaction(async (tx) => {
      const kabulNo = await siradakiNumara(tx, "KABUL", `K${new Date().getFullYear()}-`, 5, true)

      const kabul = await tx.kabul.create({
        data: {
          kabulNo,
          kabulOzelNo: opts.ozelNo,
          durum: opts.durum,
          girisTarihi: opts.girisTarihi,
          teslimTarihi: opts.teslimTarihi,
          girisKm: arac!.sonKm ?? undefined,
          sikayet: opts.sikayet,
          yapilanIsler: opts.yapilanIsler ?? null,
          evrakKdvOrani: 20,
          cari: { connect: { id: musteri!.id } },
          arac: { connect: { id: arac!.id } },
          olusturan: { connect: { id: admin!.id } },
          personeller: { create: [{ personelId: personel!.id }] },
        },
      })

      const satirSonuclari: ToplamSatiri[] = []

      let sira = 0
      for (const k of opts.kalemler) {
        sira += 1
        const hesap = kalemHesapla(
          { miktar: k.miktar, birimFiyat: k.birimFiyat, kdvOrani: 20 },
          false
        )
        satirSonuclari.push({ ...hesap, tur: k.tur })

        const stok = k.stokKod ? stokBul(k.stokKod) : null
        const iscilik = k.iscilikKod ? iscilikBul(k.iscilikKod) : null

        const kalem = await tx.kabulKalem.create({
          data: {
            kabul: { connect: { id: kabul.id } },
            sira,
            tur: k.tur,
            aciklama: k.aciklama,
            birim: "ADET",
            miktar: k.miktar,
            birimFiyat: k.birimFiyat,
            kdvOrani: 20,
            tutar: hesap.tutar,
            kdvTutar: hesap.kdvTutar,
            toplam: hesap.toplam,
            ...(stok ? { stok: { connect: { id: stok.id } } } : {}),
            ...(iscilik ? { iscilik: { connect: { id: iscilik.id } } } : {}),
            ...(k.ustaya ? { personel: { connect: { id: personel!.id } } } : {}),
          },
        })

        // Parça satırı stoktan düşer (gerçek kodda `stokCikisiYaz`).
        if (k.tur === "PARCA" && stok) {
          await tx.stokHareket.create({
            data: {
              stok: { connect: { id: stok.id } },
              ...(stok.depoId ? { depo: { connect: { id: stok.depoId } } } : {}),
              tur: "CIKIS",
              tarih: opts.girisTarihi,
              miktar: k.miktar,
              birimFiyat: k.birimFiyat,
              tutar: hesap.tutar,
              kabulId: kabul.id,
              kabulKalemId: kalem.id,
              aciklama: "Araç kabul parça çıkışı",
              kullaniciId: admin!.id,
            },
          })
          await tx.stok.update({
            where: { id: stok.id },
            data: { mevcutMiktar: { decrement: k.miktar } },
          })
        }
      }

      const t = kabulToplamlari(satirSonuclari)
      await tx.kabul.update({
        where: { id: kabul.id },
        data: {
          parcaToplam: kurusaYuvarla(t.parcaToplam + t.disHizmetToplam),
          iscilikToplam: t.iscilikToplam,
          araToplam: t.araToplam,
          kdvToplam: t.kdvToplam,
          genelToplam: t.genelToplam,
        },
      })

      // Teslim edilen kart cariye borç yazar (gerçek kodda `kabulDurumDegistir`).
      if (opts.durum === "TESLIM_EDILDI" && t.genelToplam > 0) {
        await tx.cariHareket.create({
          data: {
            cari: { connect: { id: musteri!.id } },
            kabul: { connect: { id: kabul.id } },
            tur: "KABUL",
            tarih: opts.teslimTarihi ?? opts.girisTarihi,
            borc: t.genelToplam,
            aciklama: `Servis kabul ${kabulNo}`,
            olusturanId: admin!.id,
          },
        })
      }

      return { id: kabul.id, genelToplam: t.genelToplam }
    })
  }

  /** Kasalı (nakit) tahsilat fişi: cariye alacak + kasaya giriş. */
  async function tahsilatYaz(opts: {
    kabulId: number
    kasaId: number
    tarih: Date
    tutar: number
    kabulNoAcikla: string
  }) {
    await prisma.$transaction(async (tx) => {
      const fisNo = await siradakiNumara(
        tx,
        "TAHSILAT",
        `TH${new Date().getFullYear()}-`,
        5,
        true
      )
      const fis = await tx.tahsilat.create({
        data: {
          cari: { connect: { id: musteri!.id } },
          tur: "TAHSILAT",
          fisNo,
          tarih: opts.tarih,
          tutar: opts.tutar,
          odemeSekli: "NAKIT",
          kasa: { connect: { id: opts.kasaId } },
          kabul: { connect: { id: opts.kabulId } },
          aciklama: `${opts.kabulNoAcikla} tahsilatı`,
          olusturanId: admin!.id,
        },
      })

      await tx.cariHareket.create({
        data: {
          cari: { connect: { id: musteri!.id } },
          tahsilat: { connect: { id: fis.id } },
          tur: "TAHSILAT",
          tarih: opts.tarih,
          alacak: opts.tutar,
          aciklama: `Tahsilat ${fisNo} — nakit`,
          olusturanId: admin!.id,
        },
      })

      await tx.kasaHareket.create({
        data: {
          kasa: { connect: { id: opts.kasaId } },
          tur: "GIRIS",
          tarih: opts.tarih,
          tutar: opts.tutar,
          aciklama: `Tahsilat ${fisNo}`,
          belgeNo: fisNo,
          cari: { connect: { id: musteri!.id } },
          tahsilat: { connect: { id: fis.id } },
          olusturanId: admin!.id,
        },
      })

      // Kabulün "tahsil edildi" işareti (gerçek kodda `kabulOdendiGuncelle`).
      const kabul = await tx.kabul.findUnique({
        where: { id: opts.kabulId },
        select: { genelToplam: true },
      })
      const net = await tx.tahsilat.aggregate({
        where: { kabulId: opts.kabulId, silindi: false, tur: "TAHSILAT" },
        _sum: { tutar: true },
      })
      const genelToplam = Number((kabul?.genelToplam ?? 0).toString())
      const odendi =
        genelToplam > 0 && Number((net._sum.tutar ?? 0).toString()) >= genelToplam - 0.005
      await tx.kabul.update({ where: { id: opts.kabulId }, data: { odendi } })

      await tx.cari.update({
        where: { id: musteri!.id },
        data: { bakiye: await cariBakiye(tx) },
      })
      await tx.kasa.update({
        where: { id: opts.kasaId },
        data: { bakiye: await kasaBakiye(tx, opts.kasaId) },
      })
    })
  }

  /** Cari bakiyesi = Σ borç − Σ alacak (gerçek kodda `bakiyeyiHesapla`). */
  async function cariBakiye(tx: Islem): Promise<number> {
    const t = await tx.cariHareket.aggregate({
      where: { cariId: musteri!.id, silindi: false },
      _sum: { borc: true, alacak: true },
    })
    return (
      Number((t._sum.borc ?? 0).toString()) - Number((t._sum.alacak ?? 0).toString())
    )
  }

  /** Kasa bakiyesi = açılış + Σ giriş − Σ çıkış. */
  async function kasaBakiye(tx: Islem, kasaId: number): Promise<number> {
    const hareketler = await tx.kasaHareket.findMany({
      where: { kasaId, silindi: false },
      select: { tur: true, tutar: true },
    })
    let b = 0
    for (const h of hareketler) {
      const tutar = Number(h.tutar.toString())
      if (h.tur === "GIRIS" || h.tur === "VIRMAN_GIRIS" || h.tur === "ACILIS") b += tutar
      else b -= tutar
    }
    return b
  }

  // --------------------------------------------------------------------------
  //  1) NAKİT KASA (yoksa aç)
  // --------------------------------------------------------------------------
  let kasa = await prisma.kasa.findFirst({ where: { tur: "NAKIT", silindi: false } })
  if (!kasa) {
    kasa = await prisma.$transaction(async (tx) => {
      const kod = await siradakiNumara(tx, "KASA_KOD", "KS", 4, false)
      const yeni = await tx.kasa.create({
        data: {
          kod,
          ad: "MERKEZ NAKİT KASA",
          tur: "NAKIT",
          acilisBakiye: 5000,
          sira: 1,
          olusturanId: admin.id,
        },
      })
      await tx.kasaHareket.create({
        data: {
          kasa: { connect: { id: yeni.id } },
          tur: "ACILIS",
          tarih: gunOnce(30),
          tutar: 5000,
          aciklama: "Açılış devri",
          olusturanId: admin.id,
        },
      })
      await tx.kasa.update({ where: { id: yeni.id }, data: { bakiye: 5000 } })
      return yeni
    })
    console.log(`  ✓ Kasa açıldı: ${kasa.ad} (${kasa.kod})`)
  } else {
    console.log(`  • Kasa mevcut: ${kasa.ad}`)
  }

  // --------------------------------------------------------------------------
  //  2) KABUL A — teslim edilmiş, tamamı tahsil edilmiş (bugün)
  // --------------------------------------------------------------------------
  const kabulA = await kabulYaz({
    ozelNo: "DEMO-A",
    girisTarihi: gunOnce(2),
    teslimTarihi: new Date(),
    durum: "TESLIM_EDILDI",
    sikayet: "Periyodik bakım zamanı geldi, yağ ve filtreler değişecek.",
    yapilanIsler: "Motor yağı + yağ filtresi + polen filtresi değişimi, genel kontrol.",
    kalemler: [
      { tur: "PARCA", aciklama: "YAĞ FİLTRESİ", stokKod: "S0001", miktar: 1, birimFiyat: 320 },
      { tur: "PARCA", aciklama: "MOTOR YAĞI 5W30 (1 LT)", stokKod: "S0002", miktar: 4, birimFiyat: 480 },
      {
        tur: "ISCILIK",
        aciklama: "PERİYODİK BAKIM İŞÇİLİĞİ",
        iscilikKod: "I0001",
        miktar: 1,
        birimFiyat: 1500,
        ustaya: true,
      },
    ],
  })
  await tahsilatYaz({
    kabulId: kabulA.id,
    kasaId: kasa.id,
    tarih: new Date(),
    tutar: kabulA.genelToplam,
    kabulNoAcikla: "Periyodik bakım",
  })
  console.log(`  ✓ Kabul A (teslim + tam tahsilat): ${kabulA.genelToplam.toFixed(2)} ₺`)

  // --------------------------------------------------------------------------
  //  3) KABUL C — teslim edilmiş, KISMİ tahsilat (2 gün önce) → açık alacak
  // --------------------------------------------------------------------------
  const kabulC = await kabulYaz({
    ozelNo: "DEMO-C",
    girisTarihi: gunOnce(4),
    teslimTarihi: gunOnce(2),
    durum: "TESLIM_EDILDI",
    sikayet: "Ön tekerlerden fren yaparken ses geliyor.",
    yapilanIsler: "Ön fren balataları değişti, disk kontrol edildi.",
    kalemler: [
      {
        tur: "ISCILIK",
        aciklama: "FREN BALATA DEĞİŞİMİ",
        iscilikKod: "I0002",
        miktar: 1,
        birimFiyat: 900,
        ustaya: true,
      },
      { tur: "PARCA", aciklama: "ÖN FREN BALATASI TAKIM", stokKod: "S0003", miktar: 1, birimFiyat: 1850 },
    ],
  })
  await tahsilatYaz({
    kabulId: kabulC.id,
    kasaId: kasa.id,
    tarih: gunOnce(2),
    tutar: 1500,
    kabulNoAcikla: "Fren bakımı kısmi",
  })
  console.log(
    `  ✓ Kabul C (teslim + kısmi tahsilat): ${kabulC.genelToplam.toFixed(2)} ₺, 1500,00 ₺ tahsil`
  )

  // --------------------------------------------------------------------------
  //  4) KABUL B — serviste, iş devam ediyor (bugün açıldı)
  // --------------------------------------------------------------------------
  const kabulB = await kabulYaz({
    ozelNo: "DEMO-B",
    girisTarihi: new Date(),
    teslimTarihi: null,
    durum: "ACIK",
    sikayet: "Motor arıza lambası yandı, çekişte tekleme var.",
    kalemler: [
      {
        tur: "ISCILIK",
        aciklama: "ARIZA TESPİT / DİAGNOSTİK",
        iscilikKod: "I0003",
        miktar: 1,
        birimFiyat: 600,
        ustaya: true,
      },
      { tur: "PARCA", aciklama: "POLEN FİLTRESİ", stokKod: "S0004", miktar: 1, birimFiyat: 410 },
    ],
  })
  console.log(`  ✓ Kabul B (serviste açık): ${kabulB.genelToplam.toFixed(2)} ₺`)

  // --------------------------------------------------------------------------
  //  5) SATIŞ FATURASI — tezgâh üstü parça satışı (1 gün önce, kesildi)
  // --------------------------------------------------------------------------
  await prisma.$transaction(async (tx) => {
    const s2 = stokBul("S0002")
    const hesap = kalemHesapla(
      { miktar: 2, birimFiyat: 480, kdvOrani: 20 },
      false
    )
    const evrak = await tx.evrak.create({
      data: {
        evrakNo: "SF2026-0001",
        tur: "SATIS",
        durum: "KESILDI",
        tarih: gunOnce(1),
        cari: { connect: { id: musteri.id } },
        araToplam: hesap.tutar,
        kdvToplam: hesap.kdvTutar,
        genelToplam: hesap.toplam,
        olusturanId: admin.id,
        kalemler: {
          create: [
            {
              sira: 1,
              stok: { connect: { id: s2.id } },
              aciklama: "MOTOR YAĞI 5W30 (1 LT)",
              birim: "ADET",
              miktar: 2,
              birimFiyat: 480,
              kdvOrani: 20,
              tutar: hesap.tutar,
              kdvTutar: hesap.kdvTutar,
              toplam: hesap.toplam,
            },
          ],
        },
      },
    })

    await tx.stokHareket.create({
      data: {
        stok: { connect: { id: s2.id } },
        ...(s2.depoId ? { depo: { connect: { id: s2.depoId } } } : {}),
        tur: "CIKIS",
        tarih: gunOnce(1),
        miktar: 2,
        birimFiyat: 480,
        tutar: hesap.tutar,
        evrakId: evrak.id,
        aciklama: `Satış faturası ${evrak.evrakNo}`,
        kullaniciId: admin.id,
      },
    })
    await tx.stok.update({ where: { id: s2.id }, data: { mevcutMiktar: { decrement: 2 } } })

    await tx.cariHareket.create({
      data: {
        cari: { connect: { id: musteri.id } },
        evrak: { connect: { id: evrak.id } },
        tur: "EVRAK",
        tarih: gunOnce(1),
        borc: hesap.toplam,
        aciklama: `Satış faturası ${evrak.evrakNo}`,
        olusturanId: admin.id,
      },
    })

    const t = await tx.cariHareket.aggregate({
      where: { cariId: musteri.id, silindi: false },
      _sum: { borc: true, alacak: true },
    })
    await tx.cari.update({
      where: { id: musteri.id },
      data: {
        bakiye:
          Number((t._sum.borc ?? 0).toString()) - Number((t._sum.alacak ?? 0).toString()),
      },
    })
    console.log(`  ✓ Satış faturası ${evrak.evrakNo}: ${hesap.toplam.toFixed(2)} ₺`)
  })

  const sonBakiye = await prisma.cari.findUnique({
    where: { id: musteri.id },
    select: { bakiye: true },
  })
  const sonKasa = await prisma.kasa.findUnique({
    where: { id: kasa.id },
    select: { bakiye: true },
  })

  console.log("\nTamamlandı.")
  console.log(`  Müşteri güncel bakiye: ${Number(sonBakiye?.bakiye ?? 0).toFixed(2)} ₺ (borçlu)`)
  console.log(`  Kasa bakiye: ${Number(sonKasa?.bakiye ?? 0).toFixed(2)} ₺`)
}

main()
  .catch((hata) => {
    console.error(hata)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
