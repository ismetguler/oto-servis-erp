"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { cariSemasi } from "./sema"
import { siradakiNumara } from "@/lib/numarator"
import { donusYolu } from "@/lib/donus"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type CariFormDurumu = {
  hata?: string
  /** Alan adına göre hata mesajları — form her alanın altında gösterir. */
  alanHatalari?: Record<string, string>
}

/** Transaction içindeki Prisma istemcisi (tx) — yardımcı fonksiyonlara geçilir. */
type Islem = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Cari kaydet (yeni kayıt veya güncelleme).
 *
 * Tek fonksiyon: alanlar ve doğrulama ikisinde de aynı olduğu için ayırmak
 * sadece kopyala-yapıştır çoğaltırdı. Ayrım gizli `id` alanının varlığından.
 */
export async function cariKaydet(
  _oncekiDurum: CariFormDurumu,
  form: FormData
): Promise<CariFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = cariSemasi.safeParse({
    ...Object.fromEntries(form),
    // İşaretsiz checkbox forma HİÇ gelmez; zod'a açıkça false geçiyoruz.
    aktif: form.get("aktif") === "on",
  })

  if (!cozum.success) {
    const alanHatalari: Record<string, string> = {}
    for (const sorun of cozum.error.issues) {
      const alan = String(sorun.path[0] ?? "")
      if (alan && !alanHatalari[alan]) alanHatalari[alan] = sorun.message
    }
    return { hata: "Formda eksik veya hatalı alanlar var.", alanHatalari }
  }

  const v = cozum.data

  // SA-3.2: mükerrer cari önleme (yalnız YENİ kayıtta). İsmet'in kararı:
  // onay sorma — aynı VKN'li (VKN doluysa) veya birebir aynı ünvanlı aktif
  // bir cari varsa, ikinci kart AÇTIRMA, doğrudan mevcut kartın düzenleme
  // ekranına götür. Personelde isim çakışması sık olduğu için ünvan eşleşmesi
  // yalnız personel-dışı türlerde uygulanıyor; VKN eşleşmesi her türde.
  //
  // Ünvan karşılaştırması Prisma `mode: "insensitive"` ile YAPILMIYOR: o mod
  // Postgres `lower()`e dayanıyor ve Türkçe İ/ı, Ş/ş, Ğ/ğ harflerini doğru
  // katlamıyor ("YILMAZ" ile "yılmaz" eşleşmiyordu). Bunun yerine aday
  // kayıtlar çekilip `toLocaleLowerCase("tr-TR")` ile JS tarafında
  // karşılaştırılıyor (tek dükkânlık ölçekte cari sayısı düşük, sorun değil).
  if (!duzenleme) {
    const vkn = v.vergiNo?.trim()
    const unvanAnahtari = v.unvan.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR")

    let mevcut: { id: number; turu: string } | null = null

    if (vkn) {
      mevcut = await prisma.cari.findFirst({
        where: { silindi: false, vergiNo: vkn },
        select: { id: true, turu: true },
      })
    }

    if (!mevcut && v.turu !== "PERSONEL") {
      const adaylar = await prisma.cari.findMany({
        where: { silindi: false, turu: { not: "PERSONEL" } },
        select: { id: true, turu: true, unvan: true },
        take: 5000,
      })
      mevcut =
        adaylar.find(
          (c) =>
            c.unvan.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR") ===
            unvanAnahtari
        ) ?? null
    }

    if (mevcut) {
      const taban = mevcut.turu === "PERSONEL" ? "/personel" : "/cari"
      redirect(`${taban}/${mevcut.id}/duzenle?mevcut=1`)
    }
  }

  let kayitId: number

  try {
    kayitId = await prisma.$transaction(async (tx) => {
      // Kod elle girilmediyse numaratörden üretilir. Aynı transaction içinde
      // olması önemli: kayıt açılmazsa numara da boşa yanmaz.
      const kod =
        v.kod ??
        (await siradakiNumara(tx, "CARI_KOD", { varsayilanOnEk: "C", basamak: 6 }))

      const cakisan = await tx.cari.findFirst({
        where: { kod, ...(duzenleme ? { NOT: { id } } : {}) },
        select: { id: true },
      })
      if (cakisan) throw new KodCakismasi(kod)

      const alanlar = {
        kod,
        unvan: v.unvan,
        turu: v.turu,
        tipi: v.tipi,
        vergiNo: v.vergiNo ?? null,
        vergiDair: v.vergiDair ?? null,
        yetkili: v.yetkili ?? null,
        yetkiliTelefon: v.yetkiliTelefon ?? null,
        telefon: v.telefon ?? null,
        gsm: v.gsm ?? null,
        email: v.email ?? null,
        adres: v.adres ?? null,
        il: v.il ?? null,
        ilce: v.ilce ?? null,
        banka: v.banka ?? null,
        bankaSube: v.bankaSube ?? null,
        hesapNo: v.hesapNo ?? null,
        ibanNo: v.ibanNo ?? null,
        paraBirimi: v.paraBirimi,
        hesapLimiti: v.hesapLimiti,
        riskLimiti: v.riskLimiti,
        vadeGun: v.vadeGun,
        acilisBakiye: v.acilisBakiye,
        acilisTuru: v.acilisTuru,
        ozelKod: v.ozelKod ?? null,
        plasiyerId: v.plasiyerId ?? null,
        musteriSinifi: v.musteriSinifi ?? null,
        notu: v.notu ?? null,
        // Personel özlük alanları. Tür PERSONEL değilken form bu alanları
        // hiç göndermez; o durumda eskiden dolu kalmış bir değer temizlensin
        // diye null yazılıyor — yarı dolu bir personel kartı kalmasın.
        gorevi: v.gorevi ?? null,
        iseGirisTarihi: v.iseGirisTarihi ? new Date(v.iseGirisTarihi) : null,
        istenCikisTarihi: v.istenCikisTarihi ? new Date(v.istenCikisTarihi) : null,
        dogumTarihi: v.dogumTarihi ? new Date(v.dogumTarihi) : null,
        sgkNo: v.sgkNo ?? null,
        maas: v.maas,
        aktif: v.aktif,
      }

      if (duzenleme) {
        const onceki = await tx.cari.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()

        const cari = await tx.cari.update({
          where: { id },
          data: { ...alanlar, guncelleyenId: kullanici.id },
        })
        await acilisHareketiniEsitle(tx, cari.id, v.acilisBakiye, v.acilisTuru)
        await bakiyeyiHesapla(tx, cari.id)

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "cariler",
          kayitId: cari.id,
          aciklama: `${cari.kod} — ${cari.unvan}`,
          eskiDeger: onceki,
          yeniDeger: cari,
        })
        return cari.id
      }

      const cari = await tx.cari.create({
        data: { ...alanlar, olusturanId: kullanici.id },
      })
      await acilisHareketiniEsitle(tx, cari.id, v.acilisBakiye, v.acilisTuru)
      await bakiyeyiHesapla(tx, cari.id)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "cariler",
        kayitId: cari.id,
        aciklama: `${cari.kod} — ${cari.unvan}`,
        yeniDeger: cari,
      })
      return cari.id
    })
  } catch (hata) {
    if (hata instanceof KodCakismasi) {
      return {
        hata: hata.message,
        alanHatalari: { kod: "Bu kod başka bir caride kullanılıyor." },
      }
    }
    if (hata instanceof BulunamadiHatasi) {
      return { hata: "Cari kaydı bulunamadı; silinmiş olabilir." }
    }
    console.error("Cari kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  // Personel kartları /personel altında yaşıyor (aynı tablo, ayrı ekran):
  // kaydeden kullanıcı hangi listeden geldiyse oraya dönmeli, yoksa personel
  // ekleyen kişi kendini cari listesinde bulurdu.
  const personel = cozum.data.turu === "PERSONEL"
  revalidatePath("/cari")
  revalidatePath(`/cari/${kayitId}`)
  revalidatePath("/personel")
  revalidatePath(`/personel/${kayitId}`)
  // Kabul ekranından "+ Yeni Cari" ile gelindiyse cari kartına değil kabule
  // dön; yeni müşteri orada seçili gelsin (bkz. lib/donus.ts).
  redirect(
    donusYolu(form.get("donus"), "cari", kayitId) ??
      `${personel ? "/personel" : "/cari"}/${kayitId}?kaydedildi=1`
  )
}

/**
 * Cariyi siler veya geri alır.
 *
 * Fiziksel silme YOK: kayıt yalnızca `silindi` işaretlenir. Bir carinin
 * arkasında fatura, kabul ve ekstre durur; gerçekten silinse geçmiş
 * tutarsız kalırdı (Selpar'daki "Silinen Kayıtlar" listesi de bu sayede olur).
 */
export async function cariSilmeDurumu(
  id: number,
  silinsin: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const onceki = await prisma.cari.findUnique({
    where: { id },
    select: { id: true, kod: true, unvan: true, silindi: true, bakiye: true },
  })
  if (!onceki) return { hata: "Cari bulunamadı." }

  // Bakiyesi olan cari silinemez: mizan ve yaşlandırma raporu tutmaz hâle gelir.
  if (silinsin && Number(onceki.bakiye.toString()) !== 0) {
    return {
      hata: "Bakiyesi sıfır olmayan cari silinemez. Önce hesabı kapatın.",
    }
  }

  await prisma.cari.update({
    where: { id },
    data: {
      silindi: silinsin,
      silmeTarihi: silinsin ? new Date() : null,
      guncelleyenId: kullanici.id,
    },
  })

  await logKaydet({
    islem: silinsin ? "SIL" : "GERI_AL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    kayitId: id,
    aciklama: `${onceki.kod} — ${onceki.unvan}`,
    eskiDeger: onceki,
  })

  revalidatePath("/cari")
  revalidatePath(`/cari/${id}`)
  revalidatePath("/personel")
  revalidatePath(`/personel/${id}`)
  return {}
}

/**
 * Cari kartındaki "Son Hesap Hareketleri"nden açılış bakiyesini siler.
 * Açılış tutarı cari kartında da tutulduğu için ikisi birlikte sıfırlanır —
 * yoksa kart bir sonraki kaydedilişte hareketi yeniden oluştururdu.
 */
export async function cariAcilisSil(cariId: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cari = await prisma.cari.findUnique({
    where: { id: cariId },
    select: { kod: true, unvan: true, acilisBakiye: true, acilisTuru: true },
  })
  if (!cari) return { hata: "Cari bulunamadı." }

  await prisma.$transaction(async (tx) => {
    await tx.cariHareket.deleteMany({ where: { cariId, tur: "ACILIS" } })
    await tx.cari.update({
      where: { id: cariId },
      data: { acilisBakiye: 0, guncelleyenId: kullanici.id },
    })
    await bakiyeyiHesapla(tx, cariId)
  })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cari_hareketleri",
    kayitId: cariId,
    aciklama: `Açılış bakiyesi silindi — ${cari.kod} ${cari.unvan}`,
    eskiDeger: cari,
  })

  revalidatePath(`/cari/${cariId}`)
  revalidatePath("/cari")
  return {}
}

class KodCakismasi extends Error {
  constructor(kod: string) {
    super(`"${kod}" kodu zaten kullanılıyor.`)
    this.name = "KodCakismasi"
  }
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}

/**
 * Açılış bakiyesi ekstrenin ilk satırıdır. Kart üzerindeki alan değiştiğinde
 * o satır da güncellenmeli; yoksa kart bir şey, ekstre başka şey söyler.
 */
async function acilisHareketiniEsitle(
  tx: Islem,
  cariId: number,
  tutar: number,
  yon: "BORC" | "ALACAK"
) {
  const mevcut = await tx.cariHareket.findFirst({
    where: { cariId, tur: "ACILIS" },
    select: { id: true },
  })

  if (tutar === 0) {
    if (mevcut) await tx.cariHareket.delete({ where: { id: mevcut.id } })
    return
  }

  const veri = {
    borc: yon === "BORC" ? tutar : 0,
    alacak: yon === "ALACAK" ? tutar : 0,
    aciklama: "Açılış bakiyesi",
  }

  if (mevcut) await tx.cariHareket.update({ where: { id: mevcut.id }, data: veri })
  else await tx.cariHareket.create({ data: { cariId, tur: "ACILIS", ...veri } })
}

/**
 * `Cari.bakiye` hareketlerin özetidir; tek doğru kaynak `cari_hareketleri`
 * tablosudur. Elle toplamak yerine her değişiklikte buradan yeniden
 * hesaplanır ki kart ile ekstre arasında fark oluşamasın.
 * Sonuç (+) ise cari bize borçlu, (−) ise biz ona borçluyuz.
 */
export async function bakiyeyiHesapla(tx: Islem, cariId: number) {
  const toplam = await tx.cariHareket.aggregate({
    where: { cariId, silindi: false },
    _sum: { borc: true, alacak: true },
  })

  const bakiye =
    Number(toplam._sum.borc?.toString() ?? 0) -
    Number(toplam._sum.alacak?.toString() ?? 0)

  await tx.cari.update({ where: { id: cariId }, data: { bakiye } })
}
