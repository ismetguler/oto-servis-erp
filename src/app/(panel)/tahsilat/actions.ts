"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { hizliTahsilatSemasi, kagitGerektirir, kasaGerektirir, tahsilatSemasi } from "./sema"
import { ODEME_SEKLI_ADI, TUR_ADI } from "./veri"
import { bakiyeyiHesapla } from "@/app/(panel)/cari/actions"
import { kasaBakiyeyiHesapla } from "@/app/(panel)/kasa/actions"
import type { Prisma } from "@/generated/prisma/client"
import type { OdemeSekli, TahsilatTur } from "@/generated/prisma/enums"
import { para } from "@/lib/bicim"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { YetkiHatasi } from "@/lib/yetki"

/**
 * TAHSİLAT / ÖDEME — yazma tarafı.
 *
 * İki bakiyeye de DOLAYLI dokunur; kart alanları elle değiştirilmez:
 *  - Cari: `cari_hareketleri`ne satır yazılır, `bakiyeyiHesapla` toplar.
 *  - Kasa: `kasa_hareketleri`ne satır yazılır, `kasaBakiyeyiHesapla` toplar.
 *
 * Kabul teslim akışıyla ÇAKIŞMAZ: kabul kendi satırını `tur: "KABUL"`,
 * tahsilat kendi satırını `tahsilatId` ile bulup siler. Kabul geri açılırsa
 * yalnız borç satırı kalkar, tahsilat yerinde durur — para gerçekten
 * alındığı için cari avans (alacaklı) duruma düşer. İsmet'in kararı
 * (25 Ağu 2026): "serbest bırak + uyar".
 */

export type TahsilatFormDurumu = {
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

class FisCakismasi extends Error {
  constructor() {
    super("Bu fiş numarası aynı türde zaten kullanılıyor.")
    this.name = "FisCakismasi"
  }
}

/**
 * Fiş numarası. Sayaç yıl bazlı sıfırlandığı için ön eke yıl yazılır
 * (TH2026-00001): yıl ön ekte olmasaydı 2027'de üretilen TH00001,
 * 2026'nınkiyle `@@unique([tur, fisNo])` kısıtında çakışırdı.
 */
export async function fisNumarasi(tx: Islem, tur: TahsilatTur): Promise<string> {
  const yil = new Date().getFullYear()
  const onEk = `${tur === "TAHSILAT" ? "TH" : "TD"}${yil}-`

  // Sayaç satırı ilk sürümde yılsız ön ekle (TH-) açılmıştı; ön eki içinde yıl
  // geçmeyen satırları tek seferlik düzeltiyoruz. `siradakiNumara` ön eki
  // yalnız satırı İLK kez oluştururken yazar, mevcut satıra dokunmaz.
  await tx.numarator.updateMany({
    where: { tur, yil, NOT: { onEk: { contains: String(yil) } } },
    data: { onEk },
  })

  return siradakiNumara(tx, tur, { yilBazli: true, varsayilanOnEk: onEk, basamak: 5 })
}

// ---------------------------------------------------------------------------
//  CARİ VE KASA ETKİSİ
// ---------------------------------------------------------------------------

/**
 * Fişin cariye yansıması:
 *  - TAHSILAT → müşteriden para aldık, borcu azalır → ALACAK
 *  - TEDIYE   → tedarikçiye para verdik, borcumuz azalır → BORÇ
 *
 * "Güncelle" yerine "sil + yeniden yaz": cari değişmiş olabilir, tek satırı
 * güncellemek eski carinin bakiyesini asılı bırakırdı.
 */
export async function cariEtkisiniYaz(
  tx: Islem,
  fis: {
    id: number
    cariId: number
    tur: TahsilatTur
    fisNo: string
    tarih: Date
    tutar: Prisma.Decimal | number
    odemeSekli: OdemeSekli
    silindi: boolean
  },
  kullaniciId: number,
  eskiCariId?: number | null
) {
  await tx.cariHareket.deleteMany({ where: { tahsilatId: fis.id } })

  if (!fis.silindi) {
    const tutar = Number(fis.tutar.toString())
    await tx.cariHareket.create({
      data: {
        cariId: fis.cariId,
        tahsilatId: fis.id,
        tur: fis.tur,
        tarih: fis.tarih,
        borc: fis.tur === "TEDIYE" ? tutar : 0,
        alacak: fis.tur === "TAHSILAT" ? tutar : 0,
        aciklama: `${TUR_ADI[fis.tur]} ${fis.fisNo} — ${ODEME_SEKLI_ADI[fis.odemeSekli].toLowerCase()}`,
        olusturanId: kullaniciId,
      },
    })
  }

  if (eskiCariId && eskiCariId !== fis.cariId) await bakiyeyiHesapla(tx, eskiCariId)
  await bakiyeyiHesapla(tx, fis.cariId)
}

/**
 * Fişin kasaya yansıması. Çek/senet ve mahsupta kasa satırı YAZILMAZ:
 * çek kasaya ancak tahsil edildiğinde girer (Çek-Senet modülü), burada da
 * yazılsaydı aynı para iki kez sayılırdı.
 */
export async function kasaEtkisiniYaz(
  tx: Islem,
  fis: {
    id: number
    tur: TahsilatTur
    fisNo: string
    tarih: Date
    tutar: Prisma.Decimal | number
    odemeSekli: OdemeSekli
    kasaId: number | null
    cariId: number
    aciklama: string | null
    silindi: boolean
  },
  kullaniciId: number
) {
  const etkilenen = new Set<number>()

  const eskiler = await tx.kasaHareket.findMany({
    where: { tahsilatId: fis.id },
    select: { kasaId: true },
  })
  if (eskiler.length > 0) {
    await tx.kasaHareket.deleteMany({ where: { tahsilatId: fis.id } })
    eskiler.forEach((s) => etkilenen.add(s.kasaId))
  }

  if (!fis.silindi && kasaGerektirir(fis.odemeSekli) && fis.kasaId) {
    await tx.kasaHareket.create({
      data: {
        kasaId: fis.kasaId,
        tur: fis.tur === "TAHSILAT" ? "GIRIS" : "CIKIS",
        tarih: fis.tarih,
        tutar: fis.tutar,
        aciklama: `${TUR_ADI[fis.tur]} ${fis.fisNo}${fis.aciklama ? ` — ${fis.aciklama}` : ""}`,
        belgeNo: fis.fisNo,
        cariId: fis.cariId,
        tahsilatId: fis.id,
        olusturanId: kullaniciId,
      },
    })
    etkilenen.add(fis.kasaId)
  }

  for (const kasaId of etkilenen) await kasaBakiyeyiHesapla(tx, kasaId)
}

/**
 * Kabule bağlı fişlerin toplamına bakıp kartın "Tahsil Edildi" işaretini
 * günceller. İşaret elle de değiştirilebiliyor ama fiş girildikten sonra
 * kullanıcıyı ikinci bir tıklamaya zorlamak yanlış olurdu; fiş silinince de
 * aynı yerden geri alınıyor ki işaret gerçeği söylemeyi sürdürsün.
 *
 * Tediye (bize para çıkışı) toplamdan DÜŞÜLÜR: aynı kabulden müşteriye iade
 * yapıldıysa kart hâlâ tam tahsil edilmiş sayılmamalı.
 */
async function kabulOdendiGuncelle(tx: Islem, kabulId: number) {
  const kabul = await tx.kabul.findUnique({
    where: { id: kabulId },
    select: { id: true, genelToplam: true, odendi: true },
  })
  if (!kabul) return

  const gruplar = await tx.tahsilat.groupBy({
    by: ["tur"],
    where: { kabulId, silindi: false },
    _sum: { tutar: true },
  })
  const topla = (tur: TahsilatTur) =>
    Number((gruplar.find((g) => g.tur === tur)?._sum.tutar ?? 0).toString())

  const genelToplam = Number(kabul.genelToplam.toString())
  const net = topla("TAHSILAT") - topla("TEDIYE")
  // Kuruş yuvarlamaları yüzünden "0,004 TL kaldı" diye açık kalmasın.
  const odendi = genelToplam > 0 && net >= genelToplam - 0.005

  if (odendi !== kabul.odendi) {
    await tx.kabul.update({ where: { id: kabulId }, data: { odendi } })
  }
}

/**
 * Karta KALANINDAN FAZLA tahsilat girilmesini engeller.
 *
 * Bu denetim olmadığı için kartlar eksi kalana düşebiliyordu (7.000'lik karta
 * 5.000 alındıktan sonra tekrar 7.000 girilebiliyordu) — hem kalan sütunu
 * anlamsızlaşıyor hem cari avansa kayıyordu.
 *
 * Mevcut toplam transaction İÇİNDE okunuyor: iki kasiyer aynı anda fiş
 * girerse ikisi de eski kalanı görüp toplamı aşamasın.
 *
 * `haricTahsilatId` düzenleme için: fişin KENDİ eski tutarı "zaten tahsil
 * edilen"den düşülmezse 5.000'lik fişi 5.000 olarak kaydetmek bile
 * reddedilirdi.
 *
 * Yalnız TAHSILAT yönü kısıtlanır; TEDIYE (iade) kartın kalanını artırır,
 * onun tavanı yok.
 */
async function kabulKalaniniDenetle(
  tx: Islem,
  kabulId: number,
  tutar: number,
  haricTahsilatId?: number
) {
  const kabul = await tx.kabul.findUnique({
    where: { id: kabulId },
    select: { kabulNo: true, genelToplam: true },
  })
  if (!kabul) throw new BulunamadiHatasi()

  const gruplar = await tx.tahsilat.groupBy({
    by: ["tur"],
    where: {
      kabulId,
      silindi: false,
      ...(haricTahsilatId ? { id: { not: haricTahsilatId } } : {}),
    },
    _sum: { tutar: true },
  })
  const topla = (tur: TahsilatTur) =>
    Number((gruplar.find((g) => g.tur === tur)?._sum.tutar ?? 0).toString())

  const genelToplam = Number(kabul.genelToplam.toString())
  const kalan = genelToplam - (topla("TAHSILAT") - topla("TEDIYE"))

  // Kuruş yuvarlaması yüzünden "0,004 TL fazla" diye reddetmesin.
  if (tutar <= kalan + 0.005) return

  if (genelToplam <= 0.005) {
    throw new IsKuraliHatasi(
      `${kabul.kabulNo} kartının tutarı henüz oluşmadı. Önce kartın kalemlerini girin.`
    )
  }
  throw new IsKuraliHatasi(
    kalan <= 0.005
      ? `${kabul.kabulNo} kartının tamamı tahsil edilmiş. Bu karta yeni tahsilat girilemez.`
      : `${kabul.kabulNo} kartında kalan ${para(kalan)}. Bundan fazlası girilemez.`
  )
}


// ---------------------------------------------------------------------------
//  ÇEK / SENET ETKİSİ (adım 6.3)
// ---------------------------------------------------------------------------

/**
 * Çek veya senetle ödenen fiş, Çek-Senet modülünde OTOMATİK portföy kaydı açar.
 *
 * Neden otomatik: kâğıt fişten ayrı elle girilirse ya hiç girilmez (vade
 * listesinde görünmez, tahsil günü kaçar) ya da iki kez girilir. Fişin
 * kendisi zaten kâğıdın bütün bilgisini taşıyor.
 *
 * ÇİFT SAYMA YOK: otomatik kâğıt cariye YAZMAZ — cari satırını fiş yazdı.
 * (Kural cek-senet/actions.ts `cariEtkisiniYaz` içinde `tahsilatId` kontrolüyle
 * kurulu.) Kasaya da yazmaz; para kasaya kâğıt "tahsil edildi" olunca girer.
 *
 * Yön: TAHSILAT → ALINAN (müşteriden aldık), TEDIYE → VERILEN.
 * Otomatik kayıt ONAYLI doğar: fişi giren kişi tahsilat yetkisiyle zaten
 * kâğıdı kabul etmiş sayılır, ikinci onay ekranı gereksiz sürtünme olurdu.
 *
 * Kâğıt portföyden çıktıysa (tahsile verildi / tahsil edildi / ciro …) fiş
 * artık değiştirilemez: tutarı geriye dönük değiştirmek kasaya girmiş parayla
 * çelişirdi. Bu durumda kullanıcı önce Çek-Senet modülünden durumu geri alır.
 */
export async function cekSenetEtkisiniYaz(
  tx: Islem,
  fis: {
    id: number
    cariId: number
    tur: TahsilatTur
    fisNo: string
    tarih: Date
    tutar: Prisma.Decimal | number
    odemeSekli: OdemeSekli
    aciklama: string | null
    silindi: boolean
  },
  alanlar: {
    cekVadeTarihi?: string
    cekBelgeNo?: string
    cekBanka?: string
    cekBorclu?: string
  },
  kullaniciId: number,
  kullaniciKod: string
) {
  const mevcut = await tx.cekSenet.findUnique({ where: { tahsilatId: fis.id } })

  if (mevcut && mevcut.durum !== "PORTFOYDE") {
    throw new IsKuraliHatasi(
      `Bu fişin çeki (${mevcut.portfoyNo}) portföyden çıkmış. Önce Çek-Senet modülünden durumunu geri alın.`
    )
  }

  const kagitli = kagitGerektirir(fis.odemeSekli) && !fis.silindi

  // Ödeme şekli çekten nakde çevrildi ya da fiş silindi → kâğıt da kalkar.
  if (!kagitli) {
    if (mevcut && !mevcut.silindi) {
      await tx.cekSenet.update({
        where: { id: mevcut.id },
        data: { silindi: true, silmeTarihi: new Date(), guncelleyenId: kullaniciId },
      })
      await tx.cekSenetHareket.create({
        data: {
          cekSenetId: mevcut.id,
          oncekiDurum: mevcut.durum,
          yeniDurum: mevcut.durum,
          aciklama: `${fis.fisNo} fişi değiştiği için kayıt kapatıldı`,
          kullaniciId,
          kullaniciKod,
        },
      })
    }
    return
  }

  const veri = {
    tur: (fis.odemeSekli === "SENET" ? "SENET" : "CEK") as "CEK" | "SENET",
    yon: (fis.tur === "TAHSILAT" ? "ALINAN" : "VERILEN") as "ALINAN" | "VERILEN",
    cariId: fis.cariId,
    tutar: fis.tutar,
    // Vade şemada zorunlu; yine de kâğıt vadesiz kalmasın diye fiş tarihine düşer.
    vadeTarihi: alanlar.cekVadeTarihi ? new Date(alanlar.cekVadeTarihi) : fis.tarih,
    kesideTarihi: fis.tarih,
    belgeNo: alanlar.cekBelgeNo ?? null,
    banka: alanlar.cekBanka ?? null,
    borclu: alanlar.cekBorclu ?? null,
    aciklama: `${TUR_ADI[fis.tur]} ${fis.fisNo} ile alınan kıymetli evrak${
      fis.aciklama ? ` — ${fis.aciklama}` : ""
    }`,
    onayDurumu: "ONAYLANDI" as const,
    onaylayanId: kullaniciId,
    onayTarihi: new Date(),
    silindi: false,
    silmeTarihi: null,
    guncelleyenId: kullaniciId,
  }

  if (mevcut) {
    await tx.cekSenet.update({ where: { id: mevcut.id }, data: veri })
    await tx.cekSenetHareket.create({
      data: {
        cekSenetId: mevcut.id,
        oncekiDurum: mevcut.durum,
        yeniDurum: "PORTFOYDE",
        aciklama: `${fis.fisNo} fişinden güncellendi`,
        cariId: fis.cariId,
        kullaniciId,
        kullaniciKod,
      },
    })
    return
  }

  const portfoyNo = await siradakiNumara(tx, "CEK_SENET", {
    varsayilanOnEk: "CS",
    basamak: 5,
  })
  const kagit = await tx.cekSenet.create({
    data: { ...veri, portfoyNo, tahsilatId: fis.id, olusturanId: kullaniciId },
  })
  await tx.cekSenetHareket.create({
    data: {
      cekSenetId: kagit.id,
      yeniDurum: "PORTFOYDE",
      aciklama: `${fis.fisNo} fişinden otomatik açıldı`,
      cariId: fis.cariId,
      kullaniciId,
      kullaniciKod,
    },
  })
}

// ---------------------------------------------------------------------------
//  KAYIT
// ---------------------------------------------------------------------------

export async function tahsilatKaydet(
  _oncekiDurum: TahsilatFormDurumu,
  form: FormData
): Promise<TahsilatFormDurumu> {
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

  const cozum = tahsilatSemasi.safeParse(Object.fromEntries(form))
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
      const cari = await tx.cari.findUnique({
        where: { id: v.cariId },
        select: { id: true, kod: true, unvan: true, silindi: true },
      })
      if (!cari || cari.silindi) throw new IsKuraliHatasi("Seçilen cari bulunamadı.")

      // Kasa yalnız kasalı ödeme şekillerinde bağlanır; çek/senet/mahsupta
      // form kasa göndermiş olsa bile yok sayılır.
      const kasaId = kasaGerektirir(v.odemeSekli) ? (v.kasaId ?? null) : null
      if (kasaId) {
        const kasa = await tx.kasa.findUnique({
          where: { id: kasaId },
          select: { id: true, aktif: true, silindi: true },
        })
        if (!kasa || kasa.silindi) throw new IsKuraliHatasi("Seçilen kasa bulunamadı.")
        if (!kasa.aktif) throw new IsKuraliHatasi("Pasif kasaya işlem yapılamaz.")
      }

      // Karta bağlı tahsilat, kartın kalanını aşamaz (düzenlemede fişin kendi
      // eski tutarı hesaptan düşülür).
      if (v.kabulId && v.tur === "TAHSILAT") {
        await kabulKalaniniDenetle(tx, v.kabulId, v.tutar, duzenleme ? id : undefined)
      }

      const fisNo = v.fisNo ?? (duzenleme ? undefined : await fisNumarasi(tx, v.tur))
      if (fisNo) {
        const cakisan = await tx.tahsilat.findFirst({
          where: { tur: v.tur, fisNo, ...(duzenleme ? { NOT: { id } } : {}) },
          select: { id: true },
        })
        if (cakisan) throw new FisCakismasi()
      }

      const alanlar = {
        cariId: v.cariId,
        tur: v.tur,
        tarih: new Date(v.tarih),
        tutar: v.tutar,
        odemeSekli: v.odemeSekli,
        kasaId,
        kabulId: v.kabulId ?? null,
        aciklama: v.aciklama ?? null,
        // Sanal POS placeholder: gerçek entegrasyon yok, dekonttan elle girilir.
        // Kredi kartı dışındaki şekillerde temizleniyor ki fiş şekli
        // değiştirilince eski kart bilgisi kartta asılı kalmasın.
        posBanka: v.odemeSekli === "KREDI_KARTI" ? (v.posBanka ?? null) : null,
        posKartSahibi: v.odemeSekli === "KREDI_KARTI" ? (v.posKartSahibi ?? null) : null,
        posSon4: v.odemeSekli === "KREDI_KARTI" ? (v.posSon4 ?? null) : null,
        posProvizyon: v.odemeSekli === "KREDI_KARTI" ? (v.posProvizyon ?? null) : null,
        posTaksit: v.odemeSekli === "KREDI_KARTI" ? (v.posTaksit ?? null) : null,
      }

      const kagitAlanlari = {
        cekVadeTarihi: v.cekVadeTarihi,
        cekBelgeNo: v.cekBelgeNo,
        cekBanka: v.cekBanka,
        cekBorclu: v.cekBorclu,
      }

      if (duzenleme) {
        const onceki = await tx.tahsilat.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()

        const kayit = await tx.tahsilat.update({
          where: { id },
          data: { ...alanlar, ...(fisNo ? { fisNo } : {}) },
        })

        await cariEtkisiniYaz(tx, kayit, kullanici.id, onceki.cariId)
        await kasaEtkisiniYaz(tx, kayit, kullanici.id)
        await cekSenetEtkisiniYaz(tx, kayit, kagitAlanlari, kullanici.id, kullanici.kod)
        // Kabul bağı değişmiş olabilir; eskisi de yenisi de tazelenmeli.
        for (const bagliKabul of new Set([onceki.kabulId, kayit.kabulId].filter(Boolean))) {
          await kabulOdendiGuncelle(tx, bagliKabul as number)
        }

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "tahsilatlar",
          kayitId: id,
          aciklama: `${kayit.fisNo} — ${TUR_ADI[kayit.tur]} · ${cari.unvan}`,
          eskiDeger: onceki,
          yeniDeger: kayit,
        })
        return id
      }

      const kayit = await tx.tahsilat.create({
        data: { ...alanlar, fisNo: fisNo!, olusturanId: kullanici.id },
      })

      await cariEtkisiniYaz(tx, kayit, kullanici.id)
      await kasaEtkisiniYaz(tx, kayit, kullanici.id)
      await cekSenetEtkisiniYaz(tx, kayit, kagitAlanlari, kullanici.id, kullanici.kod)
      if (kayit.kabulId) await kabulOdendiGuncelle(tx, kayit.kabulId)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "tahsilatlar",
        kayitId: kayit.id,
        aciklama: `${kayit.fisNo} — ${TUR_ADI[kayit.tur]} · ${cari.unvan}`,
        yeniDeger: kayit,
      })
      return kayit.id
    })
  } catch (hata) {
    if (hata instanceof FisCakismasi) {
      return { hata: hata.message, alanHatalari: { fisNo: hata.message } }
    }
    if (hata instanceof BulunamadiHatasi) return { hata: "Kayıt bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Tahsilat kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/tahsilat")
  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  revalidatePath("/servis/kabul")
  revalidatePath("/cek-senet")
  redirect(`/tahsilat/${hedefId}?kaydedildi=1`)
}

// ---------------------------------------------------------------------------
//  SİLME / GERİ ALMA
// ---------------------------------------------------------------------------

/**
 * Bir tahsilat fişinin cari + kasa + çek/senet etkisini uygular (`sil=false`)
 * veya geri alır (`sil=true`). Verilen `tx` içinde çalışır, kendi transaction'ını
 * AÇMAZ — çağıran sarmalar. `tahsilatSilmeDurumu` ve PERAKENDE evrak iptali
 * (`evrakIptalEt`) bu tek yoldan geçer ki "yarım silinmiş" kayıt oluşmasın.
 */
export async function tahsilatEtkisiniUygula(
  tx: Islem,
  id: number,
  sil: boolean,
  kullanici: { id: number; kod: string }
) {
  const fis = await tx.tahsilat.findUnique({ where: { id } })
  if (!fis) throw new BulunamadiHatasi()

  const kagit = await tx.cekSenet.findUnique({ where: { tahsilatId: id } })

  const guncel = await tx.tahsilat.update({
    where: { id },
    data: { silindi: sil, silmeTarihi: sil ? new Date() : null },
  })

  // Silinen fiş ne cariye ne kasaya işlemeli; geri alınınca ikisi de
  // yeniden yazılır. Tek yol kullanıldığı için "yarım silinmiş" kayıt olmaz.
  await cariEtkisiniYaz(tx, guncel, kullanici.id)
  await kasaEtkisiniYaz(tx, guncel, kullanici.id)
  // Geri alınan fişte kâğıt da yeniden doğar; kendi alanları kayıtta
  // durmadığı için mevcut çekten okunur (varsa güncellenir, yoksa açılır).
  await cekSenetEtkisiniYaz(
    tx,
    guncel,
    {
      cekVadeTarihi: kagit?.vadeTarihi.toISOString().slice(0, 10),
      cekBelgeNo: kagit?.belgeNo ?? undefined,
      cekBanka: kagit?.banka ?? undefined,
      cekBorclu: kagit?.borclu ?? undefined,
    },
    kullanici.id,
    kullanici.kod
  )
  if (guncel.kabulId) await kabulOdendiGuncelle(tx, guncel.kabulId)

  await logKaydet({
    islem: sil ? "SIL" : "GERI_AL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "tahsilatlar",
    kayitId: id,
    aciklama: `${fis.fisNo} — ${TUR_ADI[fis.tur]}`,
  })

  return fis
}

export async function tahsilatSilmeDurumu(id: number, sil: boolean): Promise<TahsilatFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tahsilatEtkisiniUygula(tx, id, sil, kullanici)
    })
  } catch (hata) {
    if (hata instanceof BulunamadiHatasi) return { hata: "Kayıt bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Tahsilat silinemedi:", hata)
    return { hata: "İşlem tamamlanamadı." }
  }

  revalidatePath("/tahsilat")
  revalidatePath(`/tahsilat/${id}`)
  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  revalidatePath("/servis/kabul")
  return { basarili: sil ? "Fiş silindi." : "Fiş geri alındı." }
}

/** Formdaki cari araması — bakiyeyi de döndürür ki tahsilat girerken görünsün. */
export async function tahsilatCariAra(q: string) {
  await yetkiliOturum("tahsilat", "gor")
  const arama = q.trim()
  if (arama.length < 2) return []
  const kayitlar = await prisma.cari.findMany({
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
    select: { id: true, kod: true, unvan: true, bakiye: true, karaListe: true, karaListeNedeni: true },
  })
  return kayitlar.map((c) => ({ ...c, bakiye: Number(c.bakiye.toString()) }))
}

// ---------------------------------------------------------------------------
//  HIZLI TAHSİLAT (adım 6.2)
// ---------------------------------------------------------------------------

export type HizliTahsilatDurumu = TahsilatFormDurumu & {
  /** Kaydedilen fişin numarası — modal kapanmadan kullanıcıya gösteriliyor. */
  fisNo?: string
  kalan?: number
}

/**
 * Kabul kartından tek tıkla tahsilat.
 *
 * Ayrı sayfaya gidip cari aramaya gerek kalmasın diye ayrı bir giriş noktası,
 * ama fişin kendisi normal tahsilatla AYNI: aynı numaratör, aynı cari/kasa
 * yazma fonksiyonları. İkinci bir kayıt yolu yazılsaydı bakiye hesabı
 * ikiye ayrılır, biri düzeltilip diğeri unutulurdu.
 *
 * `redirect` YOK: modal içinde kalınıyor, sonuç metinle dönüyor.
 */
export async function hizliTahsilatKaydet(
  _oncekiDurum: HizliTahsilatDurumu,
  form: FormData
): Promise<HizliTahsilatDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("tahsilat", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = hizliTahsilatSemasi.safeParse(Object.fromEntries(form))
  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }
  const v = cozum.data

  let sonuc: { fisNo: string; kalan: number }
  try {
    sonuc = await prisma.$transaction(async (tx) => {
      const kabul = await tx.kabul.findUnique({
        where: { id: v.kabulId },
        select: {
          id: true,
          kabulNo: true,
          cariId: true,
          genelToplam: true,
          silindi: true,
          cari: { select: { unvan: true, silindi: true } },
        },
      })
      if (!kabul) throw new BulunamadiHatasi()
      if (kabul.silindi) throw new IsKuraliHatasi("Silinmiş kabul kartına tahsilat girilemez.")
      if (kabul.cari.silindi) throw new IsKuraliHatasi("Kartın carisi silinmiş.")

      const kasaId = kasaGerektirir(v.odemeSekli) ? (v.kasaId ?? null) : null
      if (kasaId) {
        const kasa = await tx.kasa.findUnique({
          where: { id: kasaId },
          select: { id: true, aktif: true, silindi: true },
        })
        if (!kasa || kasa.silindi) throw new IsKuraliHatasi("Seçilen kasa bulunamadı.")
        if (!kasa.aktif) throw new IsKuraliHatasi("Pasif kasaya işlem yapılamaz.")
      }

      await kabulKalaniniDenetle(tx, kabul.id, v.tutar)

      const fisNo = await fisNumarasi(tx, "TAHSILAT")

      const kayit = await tx.tahsilat.create({
        data: {
          cariId: kabul.cariId,
          tur: "TAHSILAT",
          fisNo,
          tarih: new Date(v.tarih),
          tutar: v.tutar,
          odemeSekli: v.odemeSekli,
          kasaId,
          kabulId: kabul.id,
          posBanka: v.odemeSekli === "KREDI_KARTI" ? (v.posBanka ?? null) : null,
          posKartSahibi: v.odemeSekli === "KREDI_KARTI" ? (v.posKartSahibi ?? null) : null,
          posSon4: v.odemeSekli === "KREDI_KARTI" ? (v.posSon4 ?? null) : null,
          posProvizyon: v.odemeSekli === "KREDI_KARTI" ? (v.posProvizyon ?? null) : null,
          posTaksit: v.odemeSekli === "KREDI_KARTI" ? (v.posTaksit ?? null) : null,
          // Hangi iş emrinden geldiği ekstrede de okunsun diye kabul no
          // açıklamanın başına yazılıyor.
          aciklama: `${kabul.kabulNo} hızlı tahsilat${v.aciklama ? ` — ${v.aciklama}` : ""}`,
          olusturanId: kullanici.id,
        },
      })

      await cariEtkisiniYaz(tx, kayit, kullanici.id)
      await kasaEtkisiniYaz(tx, kayit, kullanici.id)
      await cekSenetEtkisiniYaz(
        tx,
        kayit,
        {
          cekVadeTarihi: v.cekVadeTarihi,
          cekBelgeNo: v.cekBelgeNo,
          cekBanka: v.cekBanka,
          cekBorclu: v.cekBorclu,
        },
        kullanici.id,
        kullanici.kod
      )
      await kabulOdendiGuncelle(tx, kabul.id)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "tahsilatlar",
        kayitId: kayit.id,
        aciklama: `${kayit.fisNo} — hızlı tahsilat · ${kabul.kabulNo} · ${kabul.cari.unvan}`,
        yeniDeger: kayit,
      })

      const gruplar = await tx.tahsilat.groupBy({
        by: ["tur"],
        where: { kabulId: kabul.id, silindi: false },
        _sum: { tutar: true },
      })
      const topla = (tur: TahsilatTur) =>
        Number((gruplar.find((g) => g.tur === tur)?._sum.tutar ?? 0).toString())
      const kalan = Number(kabul.genelToplam.toString()) - (topla("TAHSILAT") - topla("TEDIYE"))

      return { fisNo: kayit.fisNo, kalan }
    })
  } catch (hata) {
    if (hata instanceof FisCakismasi) return { hata: hata.message }
    if (hata instanceof BulunamadiHatasi) return { hata: "Kabul kartı bulunamadı." }
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message }
    console.error("Hızlı tahsilat kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/servis/kabul")
  revalidatePath(`/servis/kabul/${v.kabulId}`)
  revalidatePath("/servis/acik")
  revalidatePath("/servis/kapali")
  revalidatePath("/tahsilat")
  revalidatePath("/kasa")
  revalidatePath("/kasa/defter")
  revalidatePath("/cek-senet")

  return {
    basarili: `${sonuc.fisNo} numaralı tahsilat fişi oluşturuldu.`,
    fisNo: sonuc.fisNo,
    kalan: sonuc.kalan,
  }
}
