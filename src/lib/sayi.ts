/**
 * SAYI OKUMA — tek kaynak
 *
 * Formlardan gelen metni sayıya çevirmenin projedeki TEK doğru yolu.
 * Daha önce her modül kendi kopyasını yazmıştı ve hepsi aynı hatayı
 * taşıyordu: noktayı KOŞULSUZ binlik ayıracı sayıp siliyorlardı. Kullanıcı
 * "1.250,50" yazdığında doğru çalışıyor, ama düzenleme ekranı ön değeri
 * veritabanından "1250.5" olarak bastığında aynı kayıt tekrar kaydedilince
 * 12505 oluyordu (7.1'de personel komisyonunda yakalandı).
 *
 * Kural: nokta yalnızca metinde VİRGÜL da varsa binlik ayıracıdır. Virgül
 * yoksa nokta ondalık ayıraçtır — çünkü o metni makine (Decimal.toString)
 * üretmiştir, insan değil.
 */
export function metniSayiyaCevir(ham: unknown): number {
  const yazi = String(ham ?? "").trim().replace(/\s/g, "")
  if (yazi === "") return NaN
  const temiz = yazi.includes(",")
    ? yazi.replace(/\./g, "").replace(",", ".")
    : yazi
  const deger = Number(temiz)
  return Number.isFinite(deger) ? deger : NaN
}
