/**
 * PLAKA ARAMA — tek kaynak
 *
 * `Arac.plaka` veritabanında boşluksuz saklanıyor ("38ABC123"), ekranda ise
 * `bicim.plaka` boşluklu gösteriyor ("38 ABC 123"). Kullanıcı gördüğü gibi
 * "38 abc 123" yazdığında arama boş dönmesin diye, sorgu metnindeki boşluklar
 * atılıp `contains ... mode:"insensitive"` ile karşılaştırılır.
 *
 * Bu kural projede birçok yerde (evrak/servis, arac, servis/garanti,
 * servis/onceki, servis/parca-cikis) inline `q.replace(/\s+/g,"")` olarak
 * kopyalanmıştı; 12.7 hızlı aramasıyla birlikte tek fonksiyona indiriliyor.
 */
export function plakaSadelestir(q: string): string {
  return q.replace(/\s+/g, "")
}
