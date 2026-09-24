"use client"

import { usePathname, useSearchParams } from "next/navigation"

/**
 * RAPORLAR — KÂĞITTAKİ DÖNEM SATIRI
 *
 * Ekranda görünmez (`yazdirma-sadece`), yalnız baskıda çıkar.
 *
 * Neden istemci bileşeni: seçilen aralık yalnız URL'de var, ama filtre
 * formunun kendisi her rapor sayfasında `yazdirma-disi` bir sarmalın
 * içinde — display:none olan bir ögenin çocuğu baskıda geri getirilemez.
 * Bu yüzden bandı sarmalın DIŞINDA, `rapor/layout.tsx` içinden basıyoruz;
 * aralığı da sayfadan prop olarak alamayacağımız için URL'den okuyoruz
 * (33 rapor sayfasına ayrı ayrı satır eklemek yerine tek yer).
 *
 * Varsayılan aralık `rapor/veri.ts`teki `varsayilanRaporAraligi` ile aynı
 * (ay başı → bugün); o dosya prisma çektiği için buraya import edilemedi,
 * beş satırlık hesap tekrarlandı — ikisi birlikte değişmeli.
 */
export function BaskiDonemBandi({
  /**
   * Raporlar grubunda her sayfa bir donem raporu, aralik yoksa varsayilan
   * (ay basi -> bugun) basiliyor. Personel grubunda ise ayni duzeni liste ve
   * kart ekranlari da paylasiyor; oralarda "Donem: ..." satiri yaniltici
   * olurdu. Bu bayrak acikken band yalnizca adres cubugunda gercekten bir
   * donem varsa cikiyor.
   */
  yalnizVarsa = false,
}: { yalnizVarsa?: boolean } = {}) {
  const sp = useSearchParams()
  const yol = usePathname()

  // Yaşlandırma ve Ödemesi Geçenler tarih ARALIĞI değil tek "analiz
  // tarihi" (asOf) kullanıyor — bkz. HAFIZA 69.3.
  const asOf = sp.get("asOf")
  if (asOf) {
    return (
      <div className="yazdirma-sadece px-4 pt-1 text-[0.75rem]">
        {bicimle(asOf)} tarihi itibarıyla
      </div>
    )
  }

  // Mesai ekranlari araligi degil tek bir ay tasiyor (`ay=2026-09`).
  const ay = sp.get("ay")
  if (ay) {
    return <div className="yazdirma-sadece px-4 pt-1 text-[0.75rem]">Dönem: {ayBicimle(ay)}</div>
  }

  // Personel grubunun uc donem raporu adres cubugu bos gelse de her zaman bir
  // donem gosteriyor (`komisyon/veri.ts` -> `varsayilanDonem`: ay basi -> AY
  // SONU). Liste ve kart ekranlarinda ise donem kavrami yok.
  const donemliPersonelRaporu = DONEMLI_PERSONEL_YOLLARI.includes(yol)
  if (yalnizVarsa && !donemliPersonelRaporu && !sp.get("bas") && !sp.get("bit")) return null

  const bugun = new Date()
  const ayBasi = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
  const aySonu = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0)
  const bas = sp.get("bas") || isoGun(ayBasi)
  const bit = sp.get("bit") || isoGun(donemliPersonelRaporu ? aySonu : bugun)

  return (
    <div className="yazdirma-sadece px-4 pt-1 text-[0.75rem]">
      Dönem: {bicimle(bas)} — {bicimle(bit)}
    </div>
  )
}

/** Adres cubugunda donem olmasa da varsayilan donemle calisan personel raporlari. */
const DONEMLI_PERSONEL_YOLLARI = ["/personel/satis-tahsilat"]

function isoGun(g: Date) {
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(
    g.getDate()
  ).padStart(2, "0")}`
}

/** "2026-09" → "09.2026". */
function ayBicimle(deger: string) {
  const [y, a] = deger.split("-")
  return y && a ? `${a}.${y}` : deger
}

/** "2026-09-07" → "07.09.2026" (lib/bicim'deki `tarih` ile aynı biçim). */
function bicimle(gun: string) {
  const [y, a, g] = gun.split("-")
  return y && a && g ? `${g}.${a}.${y}` : gun
}
