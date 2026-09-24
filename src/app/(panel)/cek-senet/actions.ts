"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { cekSenetSemasi, durumSemasi, onaySemasi } from "./sema"
import { DURUM_ADI, GECISLER, kasaGerektirir, TUR_ADI, YON_ADI } from "./veri"
import { bakiyeyiHesapla } from "@/app/(panel)/cari/actions"
import { kasaBakiyeyiHesapla } from "@/app/(panel)/kasa/actions"
import type { Prisma } from "@/generated/prisma/client"
import type { CekSenetDurum, CekSenetYon } from "@/generated/prisma/enums"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * ÇEK / SENET — yazma tarafı.
 *
 * İki ayrı bakiyeye dokunuyor, ikisine de DOLAYLI dokunuyor:
 *  - Cari bakiyesi: `cari_hareketleri` tablosuna satır yazılıp
 *    `bakiyeyiHesapla` çağrılıyor. `Cari.bakiye` elle değiştirilmiyor —
 *    kabul teslim akışıyla birebir aynı yol (kabul/actions.ts).
 *  - Kasa bakiyesi: `kasa_hareketleri`ne satır yazılıp `kasaBakiyeyiHesapla`
 *    çağrılıyor.
 *
 * Kendi yazdığı satırları `cekSenetId` üzerinden bulup temizlediği için
 * kabul/tahsilat hareketleriyle çakışması mümkün değil.
 */

export type CekSenetFormDurumu = {
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

class KodCakismasi extends Error {
  constructor() {
    super("Bu portföy numarası zaten kullanılıyor.")
    this.name = "KodCakismasi"
  }
}

// ---------------------------------------------------------------------------
//  CARİ ETKİSİ
// ---------------------------------------------------------------------------

/**
 * Kâğıdın cariye yansıması. Kural (İsmet'in kararı, 25 Ağu 2026):
 * cariye ancak ONAYLANDIĞINDA işlenir.
 *
 *  - ALINAN çek/senet  → müşteriden değer aldık, borcu azalır → ALACAK
 *  - VERILEN çek/senet → tedarikçiye değer verdik, borcumuz azalır → BORÇ
 *
 * Karşılıksız çıkan kâğıtta bu satır kaldırılır: alınan kâğıt değersizleşince
 * müşterinin borcu geri doğmalı. `deleteMany` yalnızca bu çekin satırını
 * hedeflediği için kabul/tahsilat hareketlerine dokunmaz.
 */
async function cariEtkisiniYaz(
  tx: Islem,
  cek: {
    id: number
    cariId: number | null
    yon: CekSenetYon
    tur: "CEK" | "SENET"
    portfoyNo: string
    tutar: Prisma.Decimal | number
    vadeTarihi: Date
    durum: CekSenetDurum
    onayDurumu: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI"
    /// Dolu ise kâğıt bir tahsilat/ödeme fişinden otomatik doğmuştur (adım 6.3).
    tahsilatId?: number | null
  },
  kullaniciId: number
) {
  // Önce kendi izini sil, sonra güncel duruma göre yeniden yaz.
  // "Güncelle" yerine "sil + yaz": geçiş sayısı arttıkça hangi satırın
  // güncelleneceğini takip etmek hataya çok açık.
  // Yalnızca CEK_SENET satırı siliniyor; ciro satırı (MAHSUP) ciroEtkisiniYaz'ın işi.
  await tx.cariHareket.deleteMany({ where: { cekSenetId: cek.id, tur: "CEK_SENET" } })

  // Erken çıkışlarda da bakiye yeniden hesaplanmalı: silinen satırın etkisi
  // ancak `bakiyeyiHesapla` çağrılırsa karta yansır — aksi hâlde örneğin
  // karşılıksız çıkan kâğıdın borcu cari kartında asılı kalırdı.
  if (!cek.cariId) return

  // ÇİFT SAYMA KORUMASI (adım 6.3): fişten doğan kâğıdın cari satırını
  // tahsilat fişi zaten yazdı. Burada bir kez daha yazılsaydı müşterinin
  // borcu bir çek için iki kez kapanmış görünürdü.
  if (cek.tahsilatId) {
    await bakiyeyiHesapla(tx, cek.cariId)
    return
  }

  if (cek.onayDurumu === "ONAYLANDI" && cek.durum !== "KARSILIKSIZ" && cek.durum !== "IADE_EDILDI") {
    const tutar = Number(cek.tutar.toString())
    const etiket = `${TUR_ADI[cek.tur]} ${cek.portfoyNo}`

    await tx.cariHareket.create({
      data: {
        cariId: cek.cariId,
        cekSenetId: cek.id,
        tur: "CEK_SENET",
        borc: cek.yon === "VERILEN" ? tutar : 0,
        alacak: cek.yon === "ALINAN" ? tutar : 0,
        vadeTarihi: cek.vadeTarihi,
        aciklama: `${YON_ADI[cek.yon].toLowerCase()} ${etiket}`,
        olusturanId: kullaniciId,
      },
    })
  }

  await bakiyeyiHesapla(tx, cek.cariId)
}

/** Ciro edilen kâğıt yeni cariye devrolur: ona olan BORCUMUZ azalır (borç satırı). */
async function ciroEtkisiniYaz(
  tx: Islem,
  cek: { id: number; portfoyNo: string; tutar: Prisma.Decimal | number; ciroCariId: number | null },
  kullaniciId: number,
  /** Ciro geri alındığında eski cirantanın bakiyesi de yenilenmeli. */
  eskiCiroCariId?: number | null
) {
  await tx.cariHareket.deleteMany({
    where: { cekSenetId: cek.id, tur: "MAHSUP" },
  })
  if (eskiCiroCariId && eskiCiroCariId !== cek.ciroCariId) {
    await bakiyeyiHesapla(tx, eskiCiroCariId)
  }
  if (!cek.ciroCariId) return

  await tx.cariHareket.create({
    data: {
      cariId: cek.ciroCariId,
      cekSenetId: cek.id,
      tur: "MAHSUP",
      // Kâğıdı ciro ettiğimiz cariye DEĞER veriyoruz; ona olan borcumuz azalır.
      // Bu, "verilen çek/senet" ve TEDIYE ile aynı ekonomik olay, aynı yön:
      // `tahsilat/actions.ts` — "tedarikçiye para verdik, borcumuz azalır → BORÇ".
      borc: Number(cek.tutar.toString()),
      aciklama: `Ciro edilen kıymetli evrak ${cek.portfoyNo}`,
      olusturanId: kullaniciId,
    },
  })
  await bakiyeyiHesapla(tx, cek.ciroCariId)
}

// ---------------------------------------------------------------------------
//  KAYIT
// ---------------------------------------------------------------------------

export async function cekSenetKaydet(
  _oncekiDurum: CekSenetFormDurumu,
  form: FormData
): Promise<CekSenetFormDurumu> {
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

  const cozum = cekSenetSemasi.safeParse(Object.fromEntries(form))
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
      const portfoyNo =
        v.portfoyNo ??
        (duzenleme
          ? undefined
          : await siradakiNumara(tx, "CEK_SENET", { varsayilanOnEk: "CS", basamak: 5 }))

      if (portfoyNo) {
        const cakisan = await tx.cekSenet.findFirst({
          where: { portfoyNo, ...(duzenleme ? { NOT: { id } } : {}) },
          select: { id: true },
        })
        if (cakisan) throw new KodCakismasi()
      }

      if (v.cariId) {
        const cari = await tx.cari.findUnique({
          where: { id: v.cariId },
          select: { id: true, silindi: true },
        })
        if (!cari || cari.silindi) throw new IsKuraliHatasi("Seçilen cari bulunamadı.")
      }

      const alanlar = {
        tur: v.tur,
        yon: v.yon,
        cariId: v.cariId ?? null,
        tutar: v.tutar,
        paraBirimi: v.paraBirimi,
        vadeTarihi: new Date(v.vadeTarihi),
        kesideTarihi: v.kesideTarihi ? new Date(v.kesideTarihi) : null,
        kesideYeri: v.kesideYeri ?? null,
        borclu: v.borclu ?? null,
        banka: v.banka ?? null,
        bankaSube: v.bankaSube ?? null,
        hesapNo: v.hesapNo ?? null,
        belgeNo: v.belgeNo ?? null,
        aciklama: v.aciklama ?? null,
      }

      if (duzenleme) {
        const onceki = await tx.cekSenet.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()
        // Kâğıt yola çıktıktan sonra tutar/yön değişirse geçmiş hareketler
        // yalan söyler; bu yüzden düzenleme yalnızca portföyde iken serbest.
        if (onceki.tahsilatId) {
          throw new IsKuraliHatasi(
            "Bu kâğıt bir tahsilat/ödeme fişinden otomatik açıldı. Bilgileri fişin kendisinden düzenleyin."
          )
        }
        if (onceki.durum !== "PORTFOYDE") {
          throw new IsKuraliHatasi(
            `Durumu "${DURUM_ADI[onceki.durum]}" olan kâğıt düzenlenemez. Önce durumu geri alın.`
          )
        }

        const kayit = await tx.cekSenet.update({
          where: { id },
          data: { ...alanlar, ...(portfoyNo ? { portfoyNo } : {}), guncelleyenId: kullanici.id },
        })
        // Tutar/cari/yön değişmiş olabilir; onaylıysa cari izi yenilenir.
        await cariEtkisiniYaz(tx, kayit, kullanici.id)

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "cek_senetler",
          kayitId: id,
          aciklama: `${kayit.portfoyNo} — ${TUR_ADI[kayit.tur]} ${YON_ADI[kayit.yon]}`,
          eskiDeger: onceki,
          yeniDeger: kayit,
        })
        return id
      }

      const kayit = await tx.cekSenet.create({
        data: { ...alanlar, portfoyNo: portfoyNo!, olusturanId: kullanici.id },
      })

      await tx.cekSenetHareket.create({
        data: {
          cekSenetId: kayit.id,
          yeniDurum: "PORTFOYDE",
          aciklama: "Kayıt açıldı — onay bekliyor",
          cariId: kayit.cariId,
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
        },
      })

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "cek_senetler",
        kayitId: kayit.id,
        aciklama: `${kayit.portfoyNo} — ${TUR_ADI[kayit.tur]} ${YON_ADI[kayit.yon]}`,
        yeniDeger: kayit,
      })
      return kayit.id
    })
  } catch (hata) {
    if (hata instanceof KodCakismasi) {
      return { hata: hata.message, alanHatalari: { portfoyNo: hata.message } }
    }
    if (hata instanceof BulunamadiHatasi) return { hata: "Kayıt bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Çek/senet kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/cek-senet")
  redirect(`/cek-senet/${hedefId}`)
}

// ---------------------------------------------------------------------------
//  ONAY İŞLEMLERİ
// ---------------------------------------------------------------------------

/**
 * Onay/ret. Onaylanmayan kâğıt cariye İŞLENMEZ; yanlış girilen kayıt
 * bakiyeyi bozmadan düzeltilebilsin diye kapı burada tutuluyor.
 * Yetki: `tahsilat.duzelt` (rol matrisinde YÖNETİCİ ve MUHASEBE'de var).
 */
export async function cekSenetOnayla(
  _oncekiDurum: CekSenetFormDurumu,
  form: FormData
): Promise<CekSenetFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = onaySemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) return { hata: "Onay bilgisi eksik." }
  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      const cek = await tx.cekSenet.findUnique({ where: { id: v.id } })
      if (!cek || cek.silindi) throw new BulunamadiHatasi()
      if (cek.onayDurumu === v.karar) {
        throw new IsKuraliHatasi("Bu kâğıt zaten bu durumda.")
      }

      const guncel = await tx.cekSenet.update({
        where: { id: v.id },
        data: {
          onayDurumu: v.karar,
          onaylayanId: kullanici.id,
          onayTarihi: new Date(),
          onayNotu: v.onayNotu ?? null,
          guncelleyenId: kullanici.id,
        },
      })

      await cariEtkisiniYaz(tx, guncel, kullanici.id)

      await tx.cekSenetHareket.create({
        data: {
          cekSenetId: v.id,
          oncekiDurum: cek.durum,
          yeniDurum: guncel.durum,
          aciklama:
            v.karar === "ONAYLANDI"
              ? `Onaylandı${v.onayNotu ? ` — ${v.onayNotu}` : ""}`
              : `Onay reddedildi${v.onayNotu ? ` — ${v.onayNotu}` : ""}`,
          cariId: cek.cariId,
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
        },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "cek_senetler",
        kayitId: v.id,
        aciklama: `${cek.portfoyNo} onay: ${cek.onayDurumu} → ${v.karar}`,
        eskiDeger: { onayDurumu: cek.onayDurumu },
        yeniDeger: { onayDurumu: v.karar, not: v.onayNotu },
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kayıt bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Onay işlemi yapılamadı:", hata)
    return { hata: "Onay işlemi yapılamadı." }
  }

  revalidatePath("/cek-senet")
  revalidatePath("/cek-senet/onay")
  revalidatePath(`/cek-senet/${v.id}`)
  return { basarili: v.karar === "ONAYLANDI" ? "Onaylandı." : "Reddedildi." }
}

// ---------------------------------------------------------------------------
//  DURUM DEĞİŞTİRME
// ---------------------------------------------------------------------------

/**
 * Durum geçişi. İzinli geçişler `GECISLER` tablosunda; bu yüzden
 * "tahsil edilmiş çek ciro edildi" gibi imkânsız durumlar oluşamaz.
 *
 * Kasa etkisi yalnızca para hareketi olan geçişlerde (alınan → tahsil edildi,
 * verilen → ödendi). Diğer geçişlerde kasa satırı kaldırılır — geri alınan
 * bir tahsil, kasada iz bırakmamalı.
 */
export async function durumDegistir(
  _oncekiDurum: CekSenetFormDurumu,
  form: FormData
): Promise<CekSenetFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = durumSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "İşlem bilgisi eksik veya hatalı.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data
  const etkilenenKasalar = new Set<number>()

  try {
    await prisma.$transaction(async (tx) => {
      const cek = await tx.cekSenet.findUnique({ where: { id: v.id } })
      if (!cek || cek.silindi) throw new BulunamadiHatasi()
      if (cek.onayDurumu !== "ONAYLANDI") {
        throw new IsKuraliHatasi("Onaylanmamış kâğıdın durumu değiştirilemez.")
      }

      // Fişten doğan kâğıt karşılıksız/iade olursa cari satırı fişte durduğu
      // için borç kendiliğinden geri doğmaz — tahsilat hiç olmamış sayılmalı.
      // Doğru yol fişin kendisini silmek; buradan yapılsaydı bakiye yalan söylerdi.
      if (cek.tahsilatId && (v.yeniDurum === "KARSILIKSIZ" || v.yeniDurum === "IADE_EDILDI")) {
        throw new IsKuraliHatasi(
          "Bu kâğıt bir tahsilat/ödeme fişinden doğdu. Karşılıksız/iade durumunda fişin kendisini silin — kâğıt da kapanır, borç geri doğar."
        )
      }

      const izinli = GECISLER[cek.yon][cek.durum] ?? []
      if (!izinli.includes(v.yeniDurum)) {
        throw new IsKuraliHatasi(
          `"${DURUM_ADI[cek.durum]}" durumundan "${DURUM_ADI[v.yeniDurum]}" durumuna geçilemez.`
        )
      }

      const kasaLazim = kasaGerektirir(cek.yon, v.yeniDurum)
      if (kasaLazim && !v.kasaId) throw new IsKuraliHatasi("Para hangi kasaya işlensin, seçin.")
      if (v.yeniDurum === "CIRO_EDILDI" && !v.ciroCariId) {
        throw new IsKuraliHatasi("Ciro edilecek cariyi seçin.")
      }

      const islemTarihi = v.tarih ? new Date(v.tarih) : new Date()

      // Eski kasa izini her hâlükârda temizle: durum geri alınıyorsa kasada
      // asılı kalan giriş/çıkış satırı bakiyeyi yalancı çıkarırdı.
      const eskiKasaSatirlari = await tx.kasaHareket.findMany({
        where: { cekSenetId: cek.id, silindi: false },
        select: { id: true, kasaId: true },
      })
      if (eskiKasaSatirlari.length > 0) {
        await tx.kasaHareket.deleteMany({ where: { cekSenetId: cek.id } })
        eskiKasaSatirlari.forEach((s) => etkilenenKasalar.add(s.kasaId))
      }

      if (kasaLazim && v.kasaId) {
        const kasa = await tx.kasa.findUnique({
          where: { id: v.kasaId },
          select: { id: true, ad: true, aktif: true, silindi: true },
        })
        if (!kasa || kasa.silindi) throw new IsKuraliHatasi("Seçilen kasa bulunamadı.")
        if (!kasa.aktif) throw new IsKuraliHatasi("Pasif kasaya işlem yapılamaz.")

        await tx.kasaHareket.create({
          data: {
            kasaId: kasa.id,
            tur: cek.yon === "ALINAN" ? "GIRIS" : "CIKIS",
            tarih: islemTarihi,
            tutar: cek.tutar,
            aciklama: `${TUR_ADI[cek.tur]} ${cek.portfoyNo} — ${DURUM_ADI[v.yeniDurum].toLowerCase()}`,
            belgeNo: cek.belgeNo,
            cariId: cek.cariId,
            cekSenetId: cek.id,
            olusturanId: kullanici.id,
          },
        })
        etkilenenKasalar.add(kasa.id)
      }

      if (v.ciroCariId) {
        const ciroCari = await tx.cari.findUnique({
          where: { id: v.ciroCariId },
          select: { id: true, silindi: true },
        })
        if (!ciroCari || ciroCari.silindi) throw new IsKuraliHatasi("Ciro carisi bulunamadı.")
      }

      const guncel = await tx.cekSenet.update({
        where: { id: v.id },
        data: {
          durum: v.yeniDurum,
          tahsilKasaId: kasaLazim ? (v.kasaId ?? null) : null,
          tahsilTarihi: kasaLazim ? islemTarihi : null,
          ciroCariId: v.yeniDurum === "CIRO_EDILDI" ? (v.ciroCariId ?? null) : null,
          guncelleyenId: kullanici.id,
        },
      })

      await cariEtkisiniYaz(tx, guncel, kullanici.id)
      await ciroEtkisiniYaz(tx, guncel, kullanici.id, cek.ciroCariId)

      for (const kasaId of etkilenenKasalar) {
        await kasaBakiyeyiHesapla(tx, kasaId)
      }

      await tx.cekSenetHareket.create({
        data: {
          cekSenetId: v.id,
          oncekiDurum: cek.durum,
          yeniDurum: v.yeniDurum,
          tarih: islemTarihi,
          aciklama: v.aciklama ?? null,
          kasaId: kasaLazim ? (v.kasaId ?? null) : null,
          cariId: v.ciroCariId ?? cek.cariId,
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
        },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "cek_senetler",
        kayitId: v.id,
        aciklama: `${cek.portfoyNo} durumu: ${DURUM_ADI[cek.durum]} → ${DURUM_ADI[v.yeniDurum]}`,
        eskiDeger: { durum: cek.durum },
        yeniDeger: { durum: v.yeniDurum, kasaId: v.kasaId, ciroCariId: v.ciroCariId },
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kayıt bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Durum değiştirilemedi:", hata)
    return { hata: "Durum değiştirilemedi." }
  }

  revalidatePath("/cek-senet")
  revalidatePath(`/cek-senet/${v.id}`)
  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  return { basarili: `Durum "${DURUM_ADI[v.yeniDurum]}" olarak güncellendi.` }
}

// ---------------------------------------------------------------------------
//  SİLME / GERİ ALMA
// ---------------------------------------------------------------------------

export async function cekSenetSilmeDurumu(
  id: number,
  sil: boolean
): Promise<CekSenetFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const cek = await tx.cekSenet.findUnique({ where: { id } })
      if (!cek) throw new BulunamadiHatasi()

      if (sil && cek.tahsilatId) {
        throw new IsKuraliHatasi(
          "Bu kâğıt bir tahsilat/ödeme fişine bağlı. Silmek için fişi silin, kâğıt da kapanır."
        )
      }

      if (sil) {
        // Kasaya para girmiş kâğıt silinirse kasa bakiyesi ile defter
        // birbirini tutmaz; önce durum geri alınmalı.
        const kasaSatiri = await tx.kasaHareket.count({
          where: { cekSenetId: id, silindi: false },
        })
        if (kasaSatiri > 0) {
          throw new IsKuraliHatasi(
            "Bu kâğıdın kasaya işlenmiş hareketi var. Önce durumunu geri alın."
          )
        }
      }

      const guncel = await tx.cekSenet.update({
        where: { id },
        data: {
          silindi: sil,
          silmeTarihi: sil ? new Date() : null,
          guncelleyenId: kullanici.id,
        },
      })

      // Silinen kâğıt cari bakiyesini etkilememeli; geri alınınca yeniden yazılır.
      if (sil) {
        await tx.cariHareket.deleteMany({ where: { cekSenetId: id } })
        if (cek.cariId) await bakiyeyiHesapla(tx, cek.cariId)
        if (cek.ciroCariId) await bakiyeyiHesapla(tx, cek.ciroCariId)
      } else {
        await cariEtkisiniYaz(tx, guncel, kullanici.id)
        await ciroEtkisiniYaz(tx, guncel, kullanici.id)
      }

      await tx.cekSenetHareket.create({
        data: {
          cekSenetId: id,
          oncekiDurum: cek.durum,
          yeniDurum: cek.durum,
          aciklama: sil ? "Kayıt silindi" : "Kayıt geri alındı",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
        },
      })

      await logKaydet({
        islem: sil ? "SIL" : "GERI_AL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "cek_senetler",
        kayitId: id,
        aciklama: `${cek.portfoyNo} — ${TUR_ADI[cek.tur]} ${YON_ADI[cek.yon]}`,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kayıt bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Çek/senet silinemedi:", hata)
    return { hata: "İşlem tamamlanamadı." }
  }

  revalidatePath("/cek-senet")
  revalidatePath(`/cek-senet/${id}`)
  return { basarili: sil ? "Kayıt silindi." : "Kayıt geri alındı." }
}

/** Form ve ciro katmanındaki cari araması. */
export async function cekSenetCariAra(q: string) {
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
