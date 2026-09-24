/**
 * "İŞİMİN ORTASINDAYIM, KAYIT YOK" AKIŞI
 *
 * Araç kabul açarken aranan plaka (ya da müşteri) listede olmayabilir —
 * müşteri karşında dururken başka ekrana gidip geri gelmek, üstelik
 * doldurduğun formu kaybetmek kabul edilemezdi. Artık kabul ekranındaki
 * "+ Yeni Araç" / "+ Yeni Cari" düğmesi kayıt ekranına `?donus=kabul` ile
 * gidiyor; kayıt bitince kullanıcı kartın detayına DEĞİL geldiği kabul
 * ekranına dönüyor ve yeni açtığı kayıt orada seçili geliyor.
 *
 * Dönüş adresi hiçbir zaman formdan gelen serbest bir URL değil: gelen değer
 * yalnızca buradaki sabit listeyle eşleşirse yol üretilir. Aksi hâlde
 * kullanıcıyı formdaki metne bakarak dışarı yollamış olurduk (open redirect).
 */

const DONUS_YOLLARI = {
  kabul: (alan: "arac" | "cari", kayitId: number) =>
    `/servis/kabul/yeni?${alan}=${kayitId}`,
  // Yeni araç kartında sahibi bulunamayınca "+ Yeni Cari" ile buraya gelinir;
  // kayıt bitince yeni cari sahip olarak seçili şekilde araç formuna dönülür.
  aracYeni: (alan: "arac" | "cari", kayitId: number) =>
    alan === "cari" ? `/arac/yeni?cariId=${kayitId}` : `/arac/yeni`,
} as const

export type DonusAnahtari = keyof typeof DONUS_YOLLARI

/** Form/sorgu değerini bilinen bir dönüş anahtarına indirger; tanımadıysa undefined. */
export function donusAnahtari(deger: unknown): DonusAnahtari | undefined {
  const metin = typeof deger === "string" ? deger.trim() : ""
  return metin in DONUS_YOLLARI ? (metin as DonusAnahtari) : undefined
}

/**
 * Kayıt sonrası gidilecek yol. `donus` tanınmıyorsa null döner —
 * çağıran taraf o zaman kendi normal yönlendirmesini yapar.
 */
export function donusYolu(
  deger: unknown,
  alan: "arac" | "cari",
  kayitId: number
): string | null {
  const anahtar = donusAnahtari(deger)
  return anahtar ? DONUS_YOLLARI[anahtar](alan, kayitId) : null
}

/**
 * TANIM (liste) EKLEME DÖNÜŞÜ
 *
 * "Kart Türü", "Bakım Şekli", "Marka" gibi açılır listelerde aranan seçenek
 * yoksa formdaki "+ Yeni" düğmesi kullanıcıyı `/ayar/tanim` (ya da Proje /
 * İşçilik Bölümü gibi kendi ekranı olan türlerde o ekrana) götürür; tanım
 * eklenince kullanıcı GERİ, geldiği forma döner ve yeni eklediği değer o
 * alanda seçili gelir.
 *
 * Yukarıdaki `DONUS_YOLLARI`nın aksine burada dönüş adresi sabit bir
 * fonksiyon tablosundan DEĞİL, kullanıcının o an bulunduğu URL'den üretilir
 * (`TanimEkleTusu` bileşeni `usePathname`/`useSearchParams` ile kurar) —
 * çünkü aynı ekranın hem "yeni" hem "düzenle" hâli, hem de üstünde birden
 * fazla tanım alanı (kabul formunda 4 tane) olabilir. Açık yönlendirmeyi
 * (open redirect) engellemek için bu adres yine de yalnızca bilinen
 * uygulama-içi yol öneklerinden biriyle başlıyorsa kabul edilir.
 */
const TANIM_DONUS_ONEKLERI = [
  "/servis/kabul/",
  "/arac/",
  "/cari/",
  "/stok/",
  "/servis/bakim-paketi/",
  "/iscilik/",
] as const

/** `donusYol` sorgu parametresinin güvenli (uygulama içi, bilinen) olup olmadığını doğrular. */
export function tanimDonusYoluGuvenliMi(yol: string): boolean {
  if (!yol.startsWith("/") || yol.startsWith("//")) return false
  return TANIM_DONUS_ONEKLERI.some((onek) => yol.startsWith(onek))
}
