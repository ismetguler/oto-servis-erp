"use server"

import { revalidatePath } from "next/cache"

import { projeSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * PROJE TANIMLARI
 *
 * Kabul ve araç kartında proje METİN olarak tutuluyor (Selpar da böyle;
 * `Kabul.projesi`, `Arac.projesi`). Bu yüzden proje adı değişince eski
 * kayıtlar eski adla kalır ve rapor ikiye bölünürdü — adı değiştiren
 * işlem, aynı transaction içinde kabul ve araç kayıtlarını da günceller.
 */

export type ProjeFormDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

function alanHatalariniTopla(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

export async function projeKaydet(
  _oncekiDurum: ProjeFormDurumu,
  form: FormData
): Promise<ProjeFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = projeSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data

  // `@@unique([tur, ad, ustId])` kısıtı zaten var; önceden kontrol etmemizin
  // sebebi kullanıcıya anlaşılır mesaj gösterebilmek.
  const cakisan = await prisma.tanim.findFirst({
    where: { tur: "PROJE", ad: v.ad, ...(duzenleme ? { NOT: { id } } : {}) },
    select: { id: true },
  })
  if (cakisan) {
    return { hata: "Bu isimde bir proje zaten var.", alanHatalari: { ad: "Bu proje zaten kayıtlı." } }
  }

  let tasinan = 0

  if (duzenleme) {
    const onceki = await prisma.tanim.findUnique({ where: { id } })
    if (!onceki) return { hata: "Proje bulunamadı." }

    const kayit = await prisma.$transaction(async (tx) => {
      const guncel = await tx.tanim.update({
        where: { id },
        // Sıra boş bırakıldıysa mevcut sırayı koru.
        data: { ad: v.ad, kod: v.kod ?? null, sira: v.sira ?? onceki.sira },
      })

      if (onceki.ad !== v.ad) {
        const kabuller = await tx.kabul.updateMany({
          where: { projesi: onceki.ad },
          data: { projesi: v.ad },
        })
        const araclar = await tx.arac.updateMany({
          where: { projesi: onceki.ad },
          data: { projesi: v.ad },
        })
        tasinan = kabuller.count + araclar.count
      }
      return guncel
    })

    await logKaydet({
      islem: "GUNCELLE",
      kullaniciId: kullanici.id,
      kullaniciKod: kullanici.kod,
      tablo: "tanimlar",
      kayitId: kayit.id,
      aciklama:
        "Proje: " +
        kayit.ad +
        (tasinan ? ` (ad değişti, ${tasinan} kayıt güncellendi)` : ""),
      eskiDeger: onceki,
      yeniDeger: kayit,
    })

    revalidatePath("/servis/proje")
    revalidatePath("/servis/proje/rapor")
    return {
      basarili: tasinan
        ? `Proje güncellendi; ${tasinan} kayıttaki proje adı da düzeltildi.`
        : "Proje güncellendi.",
    }
  }

  // Sıra boş bırakıldıysa listenin sonuna ekle (mevcut en büyük sıra + 1);
  // 0'a düşürüp ilk projeyle çakıştırma.
  let sira = v.sira
  if (sira === undefined) {
    const enBuyuk = await prisma.tanim.aggregate({
      where: { tur: "PROJE" },
      _max: { sira: true },
    })
    sira = (enBuyuk._max.sira ?? -1) + 1
  }

  const kayit = await prisma.tanim.create({
    data: { tur: "PROJE", ad: v.ad, kod: v.kod ?? null, sira },
  })

  await logKaydet({
    islem: "EKLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: kayit.id,
    aciklama: "Proje: " + kayit.ad,
    yeniDeger: kayit,
  })

  revalidatePath("/servis/proje")
  return { basarili: "Proje eklendi." }
}

/** Projeyi aktif/pasif yapar — `Tanim` tablosunda soft delete alanı yok. */
export async function projeDurumDegistir(
  id: number,
  aktif: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kayit = await prisma.tanim.update({ where: { id }, data: { aktif } })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: id,
    aciklama: `Proje ${aktif ? "aktifleştirildi" : "pasife alındı"}: ${kayit.ad}`,
  })

  revalidatePath("/servis/proje")
  return {}
}

/**
 * Hiç kabul/araca yazılmamış projeyi tamamen siler. Kullanılan proje
 * silinmez: silinseydi kartlardaki metin kalır ama tanım listesinden
 * düşerdi — rapor "tanımsız proje" göstermeye başlardı.
 */
export async function projeSil(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kayit = await prisma.tanim.findUnique({ where: { id }, select: { id: true, ad: true } })
  if (!kayit) return { hata: "Proje bulunamadı." }

  const [kabulSayisi, aracSayisi] = await Promise.all([
    prisma.kabul.count({ where: { projesi: kayit.ad } }),
    prisma.arac.count({ where: { projesi: kayit.ad } }),
  ])
  if (kabulSayisi + aracSayisi > 0) {
    return {
      hata: `Bu projeye bağlı ${kabulSayisi} kabul, ${aracSayisi} araç var. Silmek yerine pasife alabilirsiniz.`,
    }
  }

  // Silme + sıra sıkıştırma tek transaction'da: aradan biri silinince kalan
  // projelerin `sira` değeri 0,1,2… olarak yeniden numaralanır (Selim abi
  // maddesi 14 — "1'i silince 2. sıra 1'e insin"). Mevcut sıraya, eşitlikte
  // id'ye göre diziliyor ki görünen sıralama korunsun.
  let yenidenNumaralanan = 0
  await prisma.$transaction(async (tx) => {
    await tx.tanim.delete({ where: { id } })

    const kalanlar = await tx.tanim.findMany({
      where: { tur: "PROJE" },
      orderBy: [{ sira: "asc" }, { id: "asc" }],
      select: { id: true, sira: true },
    })
    for (let i = 0; i < kalanlar.length; i++) {
      if (kalanlar[i].sira !== i) {
        await tx.tanim.update({ where: { id: kalanlar[i].id }, data: { sira: i } })
        yenidenNumaralanan++
      }
    }
  })

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tanimlar",
    kayitId: id,
    aciklama:
      "Proje silindi: " +
      kayit.ad +
      (yenidenNumaralanan ? ` (${yenidenNumaralanan} projenin sırası yeniden numaralandı)` : ""),
    eskiDeger: kayit,
  })

  revalidatePath("/servis/proje")
  return {}
}
