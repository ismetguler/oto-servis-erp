"use server"

import { revalidatePath } from "next/cache"

import { birlestirSemasi, KOPYALANACAK_ALANLAR } from "./sema"
import { bakiyeyiHesapla } from "../actions"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"
import type { Prisma } from "@/generated/prisma/client"

/**
 * CARİ BİRLEŞTİRME — yazma tarafı.
 *
 * Projedeki EN RİSKLİ işlem. Mükerrer açılmış iki kartı tek karta indiriyor:
 * kaynağın araç, kabul, evrak, tahsilat, ekstre, kasa, çek-senet, kara liste
 * ve plasiyer bağları hedefe geçiyor, kaynak soft delete ediliyor.
 *
 * TAMAMI TEK TRANSACTION. Yarım kalırsa ortaya "araçları taşınmış ama
 * ekstresi eski kartta duran" bir cari çıkar; o noktadan sonra hiçbir rapor
 * doğru olmaz ve elle düzeltmesi neredeyse imkânsızdır.
 *
 * Yetki: `cari` modülünün SİL izni. Düzeltme izni yetmiyor — bu işlem bir
 * kartı yok ediyor, sonucu silmekten daha ağır (silinen kayıt geri alınabilir,
 * birleşen kayıt geri alınamaz).
 */

export type BirlestirDurumu = {
  hata?: string
  basarili?: string
  hedefId?: number
  alanHatalari?: Record<string, string>
}

/** Transaction içindeki Prisma istemcisi. */
type Islem = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function cariBirlestir(
  _oncekiDurum: BirlestirDurumu,
  form: FormData
): Promise<BirlestirDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("cari", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = birlestirSemasi.safeParse({
    ...Object.fromEntries(form),
    // İşaretsiz checkbox forma HİÇ gelmez; zod'a açıkça false geçiyoruz.
    onaylandi: form.get("onaylandi") === "on",
  })
  if (!cozum.success) {
    const alanHatalari: Record<string, string> = {}
    for (const sorun of cozum.error.issues) {
      const alan = String(sorun.path[0] ?? "")
      if (alan && !alanHatalari[alan]) alanHatalari[alan] = sorun.message
    }
    return { hata: "Birleştirme onaylanmadı.", alanHatalari }
  }

  const { kaynakId, hedefId, onayKodu, aciklama } = cozum.data

  const [kaynak, hedef] = await Promise.all([
    prisma.cari.findUnique({ where: { id: kaynakId } }),
    prisma.cari.findUnique({ where: { id: hedefId } }),
  ])
  if (!kaynak || kaynak.silindi) return { hata: "Kaynak cari bulunamadı." }
  if (!hedef || hedef.silindi) return { hata: "Hedef cari bulunamadı." }

  // Kod ELLE yazılıyor: yanlış satırdaki düğmeye basılmasına karşı tek fren.
  if (onayKodu.toLocaleUpperCase("tr-TR") !== kaynak.kod.toLocaleUpperCase("tr-TR")) {
    return {
      hata: `Yazdığınız kod kaynak cari ile uyuşmuyor. Beklenen: ${kaynak.kod}`,
      alanHatalari: { onayKodu: "Kaynak cari kodunu birebir yazın." },
    }
  }

  let ozet: BirlesmeOzeti
  try {
    ozet = await prisma.$transaction(
      (tx) => birlestirmeyiUygula(tx, kaynakId, hedefId, kullanici.id),
      // Varsayılan 5 sn, geçmişi kalabalık bir caride 14 tablo güncellemesi
      // bunu aşabilir; yarıda kesilen birleşme veriyi bozar.
      { timeout: 30_000 }
    )
  } catch (hata) {
    console.error("Cari birleştirme başarısız:", hata)
    return {
      hata:
        "Birleştirme tamamlanamadı, hiçbir kayıt değişmedi. Sorun sürerse yöneticinize bildirin.",
    }
  }

  await logKaydet({
    islem: "SIL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    kayitId: kaynakId,
    aciklama: `BİRLEŞTİRİLDİ — ${kaynak.kod} ${kaynak.unvan} → ${hedef.kod} ${hedef.unvan}${
      aciklama ? ` · ${aciklama}` : ""
    }`,
    eskiDeger: kaynak,
    yeniDeger: { silindi: true, birlestirilenHedef: hedef.kod, ...ozet },
  })

  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    kayitId: hedefId,
    aciklama: `BİRLEŞTİRME HEDEFİ — ${kaynak.kod} ${kaynak.unvan} bu karta taşındı${
      aciklama ? ` · ${aciklama}` : ""
    }`,
    eskiDeger: hedef,
    yeniDeger: ozet,
  })

  revalidatePath("/cari")
  revalidatePath("/cari/mukerrer")
  revalidatePath("/cari/kara-liste")
  revalidatePath("/cari/tanimlar")
  revalidatePath(`/cari/${hedefId}`)
  revalidatePath(`/cari/${kaynakId}`)
  revalidatePath("/servis/kabul")
  revalidatePath("/arac")

  return {
    basarili: `${kaynak.kod} → ${hedef.kod} birleştirildi. ${ozet.tasinanKayit} kayıt taşındı.`,
    hedefId,
  }
}

type BirlesmeOzeti = {
  tasinan: Record<string, number>
  tasinanKayit: number
  kopyalananAlanlar: string[]
  notEklendi: boolean
  silinenCakisanUsta: number
  kopanPlasiyerBagi: boolean
  hedefKaraListeyeAlindi: boolean
  yeniAcilis: { tutar: number; tur: "BORC" | "ALACAK" }
  yeniBakiye: number
}

/**
 * Birleştirmenin tamamı. Sıra ÖNEMLİ:
 *  1) açılış hareketleri tek satıra indirilir (taşımadan ÖNCE — sonra
 *     hangisinin hangi karta ait olduğu ayırt edilemez),
 *  2) benzersizlik kısıtına takılacak satırlar temizlenir,
 *  3) bağlar taşınır,
 *  4) hedefin boş alanları doldurulur, kaynak kapatılır,
 *  5) iki kartın bakiyesi hareketlerden yeniden hesaplanır.
 */
async function birlestirmeyiUygula(
  tx: Islem,
  kaynakId: number,
  hedefId: number,
  kullaniciId: number
): Promise<BirlesmeOzeti> {
  const kaynak = await tx.cari.findUnique({ where: { id: kaynakId } })
  const hedef = await tx.cari.findUnique({ where: { id: hedefId } })
  if (!kaynak || kaynak.silindi) throw new Error("Kaynak cari bulunamadı.")
  if (!hedef || hedef.silindi) throw new Error("Hedef cari bulunamadı.")
  if (kaynakId === hedefId) throw new Error("Bir cari kendisiyle birleştirilemez.")

  // --- 1) AÇILIŞ BAKİYESİ -------------------------------------------------
  // İki kartın da açılış hareketi olabilir. Taşınsalardı hedefte iki ACILIS
  // satırı olurdu; cari formu `findFirst` ile TEK satır arıyor, ikincisi
  // sonsuza kadar güncellenmeden kalır ve kart ile ekstre ayrışırdı.
  const acilislar = await tx.cariHareket.findMany({
    where: { cariId: { in: [kaynakId, hedefId] }, tur: "ACILIS" },
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    select: { id: true, borc: true, alacak: true, silindi: true },
  })
  const acilisNet = acilislar
    .filter((h) => !h.silindi)
    .reduce((t, h) => t + Number(String(h.borc)) - Number(String(h.alacak)), 0)

  const kalanAcilis = acilislar.find((h) => !h.silindi) ?? acilislar[0]
  const silinecekAcilis = acilislar
    .filter((h) => h.id !== kalanAcilis?.id)
    .map((h) => h.id)
  if (silinecekAcilis.length) {
    await tx.cariHareket.deleteMany({ where: { id: { in: silinecekAcilis } } })
  }
  if (kalanAcilis) {
    if (acilisNet === 0) {
      await tx.cariHareket.delete({ where: { id: kalanAcilis.id } })
    } else {
      await tx.cariHareket.update({
        where: { id: kalanAcilis.id },
        data: {
          cariId: hedefId,
          borc: acilisNet > 0 ? acilisNet : 0,
          alacak: acilisNet < 0 ? -acilisNet : 0,
          aciklama: "Açılış bakiyesi",
          silindi: false,
        },
      })
    }
  }

  // --- 2) BENZERSİZLİK ÇAKIŞMALARI ---------------------------------------
  // KabulPersonel'de @@unique([kabulId, personelId]) var: aynı kabulde hem
  // kaynak hem hedef usta olarak yazılıysa taşıma hata verirdi. Kaynağın
  // satırı siliniyor, hedefinki zaten aynı bilgiyi taşıyor.
  const cakisanlar = await tx.kabulPersonel.findMany({
    where: {
      personelId: kaynakId,
      kabul: { personeller: { some: { personelId: hedefId } } },
    },
    select: { id: true },
  })
  if (cakisanlar.length) {
    await tx.kabulPersonel.deleteMany({
      where: { id: { in: cakisanlar.map((c) => c.id) } },
    })
  }

  // --- 3) BAĞLARI TAŞI -----------------------------------------------------
  // `silindi` filtresi YOK: soft delete edilmiş satır da kaynağı işaret ediyor,
  // bırakılırsa geri alındığında yok olmuş bir cariye bağlanır.
  const kopanPlasiyerBagi = hedef.plasiyerId === kaynakId
  if (kopanPlasiyerBagi) {
    // Kaynak, hedefin plasiyeri olarak yazılmış. Taşınsa hedef kendi
    // plasiyeri olurdu; bu bağ anlamsız, kopuyor.
    await tx.cari.update({ where: { id: hedefId }, data: { plasiyerId: null } })
  }

  const tasinan: Record<string, number> = {
    arac: (await tx.arac.updateMany({ where: { cariId: kaynakId }, data: { cariId: hedefId } }))
      .count,
    kabul: (
      await tx.kabul.updateMany({ where: { cariId: kaynakId }, data: { cariId: hedefId } })
    ).count,
    garantiKabul: (
      await tx.kabul.updateMany({
        where: { garantiVerenId: kaynakId },
        data: { garantiVerenId: hedefId },
      })
    ).count,
    kabulPersonel: (
      await tx.kabulPersonel.updateMany({
        where: { personelId: kaynakId },
        data: { personelId: hedefId },
      })
    ).count,
    kalemPersonel: (
      await tx.kabulKalem.updateMany({
        where: { personelId: kaynakId },
        data: { personelId: hedefId },
      })
    ).count,
    evrak: (
      await tx.evrak.updateMany({ where: { cariId: kaynakId }, data: { cariId: hedefId } })
    ).count,
    tahsilat: (
      await tx.tahsilat.updateMany({ where: { cariId: kaynakId }, data: { cariId: hedefId } })
    ).count,
    cariHareket: (
      await tx.cariHareket.updateMany({
        where: { cariId: kaynakId },
        data: { cariId: hedefId },
      })
    ).count,
    kasaHareket: (
      await tx.kasaHareket.updateMany({
        where: { cariId: kaynakId },
        data: { cariId: hedefId },
      })
    ).count,
    cekSenet: (
      await tx.cekSenet.updateMany({ where: { cariId: kaynakId }, data: { cariId: hedefId } })
    ).count,
    ciroCek: (
      await tx.cekSenet.updateMany({
        where: { ciroCariId: kaynakId },
        data: { ciroCariId: hedefId },
      })
    ).count,
    // Çek-senet durum geçmişindeki `cariId` çıplak bir Int (FK yok) ama
    // ciro satırında "kime devredildi" bilgisini o tutuyor.
    cekHareket: (
      await tx.cekSenetHareket.updateMany({
        where: { cariId: kaynakId },
        data: { cariId: hedefId },
      })
    ).count,
    // Kara liste geçmişi de taşınıyor: aynı müşterinin geçmişi, hedef kartta
    // görünmezse "bu müşteri daha önce kara listedeydi" bilgisi kaybolur.
    karaListe: (
      await tx.karaListeKaydi.updateMany({
        where: { cariId: kaynakId },
        data: { cariId: hedefId },
      })
    ).count,
    plasiyerBagi: (
      await tx.cari.updateMany({
        where: { plasiyerId: kaynakId },
        data: { plasiyerId: hedefId },
      })
    ).count,
  }

  // --- 4) HEDEFİ TAMAMLA, KAYNAĞI KAPAT -----------------------------------
  const guncelleme: Prisma.CariUncheckedUpdateInput = { guncelleyenId: kullaniciId }
  const kopyalananAlanlar: string[] = []
  for (const [alan, etiket] of KOPYALANACAK_ALANLAR) {
    if (!bos(hedef[alan])) continue
    const deger = kaynak[alan]
    if (bos(deger)) continue
    if (alan === "plasiyerId" && deger === hedefId) continue
    ;(guncelleme as Record<string, unknown>)[alan] = deger
    kopyalananAlanlar.push(etiket)
  }

  // Not alanı kopyalanmıyor, EKLENİYOR: iki kartta da not varsa birini atmak
  // kullanıcının yazdığı bilgiyi sessizce siler.
  let notEklendi = false
  if (!bos(kaynak.notu)) {
    if (bos(hedef.notu)) {
      guncelleme.notu = kaynak.notu
    } else {
      guncelleme.notu = `${hedef.notu}\n\n[${kaynak.kod} birleştirmesinden] ${kaynak.notu}`
      notEklendi = true
    }
  }

  // Kara liste ÖZET alanı (`Cari.karaListe`) geçmiş tablosunun türevi;
  // kaynağın açık kaydı hedefe taşındıysa hedef de kara listede sayılmalı,
  // yoksa kabul ekranındaki uyarı çıkmaz.
  const acikKaraListe = await tx.karaListeKaydi.findFirst({
    where: { cariId: hedefId, kaldirmaTarihi: null },
    orderBy: { alisTarihi: "desc" },
    select: { neden: true },
  })
  const hedefKaraListeyeAlindi = !hedef.karaListe && acikKaraListe !== null
  if (acikKaraListe) {
    guncelleme.karaListe = true
    guncelleme.karaListeNedeni = hedef.karaListeNedeni ?? acikKaraListe.neden
  }

  guncelleme.acilisBakiye = Math.abs(acilisNet)
  guncelleme.acilisTuru = acilisNet < 0 ? "ALACAK" : "BORC"

  await tx.cari.update({ where: { id: hedefId }, data: guncelleme })

  // Kaynak kapatılıyor. Ünvana işaret düşülüyor: kayıt artık yalnızca
  // "silinenler" listesinde görünüyor, orada neden silindiği yazmasa
  // kimse anlamaz. Eski ünvan işlem logunda `eskiDeger` içinde duruyor.
  await tx.cari.update({
    where: { id: kaynakId },
    data: {
      unvan: `${kaynak.unvan} (BİRLEŞTİRİLDİ → ${hedef.kod})`,
      aktif: false,
      silindi: true,
      silmeTarihi: new Date(),
      karaListe: false,
      karaListeNedeni: null,
      acilisBakiye: 0,
      acilisTuru: "BORC",
      plasiyerId: null,
      notu: `${kaynak.notu ? `${kaynak.notu}\n\n` : ""}Bu kart ${new Date().toLocaleDateString(
        "tr-TR"
      )} tarihinde ${hedef.kod} — ${hedef.unvan} kartıyla birleştirildi.`,
      guncelleyenId: kullaniciId,
    },
  })

  // --- 5) BAKİYELER --------------------------------------------------------
  await bakiyeyiHesapla(tx, hedefId)
  await bakiyeyiHesapla(tx, kaynakId)

  const sonHedef = await tx.cari.findUnique({
    where: { id: hedefId },
    select: { bakiye: true },
  })

  return {
    tasinan,
    tasinanKayit: Object.values(tasinan).reduce((t, s) => t + s, 0),
    kopyalananAlanlar,
    notEklendi,
    silinenCakisanUsta: cakisanlar.length,
    kopanPlasiyerBagi,
    hedefKaraListeyeAlindi,
    yeniAcilis: {
      tutar: Math.abs(acilisNet),
      tur: acilisNet < 0 ? "ALACAK" : "BORC",
    },
    yeniBakiye: Number(String(sonHedef?.bakiye ?? 0)),
  }
}

function bos(deger: unknown) {
  return deger === null || deger === undefined || String(deger).trim() === ""
}
