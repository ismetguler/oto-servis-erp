import "server-only"

import { KOPYALANACAK_ALANLAR } from "./sema"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * CARİ BİRLEŞTİRME — okuma tarafı (önizleme).
 *
 * Birleştirme geri alınamıyor, bu yüzden kullanıcı düğmeye basmadan ÖNCE
 * tam olarak ne olacağını görmeli: hangi tablodan kaç satır taşınacak,
 * hedefin hangi boş alanları dolacak, bakiye ne olacak, hangi ince durumlar
 * (kendi kendine plasiyer, aynı kabulde iki kez usta) düzeltilecek.
 *
 * Buradaki sayımlar `silindi` filtresi UYGULAMAZ. Soft delete edilmiş satır
 * da kaynağın id'sine bakıyor; taşınmazsa silinmiş bir cariyi işaret eden
 * kayıt kalır ve "silinenleri geri al" ekranı tutarsız veri açar.
 */

export const CARI_SECIMI = {
  id: true,
  kod: true,
  unvan: true,
  turu: true,
  tipi: true,
  vergiNo: true,
  vergiDair: true,
  yetkili: true,
  yetkiliTelefon: true,
  telefon: true,
  gsm: true,
  email: true,
  adres: true,
  il: true,
  ilce: true,
  banka: true,
  bankaSube: true,
  hesapNo: true,
  ibanNo: true,
  ozelKod: true,
  musteriSinifi: true,
  plasiyerId: true,
  notu: true,
  bakiye: true,
  acilisBakiye: true,
  acilisTuru: true,
  karaListe: true,
  karaListeNedeni: true,
  aktif: true,
  silindi: true,
  olusturmaTarihi: true,
} as const

export type BirlestirmeCarisi = Awaited<ReturnType<typeof cariGetir>>

export async function cariGetir(id: number) {
  return prisma.cari.findUnique({ where: { id }, select: CARI_SECIMI })
}

/** Ekranın üstündeki arama kutusu — kaynak/hedef seçimi için. */
export async function cariAra(q: string) {
  const arama = q.trim()
  if (!arama) return []
  return prisma.cari.findMany({
    where: {
      silindi: false,
      OR: aramaKosullari<Prisma.CariWhereInput>(
        ["kod", "unvan", "vergiNo", "gsm", "telefon"],
        arama
      ),
    },
    orderBy: { unvan: "asc" },
    take: 25,
    select: {
      id: true,
      kod: true,
      unvan: true,
      turu: true,
      vergiNo: true,
      gsm: true,
      telefon: true,
      bakiye: true,
    },
  })
}

export type TasinacakKalem = {
  anahtar: string
  etiket: string
  adet: number
}

export type KopyalanacakDeger = {
  alan: string
  etiket: string
  deger: string
}

export type Onizleme = {
  kalemler: TasinacakKalem[]
  toplamKayit: number
  kopyalanacak: KopyalanacakDeger[]
  notEklenecek: boolean
  yeniBakiye: number
  yeniAcilisNet: number
  hedefKaraListeyeGirecek: boolean
  kendiPlasiyeriOlacakti: boolean
  cakisanKabulPersoneli: number
}

/**
 * Birleştirmede ne olacağının tam dökümü.
 *
 * `actions.ts` ile aynı kuralları uyguluyor — ekranda gösterilen sayı ile
 * gerçekte taşınan satır sayısı ayrışırsa kullanıcı yanlış şeye onay verir.
 */
export async function birlestirmeOnizlemesi(
  kaynak: NonNullable<BirlestirmeCarisi>,
  hedef: NonNullable<BirlestirmeCarisi>
): Promise<Onizleme> {
  const kaynakId = kaynak.id
  const hedefId = hedef.id

  const [
    arac,
    kabul,
    garantiKabul,
    kabulPersonel,
    kalemPersonel,
    evrak,
    tahsilat,
    cariHareket,
    kasaHareket,
    cekSenet,
    ciroCek,
    cekHareket,
    karaListe,
    plasiyerBagi,
    cakisanKabulPersoneli,
    kaynakAcilis,
    hedefAcilis,
    hedefAcikKaraListe,
  ] = await Promise.all([
    prisma.arac.count({ where: { cariId: kaynakId } }),
    prisma.kabul.count({ where: { cariId: kaynakId } }),
    prisma.kabul.count({ where: { garantiVerenId: kaynakId } }),
    prisma.kabulPersonel.count({ where: { personelId: kaynakId } }),
    prisma.kabulKalem.count({ where: { personelId: kaynakId } }),
    prisma.evrak.count({ where: { cariId: kaynakId } }),
    prisma.tahsilat.count({ where: { cariId: kaynakId } }),
    // Açılış hareketi bu sayıya girmiyor: birleşmede taşınmıyor, iki kartın
    // açılışı TEK satırda toplanıyor (aşağıdaki "yeni açılış" satırı).
    prisma.cariHareket.count({ where: { cariId: kaynakId, tur: { not: "ACILIS" } } }),
    prisma.kasaHareket.count({ where: { cariId: kaynakId } }),
    prisma.cekSenet.count({ where: { cariId: kaynakId } }),
    prisma.cekSenet.count({ where: { ciroCariId: kaynakId } }),
    prisma.cekSenetHareket.count({ where: { cariId: kaynakId } }),
    prisma.karaListeKaydi.count({ where: { cariId: kaynakId } }),
    prisma.cari.count({ where: { plasiyerId: kaynakId } }),
    // Aynı kabulde hem kaynak hem hedef usta olarak yazılıysa taşıma
    // @@unique([kabulId, personelId]) kısıtına takılır: o satırlar siliniyor.
    prisma.kabulPersonel.count({
      where: {
        personelId: kaynakId,
        kabul: { personeller: { some: { personelId: hedefId } } },
      },
    }),
    acilisNeti(kaynakId),
    acilisNeti(hedefId),
    prisma.karaListeKaydi.count({
      where: { cariId: hedefId, kaldirmaTarihi: null },
    }),
  ])

  const kalemler: TasinacakKalem[] = [
    { anahtar: "arac", etiket: "Araç kartı", adet: arac },
    { anahtar: "kabul", etiket: "Araç kabul (iş emri)", adet: kabul },
    { anahtar: "garantiKabul", etiket: "Garantisini üstlendiği kabul", adet: garantiKabul },
    { anahtar: "kabulPersonel", etiket: "Kabulde usta ataması", adet: kabulPersonel },
    { anahtar: "kalemPersonel", etiket: "Kalem satırında usta", adet: kalemPersonel },
    { anahtar: "evrak", etiket: "Evrak / fatura", adet: evrak },
    { anahtar: "tahsilat", etiket: "Tahsilat / ödeme", adet: tahsilat },
    { anahtar: "cariHareket", etiket: "Cari hareketi (ekstre)", adet: cariHareket },
    { anahtar: "kasaHareket", etiket: "Kasa hareketi", adet: kasaHareket },
    { anahtar: "cekSenet", etiket: "Çek / senet", adet: cekSenet },
    { anahtar: "ciroCek", etiket: "Ciro edilen çek / senet", adet: ciroCek },
    { anahtar: "cekHareket", etiket: "Çek-senet durum hareketi", adet: cekHareket },
    { anahtar: "karaListe", etiket: "Kara liste geçmişi", adet: karaListe },
    { anahtar: "plasiyerBagi", etiket: "Sorumlusu olduğu cari", adet: plasiyerBagi },
  ]

  const kopyalanacak: KopyalanacakDeger[] = []
  for (const [alan, etiket] of KOPYALANACAK_ALANLAR) {
    if (!bos(hedef[alan])) continue
    const deger = kaynak[alan]
    if (bos(deger)) continue
    // Kaynak, hedefin plasiyeri olarak yazılıysa kopyalamak hedefi kendi
    // plasiyeri yapardı — o bağ birleşmede zaten kopuyor.
    if (alan === "plasiyerId" && deger === hedefId) continue
    kopyalanacak.push({
      alan,
      etiket,
      deger: alan === "plasiyerId" ? `#${deger}` : String(deger),
    })
  }

  // Plasiyer id'si ekranda numara olarak anlamsız — adını yazıyoruz.
  await adlariCoz(kopyalanacak, kaynak)

  return {
    kalemler,
    toplamKayit: kalemler.reduce((t, k) => t + k.adet, 0),
    kopyalanacak,
    notEklenecek: !bos(kaynak.notu) && !bos(hedef.notu),
    yeniBakiye: sayi(kaynak.bakiye) + sayi(hedef.bakiye),
    yeniAcilisNet: kaynakAcilis + hedefAcilis,
    hedefKaraListeyeGirecek:
      !hedef.karaListe &&
      hedefAcikKaraListe === 0 &&
      (await prisma.karaListeKaydi.count({
        where: { cariId: kaynakId, kaldirmaTarihi: null },
      })) > 0,
    kendiPlasiyeriOlacakti: hedef.plasiyerId === kaynakId,
    cakisanKabulPersoneli,
  }
}

/** Açılış hareketinin net etkisi: (+) borç, (−) alacak. */
async function acilisNeti(cariId: number) {
  const toplam = await prisma.cariHareket.aggregate({
    where: { cariId, tur: "ACILIS", silindi: false },
    _sum: { borc: true, alacak: true },
  })
  return sayi(toplam._sum.borc) - sayi(toplam._sum.alacak)
}

async function adlariCoz(
  liste: KopyalanacakDeger[],
  kaynak: NonNullable<BirlestirmeCarisi>
) {
  const plasiyer = liste.find((k) => k.alan === "plasiyerId")
  if (plasiyer && kaynak.plasiyerId) {
    const c = await prisma.cari.findUnique({
      where: { id: kaynak.plasiyerId },
      select: { kod: true, unvan: true },
    })
    if (c) plasiyer.deger = `${c.kod} — ${c.unvan}`
  }
}

function bos(deger: unknown) {
  return deger === null || deger === undefined || String(deger).trim() === ""
}

function sayi(deger: unknown) {
  return deger === null || deger === undefined ? 0 : Number(String(deger))
}
