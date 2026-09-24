import "server-only"

import type { CariBaslangic } from "@/components/cari/cari-formu"
import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { gunBasi, gunSonu } from "@/lib/bicim"
import { prisma } from "@/lib/prisma"

/**
 * Cari kaydını forma uygun hâle getirip döndürür.
 *
 * Prisma'nın Decimal nesnesi istemci bileşenine olduğu gibi geçemez
 * (serialize edilemez). Bu yüzden tutarlar burada metne çevriliyor —
 * çevrimi form tarafında yapmak sayı hatası riskini ekrana taşırdı.
 */
export async function cariFormVerisi(id: number): Promise<CariBaslangic | null> {
  const c = await prisma.cari.findUnique({ where: { id } })
  if (!c || c.silindi) return null

  return {
    id: c.id,
    kod: c.kod,
    unvan: c.unvan,
    turu: c.turu,
    tipi: c.tipi,
    vergiNo: c.vergiNo,
    vergiDair: c.vergiDair,
    yetkili: c.yetkili,
    yetkiliTelefon: c.yetkiliTelefon,
    telefon: c.telefon,
    gsm: c.gsm,
    email: c.email,
    adres: c.adres,
    il: c.il,
    ilce: c.ilce,
    banka: c.banka,
    bankaSube: c.bankaSube,
    hesapNo: c.hesapNo,
    ibanNo: c.ibanNo,
    paraBirimi: c.paraBirimi,
    hesapLimiti: c.hesapLimiti.toString(),
    riskLimiti: c.riskLimiti.toString(),
    vadeGun: c.vadeGun,
    acilisBakiye: c.acilisBakiye.toString(),
    acilisTuru: c.acilisTuru,
    ozelKod: c.ozelKod,
    plasiyerId: c.plasiyerId,
    musteriSinifi: c.musteriSinifi,
    notu: c.notu,
    gorevi: c.gorevi,
    // `date` girdisi yalnızca `yyyy-aa-gg` biçimini kabul ediyor; tarihler
    // UTC gece yarısı olarak saklandığı için ISO metnin ilk 10 hanesi
    // yerel saat kaymasından etkilenmeden doğru günü verir.
    iseGirisTarihi: gunMetni(c.iseGirisTarihi),
    istenCikisTarihi: gunMetni(c.istenCikisTarihi),
    dogumTarihi: gunMetni(c.dogumTarihi),
    sgkNo: c.sgkNo,
    maas: c.maas.toString(),
    karaListe: c.karaListe,
    karaListeNedeni: c.karaListeNedeni,
    aktif: c.aktif,
  }
}

/** Tarihi HTML `date` girdisinin beklediği `yyyy-aa-gg` metnine çevirir. */
function gunMetni(deger: Date | null): string | null {
  return deger ? deger.toISOString().slice(0, 10) : null
}

/**
 * Plasiyer seçenekleri. Selpar'da personel ayrı tablo değil, cari tablosunda
 * `turu = PERSONEL` ile ayrılıyor; biz de aynı yapıyı koruduk.
 */
export function plasiyerleriGetir(dahilId?: number | null) {
  return prisma.cari.findMany({
    where: {
      turu: "PERSONEL",
      silindi: false,
      ...(dahilId ? { OR: [{ aktif: true }, { id: dahilId }] } : { aktif: true }),
    },
    orderBy: { unvan: "asc" },
    select: { id: true, unvan: true },
  })
}

/**
 * Liste filtresinin açılır kutuları. Formdan farklı olarak PASİF kayıtlar da
 * dönüyor: pasife alınmış bir plasiyere bağlı eski cariler hâlâ var ve o
 * filtre seçeneği listeden düşerse onlara erişilemez hâle gelirdi.
 */
export async function filtreSecenekleriGetir() {
  const plasiyerler = await prisma.cari.findMany({
    where: { turu: "PERSONEL", silindi: false },
    orderBy: { unvan: "asc" },
    select: { id: true, unvan: true },
  })
  return { plasiyerler }
}

/** Cari listesinin adres çubuğundan gelen filtreleri. */
export type CariFiltreleri = {
  q?: string
  tur?: string
  durum?: string
  plasiyer?: string
}

/**
 * Liste filtresini tek yerde kuruyoruz: aynı koşulu hem ekran, hem dışa
 * aktarma, hem de sayfa sayacı kullanıyor. Ayrı ayrı yazılsaydı ekranda
 * görünen liste ile inen Excel dosyası birbirini tutmayabilirdi.
 */
export function cariListeKosulu({
  q = "",
  tur = "",
  durum = "aktif",
  plasiyer = "",
}: CariFiltreleri): Prisma.CariWhereInput {
  const arama = q.trim()

  return {
    silindi: durum === "silinen",
    ...(tur ? { turu: tur as Prisma.CariWhereInput["turu"] } : {}),
    // "__yok__": plasiyeri doldurulmamış kartları ayıklamak için — eksik
    // veriyi bulmanın tek yolu bu, boş seçim "tümü" anlamına geliyor.
    ...(plasiyer === "__yok__"
      ? { plasiyerId: null }
      : plasiyer
        ? { plasiyerId: Number(plasiyer) }
        : {}),
    ...(durum === "aktif" ? { aktif: true } : {}),
    ...(durum === "pasif" ? { aktif: false } : {}),
    ...(durum === "karaliste" ? { karaListe: true } : {}),
    ...(durum === "borclu" ? { NOT: { bakiye: 0 } } : {}),
    // Selpar'daki "Bugün Açılan Cariler" raporu: ayrı ekran açmak yerine
    // listenin bir durumu — aynı tablo, aynı sütunlar, aynı dışa aktarma.
    ...(durum === "bugun"
      ? { olusturmaTarihi: { gte: gunBasi(), lte: gunSonu() }, aktif: true }
      : {}),
    ...(arama
      ? {
          OR: aramaKosullari<Prisma.CariWhereInput>(
            ["unvan", "kod", "vergiNo", "telefon", "gsm", "yetkili"],
            arama
          ),
        }
      : {}),
  }
}

/** Filtreleri adres çubuğu metnine çevirir (dışa aktarma linki için). */
export function cariFiltreSorgusu(f: CariFiltreleri): string {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.tur) p.set("tur", f.tur)
  if (f.durum && f.durum !== "aktif") p.set("durum", f.durum)
  if (f.plasiyer) p.set("plasiyer", f.plasiyer)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}
