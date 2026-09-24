"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { kabulSemasi, kalemSemasi, tarihSaatBirlestir } from "./sema"
import { stokCikisiYaz, stokHareketiniGeriAl, toplamlariYenile } from "./stok-islem"
import { katalogAra } from "./veri"
import { bakiyeyiHesapla } from "@/app/(panel)/cari/actions"
import type { Prisma } from "@/generated/prisma/client"
import type { KabulDurum } from "@/generated/prisma/enums"
import { kalemHesapla } from "@/lib/hesap"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

type Islem = Prisma.TransactionClient

export type KabulFormDurumu = {
  hata?: string
  alanHatalari?: Record<string, string>
}

export type KalemDurumu = { hata?: string }

// ============================================================================
//  KABUL KARTI — kaydet / sil / durum
// ============================================================================

/**
 * Araç kabul kartını kaydeder (yeni veya güncelleme).
 *
 * Selpar'daki gibi tek ekran hem iş emrini hem de aracın güncel bilgisini
 * yönetiyor: giriş km'si, motor çalışma süresi ve triger değişimi kabulde
 * girildiğinde araç kartına da işlenir. Aksi hâlde araç kartındaki "son km"
 * hiç güncellenmez, bakım hatırlatma raporları yanlış çalışırdı.
 */
export async function kabulKaydet(
  _oncekiDurum: KabulFormDurumu,
  form: FormData
): Promise<KabulFormDurumu> {
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

  const cozum = kabulSemasi.safeParse({
    ...Object.fromEntries(form),
    kdvDahilGirilir: form.get("kdvDahilGirilir") === "on",
    personelIdler: form
      .getAll("personelIdler")
      .map((d) => Number(d))
      .filter((d) => Number.isInteger(d) && d > 0),
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
  const tarihe = (d?: string) => (d ? new Date(`${d}T00:00:00`) : null)

  // Araç ile müşterinin tutarlılığı: aracın sahibi başkasıysa kabul kartı
  // yanlış cariye borç yazardı. Selpar da araç seçilince cariyi zorluyor.
  const arac = await prisma.arac.findUnique({
    where: { id: v.aracId },
    select: { id: true, plaka: true, cariId: true, silindi: true, sonKm: true },
  })
  if (!arac || arac.silindi) {
    return { hata: "Seçilen araç bulunamadı.", alanHatalari: { aracId: "Araç geçersiz." } }
  }

  const cari = await prisma.cari.findUnique({
    where: { id: v.cariId },
    select: { id: true, unvan: true, silindi: true, karaListe: true, karaListeNedeni: true },
  })
  if (!cari || cari.silindi) {
    return { hata: "Seçilen müşteri bulunamadı.", alanHatalari: { cariId: "Cari geçersiz." } }
  }
  // Kara liste ENGEL DEĞİL, UYARI: servise gelmiş aracı geri çevirmek
  // kararı danışmanın, yazılımın değil. Ama uyarı görülmeden geçilmesin
  // diye formdaki onay kutusu isteniyor ve onaylandığı loga yazılıyor.
  const karaListeOnayi = form.get("karaListeOnay") === "on"
  if (!duzenleme && cari.karaListe && !karaListeOnayi) {
    return {
      // Nedenin sonundaki nokta kırpılıyor: kullanıcı cümle olarak yazdığında
      // mesajda ".." görünüyordu.
      hata: `UYARI: "${cari.unvan}" kara listede${cari.karaListeNedeni ? ` — ${cari.karaListeNedeni.replace(/[.\s]+$/, "")}` : ""}. Devam etmek için Müşteri Bilgileri sekmesindeki onay kutusunu işaretleyin.`,
      alanHatalari: { cariId: "Cari kara listede — onay gerekli." },
    }
  }

  const kartAlanlari = {
    kabulOzelNo: v.kabulOzelNo ?? null,
    kartTuru: v.kartTuru ?? null,
    durum: v.durum,
    girisTarihi: tarihSaatBirlestir(v.girisTarihi, v.girisSaati) ?? new Date(),
    girisKm: v.girisKm ?? null,
    tahminiTeslimTarihi: v.tahminiTeslimTarihi
      ? tarihSaatBirlestir(v.tahminiTeslimTarihi, v.tahminiTeslimSaati ?? "17:00")
      : null,
    teslimNotu: v.teslimNotu ?? null,
    sikayet: v.sikayet ?? null,
    yapilanIsler: v.yapilanIsler ?? null,
    istekTuru: v.istekTuru ?? null,
    bakimSekli: v.bakimSekli ?? null,
    projesi: v.projesi ?? null,
    filoSirketi: v.filoSirketi ?? null,
    ozelEsya: v.ozelEsya ?? null,
    aracNotlari: v.aracNotlari ?? null,
    cariNotu: v.cariNotu ?? null,
    sonrakiGelisTarihi: tarihe(v.sonrakiGelisTarihi),
    sonrakiGelisKm: v.sonrakiGelisKm ?? null,
    // Garanti takibi: firma bağı ilişki nesnesiyle yazıldığı için
    // `kartAlanlari` dışında, aşağıdaki create/update içinde ayrıca veriliyor.
    garantiDosyaNo: v.garantiDosyaNo ?? null,
    garantiOnayNo: v.garantiOnayNo ?? null,
    garantiTalepTarihi: tarihe(v.garantiTalepTarihi),
    garantiDurumu: v.garantiDurumu ?? null,
    garantiTutar: v.garantiTutar ?? 0,
    garantiNotu: v.garantiNotu ?? null,
    tahminiTutar: v.tahminiTutar ?? 0,
    evrakKdvOrani: v.evrakKdvOrani,
    kdvDahilGirilir: v.kdvDahilGirilir,
  }

  let kayitId: number

  try {
    kayitId = await prisma.$transaction(async (tx) => {
      let kabulId: number
      let kabulNo: string

      if (duzenleme) {
        const onceki = await tx.kabul.findUnique({
          where: { id },
          include: { personeller: { select: { personelId: true } } },
        })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()
        if (onceki.durum === "TESLIM_EDILDI") throw new KapaliKartHatasi()

        const kabul = await tx.kabul.update({
          where: { id },
          data: {
            ...kartAlanlari,
            // Prisma 7'de scalar FK doğrudan yazılamıyor, ilişki nesnesi gerekiyor.
            cari: { connect: { id: v.cariId } },
            arac: { connect: { id: v.aracId } },
            formen: v.formenId
              ? { connect: { id: v.formenId } }
              : onceki.formenId
                ? { disconnect: true }
                : undefined,
            garantiVeren: v.garantiVerenId
              ? { connect: { id: v.garantiVerenId } }
              : onceki.garantiVerenId
                ? { disconnect: true }
                : undefined,
            guncelleyenId: kullanici.id,
          },
        })

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "kabuller",
          kayitId: kabul.id,
          aciklama: `${kabul.kabulNo} — ${arac.plaka}`,
          eskiDeger: onceki,
          yeniDeger: kabul,
        })

        kabulId = kabul.id
        kabulNo = kabul.kabulNo
      } else {
        kabulNo = await siradakiNumara(tx, "KABUL", {
          yilBazli: true,
          varsayilanOnEk: `K${new Date().getFullYear()}-`,
          basamak: 5,
        })

        const kabul = await tx.kabul.create({
          data: {
            ...kartAlanlari,
            kabulNo,
            cari: { connect: { id: v.cariId } },
            arac: { connect: { id: v.aracId } },
            ...(v.formenId ? { formen: { connect: { id: v.formenId } } } : {}),
            ...(v.garantiVerenId
              ? { garantiVeren: { connect: { id: v.garantiVerenId } } }
              : {}),
            olusturan: { connect: { id: kullanici.id } },
          },
        })

        await logKaydet({
          islem: "EKLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "kabuller",
          kayitId: kabul.id,
          aciklama:
            `${kabul.kabulNo} — ${arac.plaka}` +
            // Kara listedeki cariye kabul açmak istisnai bir karar; ayrıca
            // yazılıyor ki log listesinde aranabilsin.
            (cari.karaListe ? " · KARA LİSTEDEKİ CARİYE AÇILDI (onaylandı)" : ""),
          yeniDeger: kabul,
        })

        kabulId = kabul.id
      }

      await personelleriEsitle(tx, kabulId, v.personelIdler)

      // Araç kartına geri yazılan alanlar. Km yalnızca ileri gider: yanlış
      // yazılan bir kabul km'si aracın gerçek kilometresini geri almasın.
      const aracGuncel: Prisma.AracUpdateInput = {}
      if (v.girisKm !== undefined && v.girisKm > (arac.sonKm ?? 0)) {
        aracGuncel.sonKm = v.girisKm
      }
      if (v.trigerDegisimKm !== undefined) aracGuncel.trigerDegisimKm = v.trigerDegisimKm
      if (v.trigerDegisimTarih !== undefined) {
        aracGuncel.trigerDegisimTarih = tarihe(v.trigerDegisimTarih)
      }
      if (v.sonrakiGelisTarihi !== undefined) {
        aracGuncel.sonrakiBakimTarih = tarihe(v.sonrakiGelisTarihi)
      }
      if (v.sonrakiGelisKm !== undefined) aracGuncel.sonrakiBakimKm = v.sonrakiGelisKm

      // Aracın sahibi boşsa kabuldeki cari sahibi kabul edilir (Selpar da
      // ilk kabulde aracı müşteriye bağlıyor).
      if (!arac.cariId) aracGuncel.cari = { connect: { id: v.cariId } }

      if (Object.keys(aracGuncel).length) {
        await tx.arac.update({ where: { id: v.aracId }, data: aracGuncel })
      }

      return kabulId
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) {
      return { hata: "Kabul kartı bulunamadı; silinmiş olabilir." }
    }
    if (hata instanceof KapaliKartHatasi) {
      return { hata: "Teslim edilmiş kart düzenlenemez. Önce kartı geri açın." }
    }
    console.error("Kabul kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/servis/kabul")
  revalidatePath(`/servis/kabul/${kayitId}`)
  revalidatePath(`/arac/${v.aracId}`)
  revalidatePath(`/cari/${v.cariId}`)
  redirect(`/servis/kabul/${kayitId}?kaydedildi=1`)
}

/** Karta atanan personel listesini forma göre eşitler. */
async function personelleriEsitle(tx: Islem, kabulId: number, istenen: number[]) {
  const mevcut = await tx.kabulPersonel.findMany({
    where: { kabulId },
    select: { personelId: true },
  })
  const mevcutIdler = mevcut.map((m) => m.personelId)

  const silinecek = mevcutIdler.filter((d) => !istenen.includes(d))
  const eklenecek = istenen.filter((d) => !mevcutIdler.includes(d))

  if (silinecek.length) {
    await tx.kabulPersonel.deleteMany({ where: { kabulId, personelId: { in: silinecek } } })
  }
  for (const personelId of eklenecek) {
    await tx.kabulPersonel.create({ data: { kabulId, personelId } })
  }
}

// ============================================================================
//  KALEM (parça / işçilik / dış hizmet)
// ============================================================================

/**
 * Kalem satırı ekler veya günceller ve stok hareketini buna göre düzeltir.
 *
 * Parça satırı stoktan düşer (Selpar'daki "Kabul Parça Çıkışı"). Satır
 * güncellenirse eski çıkış iptal edilip yenisi yazılır — fark hesaplamak
 * yerine "sil-yeniden yaz" tercih edildi, çünkü miktar/stok/depo aynı anda
 * değişebiliyor ve fark hesabı sessizce yanlış sonuç verebiliyor.
 */
export async function kalemKaydet(
  _oncekiDurum: KalemDurumu,
  form: FormData
): Promise<KalemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = kalemSemasi.safeParse({
    ...Object.fromEntries(form),
    garantili: form.get("garantili") === "on",
  })
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Satır bilgileri hatalı." }
  }

  const v = cozum.data

  try {
    await prisma.$transaction(async (tx) => {
      const kabul = await tx.kabul.findUnique({
        where: { id: v.kabulId },
        select: { id: true, durum: true, silindi: true, kdvDahilGirilir: true },
      })
      if (!kabul || kabul.silindi) throw new BulunamadiHatasi()
      if (kabul.durum === "TESLIM_EDILDI") throw new KapaliKartHatasi()

      const hesap = kalemHesapla(v, kabul.kdvDahilGirilir)

      const alanlar = {
        tur: v.tur,
        aciklama: v.aciklama,
        birim: v.birim,
        miktar: v.miktar,
        birimFiyat: v.birimFiyat,
        kdvOrani: v.kdvOrani,
        tutar: hesap.tutar,
        kdvTutar: hesap.kdvTutar,
        toplam: hesap.toplam,
        garantili: v.garantili,
      }

      let kalemId: number

      if (v.id) {
        const onceki = await tx.kabulKalem.findUnique({ where: { id: v.id } })
        if (!onceki || onceki.kabulId !== v.kabulId) throw new BulunamadiHatasi()

        await stokHareketiniGeriAl(tx, onceki.id)

        const kalem = await tx.kabulKalem.update({
          where: { id: v.id },
          data: {
            ...alanlar,
            stok: v.stokId ? { connect: { id: v.stokId } } : { disconnect: true },
            iscilik: v.iscilikId ? { connect: { id: v.iscilikId } } : { disconnect: true },
            personel: v.personelId ? { connect: { id: v.personelId } } : { disconnect: true },
          },
        })
        kalemId = kalem.id
      } else {
        const sonSira = await tx.kabulKalem.aggregate({
          where: { kabulId: v.kabulId },
          _max: { sira: true },
        })

        const kalem = await tx.kabulKalem.create({
          data: {
            ...alanlar,
            sira: (sonSira._max.sira ?? 0) + 1,
            kabul: { connect: { id: v.kabulId } },
            ...(v.stokId ? { stok: { connect: { id: v.stokId } } } : {}),
            ...(v.iscilikId ? { iscilik: { connect: { id: v.iscilikId } } } : {}),
            ...(v.personelId ? { personel: { connect: { id: v.personelId } } } : {}),
          },
        })
        kalemId = kalem.id
      }

      if (v.tur === "PARCA" && v.stokId) {
        await stokCikisiYaz(tx, {
          kalemId,
          kabulId: v.kabulId,
          stokId: v.stokId,
          miktar: v.miktar,
          birimFiyat: v.birimFiyat,
          tutar: hesap.tutar,
          kullaniciId: kullanici.id,
        })
      }

      await toplamlariYenile(tx, v.kabulId)

      await logKaydet({
        islem: v.id ? "GUNCELLE" : "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kabul_kalemleri",
        kayitId: kalemId,
        aciklama: `${v.aciklama} (${v.miktar} × ${v.birimFiyat})`,
        yeniDeger: alanlar,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Satır veya kart bulunamadı." }
    if (hata instanceof KapaliKartHatasi) {
      return { hata: "Teslim edilmiş karta satır eklenemez." }
    }
    console.error("Kalem kaydedilemedi:", hata)
    return { hata: "Satır kaydedilemedi." }
  }

  revalidatePath(`/servis/kabul/${v.kabulId}`)
  return {}
}

/** Kalem satırını siler; parça satırıysa stoğu geri yükler. */
export async function kalemSil(kalemId: number): Promise<KalemDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let kabulId = 0
  try {
    await prisma.$transaction(async (tx) => {
      const kalem = await tx.kabulKalem.findUnique({
        where: { id: kalemId },
        include: { kabul: { select: { id: true, durum: true, silindi: true } } },
      })
      if (!kalem) throw new BulunamadiHatasi()
      if (kalem.kabul.durum === "TESLIM_EDILDI") throw new KapaliKartHatasi()

      kabulId = kalem.kabulId
      await stokHareketiniGeriAl(tx, kalem.id)
      await tx.kabulKalem.delete({ where: { id: kalemId } })
      await toplamlariYenile(tx, kabulId)

      await logKaydet({
        islem: "SIL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kabul_kalemleri",
        kayitId: kalemId,
        aciklama: kalem.aciklama,
        eskiDeger: kalem,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Satır bulunamadı." }
    if (hata instanceof KapaliKartHatasi) {
      return { hata: "Teslim edilmiş kartın satırı silinemez." }
    }
    console.error("Kalem silinemedi:", hata)
    return { hata: "Satır silinemedi." }
  }

  revalidatePath(`/servis/kabul/${kabulId}`)
  return {}
}

// ============================================================================
//  DURUM / TESLİM / SİLME
// ============================================================================

/**
 * Kart durumunu değiştirir. TESLIM_EDILDI'ye geçiş "onarımı kapat" demektir:
 * teslim tarihi damgalanır, araç kartının km ve bakım bilgisi güncellenir ve
 * cariye borç hareketi yazılır. Kart geri açılırsa bu hareket geri alınır —
 * yoksa cari ekstresinde iki kez borçlanma görünürdü.
 */
export async function kabulDurumDegistir(
  kabulId: number,
  yeniDurum: KabulDurum
): Promise<{ hata?: string; uyari?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let cariId = 0
  let aracId = 0
  /** Teslim geri alındığında ekranda gösterilecek "tahsilatı duruyor" uyarısı. */
  let uyari: string | undefined

  try {
    await prisma.$transaction(async (tx) => {
      const kabul = await tx.kabul.findUnique({
        where: { id: kabulId },
        select: {
          id: true,
          kabulNo: true,
          durum: true,
          silindi: true,
          cariId: true,
          aracId: true,
          girisKm: true,
          sonrakiGelisKm: true,
          sonrakiGelisTarihi: true,
          genelToplam: true,
          _count: { select: { kalemler: true } },
        },
      })
      if (!kabul || kabul.silindi) throw new BulunamadiHatasi()

      cariId = kabul.cariId
      aracId = kabul.aracId

      if (yeniDurum === "TESLIM_EDILDI" && kabul._count.kalemler === 0) {
        throw new IsKuraliHatasi("Satırı olmayan kart teslim edilemez.")
      }

      /**
       * FATURALANMIŞ KART GERİ AÇILAMAZ (adım 9.2). Kart geri açılınca
       * `KABUL` borcu siliniyor — ama faturaya dönüştürülmüş kartta o borç
       * zaten faturaya devredilmişti ve kalemler faturaya kopyalanmıştı.
       * Geri açılıp satır değiştirilseydi fatura ile kart sessizce ayrışırdı.
       * Doğru sıra: önce faturayı iptal et, sonra kartı geri aç.
       */
      if (yeniDurum !== "TESLIM_EDILDI") {
        const fatura = await tx.evrak.findFirst({
          where: { kabulId, silindi: false, durum: { not: "IPTAL" } },
          select: { evrakNo: true },
        })
        if (fatura) {
          throw new IsKuraliHatasi(
            `Bu karta bağlı ${fatura.evrakNo} faturası var; önce faturayı iptal edin.`
          )
        }
      }

      const toplam = await toplamlariYenile(tx, kabulId)

      await tx.kabul.update({
        where: { id: kabulId },
        data: {
          durum: yeniDurum,
          teslimTarihi: yeniDurum === "TESLIM_EDILDI" ? new Date() : null,
          guncelleyenId: kullanici.id,
        },
      })

      if (yeniDurum === "TESLIM_EDILDI") {
        const arac = await tx.arac.findUnique({
          where: { id: kabul.aracId },
          select: { sonKm: true },
        })
        const aracGuncel: Prisma.AracUpdateInput = {}
        if (kabul.girisKm && kabul.girisKm > (arac?.sonKm ?? 0)) {
          aracGuncel.sonKm = kabul.girisKm
        }
        if (kabul.sonrakiGelisKm) aracGuncel.sonrakiBakimKm = kabul.sonrakiGelisKm
        if (kabul.sonrakiGelisTarihi) aracGuncel.sonrakiBakimTarih = kabul.sonrakiGelisTarihi
        if (Object.keys(aracGuncel).length) {
          await tx.arac.update({ where: { id: kabul.aracId }, data: aracGuncel })
        }

        await tx.cariHareket.deleteMany({ where: { kabulId, tur: "KABUL" } })
        if (toplam.genelToplam > 0) {
          await tx.cariHareket.create({
            data: {
              cari: { connect: { id: kabul.cariId } },
              kabul: { connect: { id: kabulId } },
              tur: "KABUL",
              borc: toplam.genelToplam,
              aciklama: `Servis kabul ${kabul.kabulNo}`,
              olusturanId: kullanici.id,
            },
          })
        }
      } else {
        // Kart tekrar açıldı: kapanışta yazılan borç hareketi kaldırılır.
        await tx.cariHareket.deleteMany({ where: { kabulId, tur: "KABUL" } })

        // Tahsilat fişine DOKUNULMAZ: para gerçekten alındı, kasada duruyor.
        // Ama borç kalkıp tahsilat kaldığı için cari avans (alacaklı) duruma
        // düşer; kullanıcı bunu ekranda görmezse "bakiye neden eksi" diye
        // arar. (İsmet'in kararı, 25 Ağu 2026: serbest bırak + uyar.)
        const bagliTahsilat = await tx.tahsilat.aggregate({
          where: { kabulId, silindi: false },
          _sum: { tutar: true },
          _count: { _all: true },
        })
        if (bagliTahsilat._count._all > 0) {
          const tutar = Number((bagliTahsilat._sum.tutar ?? 0).toString())
          uyari =
            `Bu karta bağlı ${bagliTahsilat._count._all} tahsilat fişi (${tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL) ` +
            "duruyor. Borç kaldırıldı, tahsilat yerinde — cari avans durumuna geçmiş olabilir."
        }
      }

      await bakiyeyiHesapla(tx, kabul.cariId)

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kabuller",
        kayitId: kabulId,
        aciklama: `${kabul.kabulNo} durumu: ${kabul.durum} → ${yeniDurum}`,
        eskiDeger: { durum: kabul.durum },
        yeniDeger: { durum: yeniDurum },
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kabul kartı bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Kabul durumu değiştirilemedi:", hata)
    return { hata: "Durum değiştirilemedi." }
  }

  revalidatePath("/servis/kabul")
  revalidatePath(`/servis/kabul/${kabulId}`)
  revalidatePath(`/cari/${cariId}`)
  revalidatePath(`/arac/${aracId}`)
  revalidatePath("/tahsilat")
  return { uyari }
}

/**
 * Kabul kartını siler / geri alır. Fiziksel silme yok.
 * Silinen kartın parça çıkışları stoğa geri yüklenir, cari borcu iptal edilir.
 */
export async function kabulSilmeDurumu(
  kabulId: number,
  silinsin: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  let cariId = 0
  try {
    await prisma.$transaction(async (tx) => {
      const kabul = await tx.kabul.findUnique({
        where: { id: kabulId },
        select: {
          id: true,
          kabulNo: true,
          cariId: true,
          faturaKesildi: true,
          kalemler: { select: { id: true } },
        },
      })
      if (!kabul) throw new BulunamadiHatasi()
      cariId = kabul.cariId

      if (silinsin && kabul.faturaKesildi) {
        throw new IsKuraliHatasi("Faturası kesilmiş kart silinemez; önce faturayı iptal edin.")
      }

      // Henüz kesilmemiş (TASLAK) bir fatura da bu karta bağlı olabilir —
      // kart silinseydi fatura sahipsiz kalırdı (adım 9.2).
      if (silinsin) {
        const fatura = await tx.evrak.findFirst({
          where: { kabulId, silindi: false, durum: { not: "IPTAL" } },
          select: { evrakNo: true },
        })
        if (fatura) {
          throw new IsKuraliHatasi(
            `Bu karta bağlı ${fatura.evrakNo} faturası var; önce faturayı silin veya iptal edin.`
          )
        }
      }

      if (silinsin) {
        for (const kalem of kabul.kalemler) await stokHareketiniGeriAl(tx, kalem.id)
        await tx.cariHareket.deleteMany({ where: { kabulId, tur: "KABUL" } })
      }

      await tx.kabul.update({
        where: { id: kabulId },
        data: {
          silindi: silinsin,
          silmeTarihi: silinsin ? new Date() : null,
          guncelleyenId: kullanici.id,
        },
      })

      await bakiyeyiHesapla(tx, kabul.cariId)

      await logKaydet({
        islem: silinsin ? "SIL" : "GERI_AL",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "kabuller",
        kayitId: kabulId,
        aciklama: kabul.kabulNo,
      })
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kabul kartı bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Kabul silinemedi:", hata)
    return { hata: "İşlem tamamlanamadı." }
  }

  revalidatePath("/servis/kabul")
  revalidatePath(`/servis/kabul/${kabulId}`)
  revalidatePath(`/cari/${cariId}`)
  return {}
}

/**
 * Fatura ve tahsilat işaretleri. Fatura modülü henüz yok; Selpar'daki
 * "Faturası Kesilmeyen Kabuller" ve "Tahsilatı Yapılmayan Onarımlar"
 * listeleri bu iki bayrakla çalıştığı için elle işaretlenebiliyor.
 */
export async function kabulBayrakDegistir(
  kabulId: number,
  alan: "faturaKesildi" | "odendi",
  deger: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("kabul", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const kabul = await prisma.kabul.findUnique({
    where: { id: kabulId },
    select: { kabulNo: true, silindi: true },
  })
  if (!kabul || kabul.silindi) return { hata: "Kabul kartı bulunamadı." }

  await prisma.kabul.update({
    where: { id: kabulId },
    data: { [alan]: deger, guncelleyenId: kullanici.id },
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kabuller",
    kayitId: kabulId,
    aciklama: `${kabul.kabulNo} — ${alan} = ${deger ? "evet" : "hayır"}`,
  })

  revalidatePath("/servis/kabul")
  revalidatePath(`/servis/kabul/${kabulId}`)
  return {}
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}

class KapaliKartHatasi extends Error {
  constructor() {
    super("Kart teslim edilmiş.")
    this.name = "KapaliKartHatasi"
  }
}

class IsKuraliHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = "IsKuraliHatasi"
  }
}

/**
 * Kalem satırındaki parça / işçilik arama kutusunu besler.
 * `veri.ts` sunucuya özel olduğu için istemci oradan çağıramaz; arama bu
 * ince action üzerinden geçer ve yetki burada kontrol edilir.
 */
export async function katalogAraAction(tur: "PARCA" | "ISCILIK", q: string) {
  await yetkiliOturum("kabul", "gor")
  return katalogAra(tur, q)
}
