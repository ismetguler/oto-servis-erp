"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { kasaHareketSemasi, kasaSemasi, virmanSemasi } from "./sema"
import { hareketYonu } from "./veri"
import type { Prisma } from "@/generated/prisma/client"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * KASA — yazma tarafı.
 *
 * Kasa bakiyesi ASLA elle artırılmaz: her yazma işleminden sonra
 * `kasaBakiyeyiHesapla` hareketlerden yeniden toplar. Cari tarafındaki
 * `bakiyeyiHesapla` ile aynı desen — kart ile defter arasında fark oluşamaz.
 */

export type KasaFormDurumu = {
  hata?: string
  basarili?: string
  alanHatalari?: Record<string, string>
}

type Islem = Prisma.TransactionClient

function alanHatalariniTopla(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

class KodCakismasi extends Error {
  constructor() {
    super("Bu kasa kodu zaten kullanılıyor.")
    this.name = "KodCakismasi"
  }
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}

class IsKuraliHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = "IsKuraliHatasi"
  }
}

/**
 * Kasa bakiyesini hareketlerden yeniden üretir.
 * Tutarlar hep pozitif tutulduğu için yön `tur` alanından okunuyor.
 */
export async function kasaBakiyeyiHesapla(tx: Islem, kasaId: number) {
  const gruplar = await tx.kasaHareket.groupBy({
    by: ["tur"],
    where: { kasaId, silindi: false },
    _sum: { tutar: true },
  })

  const bakiye = gruplar.reduce(
    (t, g) => t + hareketYonu(g.tur) * Number((g._sum.tutar ?? 0).toString()),
    0
  )

  await tx.kasa.update({ where: { id: kasaId }, data: { bakiye } })
  return bakiye
}

/**
 * Açılış devri hareket olarak yazılır — kart üzerindeki `acilisBakiye`
 * yalnızca "kullanıcı ne girdi" bilgisidir, bakiyeyi hareket üretir.
 * Cari modülündeki `acilisHareketiniEsitle` ile aynı mantık.
 */
async function acilisHareketiniEsitle(tx: Islem, kasaId: number, tutar: number) {
  const mevcut = await tx.kasaHareket.findFirst({
    where: { kasaId, tur: "ACILIS" },
    select: { id: true },
  })

  if (tutar === 0) {
    if (mevcut) await tx.kasaHareket.delete({ where: { id: mevcut.id } })
    return
  }

  // Eksi açılış "para çıkışı" değil, eksi bakiyedir; CIKIS satırı olarak
  // yazmak defterde sahte bir gider gösterirdi. Bu yüzden ACILIS türü
  // korunur ve tutar eksi olabilir (tek istisna, sebebi bu).
  const veri = { tutar, aciklama: "Açılış bakiyesi", tarih: new Date() }
  if (mevcut) await tx.kasaHareket.update({ where: { id: mevcut.id }, data: veri })
  else await tx.kasaHareket.create({ data: { kasaId, tur: "ACILIS", ...veri } })
}

// ---------------------------------------------------------------------------
//  KASA KARTI
// ---------------------------------------------------------------------------

export async function kasaKaydet(
  _oncekiDurum: KasaFormDurumu,
  form: FormData
): Promise<KasaFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = kasaSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data

  let hedefId = id
  try {
    hedefId = await prisma.$transaction(async (tx) => {
      const kod = v.kod ?? (duzenleme ? undefined : await siradakiNumara(tx, "KASA_KOD", { varsayilanOnEk: "KS", basamak: 4 }))

      if (kod) {
        const cakisan = await tx.kasa.findFirst({
          where: { kod, ...(duzenleme ? { NOT: { id } } : {}) },
          select: { id: true },
        })
        if (cakisan) throw new KodCakismasi()
      }

      const alanlar = {
        ad: v.ad,
        tur: v.tur,
        paraBirimi: v.paraBirimi,
        // Banka alanları yalnızca banka kasasında anlamlı; tür değiştirilince
        // eski bilginin kartta asılı kalmaması için temizleniyor.
        banka: v.tur === "BANKA" ? (v.banka ?? null) : null,
        bankaSube: v.tur === "BANKA" ? (v.bankaSube ?? null) : null,
        hesapNo: v.tur === "BANKA" ? (v.hesapNo ?? null) : null,
        ibanNo: v.tur === "BANKA" ? (v.ibanNo ?? null) : null,
        posKomisyonOrani: v.tur === "POS" ? v.posKomisyonOrani : 0,
        acilisBakiye: v.acilisBakiye,
        notu: v.notu ?? null,
        sira: v.sira,
        aktif: v.aktif,
      }

      if (duzenleme) {
        const onceki = await tx.kasa.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()

        const kayit = await tx.kasa.update({
          where: { id },
          data: { ...alanlar, ...(kod ? { kod } : {}), guncelleyenId: kullanici.id },
        })
        await acilisHareketiniEsitle(tx, id, v.acilisBakiye)
        await kasaBakiyeyiHesapla(tx, id)

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "kasalar",
          kayitId: id,
          aciklama: `${kayit.kod} — ${kayit.ad}`,
          eskiDeger: onceki,
          yeniDeger: kayit,
        })
        return id
      }

      const kayit = await tx.kasa.create({
        data: { ...alanlar, kod: kod!, olusturanId: kullanici.id },
      })
      await acilisHareketiniEsitle(tx, kayit.id, v.acilisBakiye)
      await kasaBakiyeyiHesapla(tx, kayit.id)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kasalar",
        kayitId: kayit.id,
        aciklama: `${kayit.kod} — ${kayit.ad}`,
        yeniDeger: kayit,
      })
      return kayit.id
    })
  } catch (hata) {
    if (hata instanceof KodCakismasi) {
      return { hata: hata.message, alanHatalari: { kod: hata.message } }
    }
    if (hata instanceof BulunamadiHatasi) return { hata: "Kasa bulunamadı." }
    console.error("Kasa kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  redirect(`/kasa/${hedefId}`)
}

/** Soft delete / geri alma. Hareketi olan kasa silinemez. */
export async function kasaSilmeDurumu(id: number, sil: boolean): Promise<KasaFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const kayit = await tx.kasa.findUnique({
        where: { id },
        select: {
          id: true,
          kod: true,
          ad: true,
          silindi: true,
          _count: { select: { hareketler: { where: { silindi: false, tur: { not: "ACILIS" } } } } },
        },
      })
      if (!kayit) throw new BulunamadiHatasi()

      // Kasa silinince hareketleri ortada kalır; defterde "kasası olmayan
      // satır" görünmesin diye hareketi olan kasa silinmez, pasife alınır.
      if (sil && kayit._count.hareketler > 0) {
        throw new IsKuraliHatasi(
          `Bu kasada ${kayit._count.hareketler} hareket var. Silmek yerine pasife alabilirsiniz.`
        )
      }

      await tx.kasa.update({
        where: { id },
        data: {
          silindi: sil,
          silmeTarihi: sil ? new Date() : null,
          guncelleyenId: kullanici.id,
        },
      })

      await logKaydet({
        islem: sil ? "SIL" : "GERI_AL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kasalar",
        kayitId: id,
        aciklama: `${kayit.kod} — ${kayit.ad}`,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kasa bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Kasa silinemedi:", hata)
    return { hata: "İşlem tamamlanamadı." }
  }

  revalidatePath("/kasa")
  revalidatePath(`/kasa/${id}`)
  return { basarili: sil ? "Kasa silindi." : "Kasa geri alındı." }
}

// ---------------------------------------------------------------------------
//  KASA HAREKETİ (elle giriş / çıkış)
// ---------------------------------------------------------------------------

export async function kasaHareketiKaydet(
  _oncekiDurum: KasaFormDurumu,
  form: FormData
): Promise<KasaFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = kasaHareketSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      const kasa = await tx.kasa.findUnique({
        where: { id: v.kasaId },
        select: { id: true, kod: true, ad: true, aktif: true, silindi: true },
      })
      if (!kasa || kasa.silindi) throw new BulunamadiHatasi()
      if (!kasa.aktif) throw new IsKuraliHatasi("Pasif kasaya hareket girilemez.")

      if (v.cariId) {
        const cari = await tx.cari.findUnique({
          where: { id: v.cariId },
          select: { id: true, silindi: true },
        })
        if (!cari || cari.silindi) throw new IsKuraliHatasi("Seçilen cari bulunamadı.")
      }

      const kayit = await tx.kasaHareket.create({
        data: {
          kasaId: v.kasaId,
          tur: v.tur,
          tarih: new Date(v.tarih),
          tutar: v.tutar,
          aciklama: v.aciklama,
          belgeNo: v.belgeNo ?? null,
          masrafTuru: v.tur === "CIKIS" ? (v.masrafTuru ?? null) : null,
          cariId: v.cariId ?? null,
          olusturanId: kullanici.id,
        },
      })

      await kasaBakiyeyiHesapla(tx, v.kasaId)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kasa_hareketleri",
        kayitId: kayit.id,
        aciklama: `${kasa.kod} ${v.tur === "GIRIS" ? "giriş" : "çıkış"}: ${v.tutar} — ${v.aciklama}`,
        yeniDeger: kayit,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kasa bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Kasa hareketi kaydedilemedi:", hata)
    return { hata: "Hareket kaydedilemedi." }
  }

  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  revalidatePath(`/kasa/${v.kasaId}`)
  return { basarili: "Hareket kaydedildi." }
}

/**
 * Hareket silme. Virman satırları TEK BAŞINA silinemez: eşi kalırsa iki
 * kasanın toplamı birbirini tutmaz, para havada kalır. Bu yüzden virmanın
 * iki satırı da `virmanGrubu` üzerinden birlikte silinir.
 */
export async function kasaHareketiSil(id: number): Promise<KasaFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const kayit = await tx.kasaHareket.findUnique({
        where: { id },
        select: {
          id: true,
          kasaId: true,
          tur: true,
          tutar: true,
          aciklama: true,
          virmanGrubu: true,
          silindi: true,
          tahsilatId: true,
          cekSenetId: true,
        },
      })
      if (!kayit || kayit.silindi) throw new BulunamadiHatasi()
      if (kayit.tur === "ACILIS") {
        throw new IsKuraliHatasi("Açılış satırı kasa kartından düzenlenir.")
      }
      // Kaynağı başka bir kayıt olan satır burada silinemez; silinirse asıl
      // kayıt (tahsilat / çek) hâlâ "kasaya girdi" der, defterde iz kalmaz.
      if (kayit.tahsilatId || kayit.cekSenetId) {
        throw new IsKuraliHatasi(
          "Bu satır bir tahsilat/çek işleminden geldi; kaynağından geri alınmalı."
        )
      }

      const hedefler = kayit.virmanGrubu
        ? await tx.kasaHareket.findMany({
            where: { virmanGrubu: kayit.virmanGrubu, silindi: false },
            select: { id: true, kasaId: true },
          })
        : [{ id: kayit.id, kasaId: kayit.kasaId }]

      await tx.kasaHareket.updateMany({
        where: { id: { in: hedefler.map((h) => h.id) } },
        data: { silindi: true, silmeTarihi: new Date() },
      })

      for (const kasaId of new Set(hedefler.map((h) => h.kasaId))) {
        await kasaBakiyeyiHesapla(tx, kasaId)
      }

      await logKaydet({
        islem: "SIL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kasa_hareketleri",
        kayitId: id,
        aciklama: kayit.virmanGrubu
          ? `Virman iptal edildi (${hedefler.length} satır) — ${kayit.aciklama ?? ""}`
          : `Kasa hareketi silindi — ${kayit.aciklama ?? ""}`,
        eskiDeger: kayit,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Hareket bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Kasa hareketi silinemedi:", hata)
    return { hata: "Hareket silinemedi." }
  }

  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  return { basarili: "Hareket silindi." }
}

// ---------------------------------------------------------------------------
//  VİRMAN (kasalar arası aktarım)
// ---------------------------------------------------------------------------

/**
 * Virman İKİ satır üretir: çıkan kasada VIRMAN_CIKIS, giren kasada
 * VIRMAN_GIRIS. `virmanGrubu` ikisini eşler. Tek satır + karşı kasa
 * tutulsaydı her raporda "bu satır hangi kasada?" istisnası çıkardı.
 */
export async function virmanYap(
  _oncekiDurum: KasaFormDurumu,
  form: FormData
): Promise<KasaFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = virmanSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      const kasalar = await tx.kasa.findMany({
        where: { id: { in: [v.kaynakKasaId, v.hedefKasaId] }, silindi: false },
        select: { id: true, kod: true, ad: true, aktif: true, paraBirimi: true, bakiye: true },
      })
      const kaynak = kasalar.find((k) => k.id === v.kaynakKasaId)
      const hedef = kasalar.find((k) => k.id === v.hedefKasaId)
      if (!kaynak || !hedef) throw new BulunamadiHatasi()
      if (!kaynak.aktif || !hedef.aktif) throw new IsKuraliHatasi("Pasif kasa ile virman yapılamaz.")
      // Virman "elindeki parayı taşımak"tır: çıkış kasasını eksiye düşüren
      // aktarıma izin verilmez (Selpar de bloklar). Gerçek nakit açığı varsa
      // önce kasaya giriş fişi girilmeli.
      if (v.tutar > Number(kaynak.bakiye)) {
        throw new IsKuraliHatasi(
          `Çıkış kasasında yeterli bakiye yok. Mevcut: ${Number(kaynak.bakiye).toLocaleString(
            "tr-TR",
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )} ₺`
        )
      }
      // Kur çevrimi yok; farklı para birimleri arasında aktarım yapılırsa
      // iki kasanın toplamı sessizce bozulurdu.
      if (kaynak.paraBirimi !== hedef.paraBirimi) {
        throw new IsKuraliHatasi("Para birimi farklı kasalar arasında virman yapılamaz.")
      }

      const grup = `V${Date.now()}-${kaynak.id}-${hedef.id}`
      const tarih = new Date(v.tarih)
      const aciklama = v.aciklama ?? `Virman: ${kaynak.ad} → ${hedef.ad}`

      await tx.kasaHareket.createMany({
        data: [
          {
            kasaId: kaynak.id,
            tur: "VIRMAN_CIKIS",
            tarih,
            tutar: v.tutar,
            aciklama,
            karsiKasaId: hedef.id,
            virmanGrubu: grup,
            olusturanId: kullanici.id,
          },
          {
            kasaId: hedef.id,
            tur: "VIRMAN_GIRIS",
            tarih,
            tutar: v.tutar,
            aciklama,
            karsiKasaId: kaynak.id,
            virmanGrubu: grup,
            olusturanId: kullanici.id,
          },
        ],
      })

      await kasaBakiyeyiHesapla(tx, kaynak.id)
      await kasaBakiyeyiHesapla(tx, hedef.id)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kasa_hareketleri",
        aciklama: `Virman ${kaynak.kod} → ${hedef.kod}: ${v.tutar}`,
        yeniDeger: { grup, tutar: v.tutar, tarih },
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kasa bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Virman yapılamadı:", hata)
    return { hata: "Virman yapılamadı." }
  }

  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  revalidatePath(`/kasa/${v.kaynakKasaId}`)
  revalidatePath(`/kasa/${v.hedefKasaId}`)
  return { basarili: "Virman tamamlandı." }
}

/** Hareket formundaki cari aramasının server action karşılığı. */
export async function kasaCariAra(q: string) {
  await yetkiliOturum("tahsilat", "gor")
  const arama = q.trim()
  if (arama.length < 2) return []
  return prisma.cari.findMany({
    where: {
      silindi: false,
      OR: [
        { unvan: { contains: arama, mode: "insensitive" } },
        { kod: { contains: arama, mode: "insensitive" } },
        { vergiNo: { contains: arama, mode: "insensitive" } },
      ],
    },
    orderBy: { unvan: "asc" },
    take: 10,
    select: { id: true, kod: true, unvan: true },
  })
}
