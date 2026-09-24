/**
 * ARAÇ PANEL ŞEMASI — boyalı / değişen işaretlemesinin tek kaynağı
 *
 * Selim abinin isteği: "Sahibinden'deki gibi boyalı yerleri
 * işaretleyebileceğimiz şekilde altına yapmamız lazım."
 *
 * YERLEŞİM — sahibinden'in kullandığı "açılmış araç" düzeni:
 *   ORTA : kuş bakışı gövde (ön tampon, kaput, tavan, bagaj, arka tampon)
 *   SOL  : aracın sol profili, dışarı yatırılmış (çamurluk + kapılar)
 *   SAĞ  : aynısının aynası
 * Yan profillerde tekerlek dışta kalır, cam boşlukları beyaz bırakılır.
 *
 * TEK ŞEMA: binek, kamyonet, panelvan — hepsi aynı çizimle işaretleniyor
 * (İsmet'in kararı). Araç tipine göre ayrı çizim yapılmadı; usta hangi
 * parçaya baktığını zaten biliyor, iki ayrı şema gereksiz karmaşa olurdu.
 * `Ekspertiz.semaTuru` sütunu veritabanında duruyor ama şimdilik hep BINEK
 * — ileride gerçekten ayrı çizim istenirse yer hazır.
 *
 * Çizim sahibinden'den KOPYALANMADI, ölçüleri buradan yeniden üretiliyor:
 * onların görseli telifli. Düzen ve renk mantığı taklit ediliyor, dosya
 * değil — ileride sistem satılırken sorun çıkmasın.
 *
 * Neden burada, veritabanında değil: panel listesi ÇİZİMLE birlikte değişir.
 * Kodlar tabloda, çizim kodda dursaydı ikisi er geç koparadı (tabloya panel
 * eklenir, şemada karşılığı çıkmazdı). Kod + ad + çizim TEK yerde duruyor.
 */

export type PanelDurumKodu = "LOKAL_BOYALI" | "BOYALI" | "DEGISMIS"

/**
 * Panel durumları. Renkler ve kısaltmalar sahibinden'in ilan sayfasındaki
 * düzenle aynı — müşteri o kodlamayı zaten tanıyor, ikinci bir dil
 * öğretmenin anlamı yok.
 *
 * `harf` alanı şart: renkli ekranda renk yeter ama form siyah-beyaz
 * yazıcıdan çıkıyor, orada turuncu ile kırmızı ayırt edilemez. Bu yüzden
 * her işaretli panele kısaltması da basılıyor.
 *
 * Üç durum, sahibinden'deki ile birebir. Dördüncü bir "Hasarlı" durumu
 * düşünüldü ama İsmet kaldırttı: ekspertizde parça listesi ve işçilik
 * kırılımı zaten hasarı anlatıyor, şemada dördüncü renk sadece kalabalık
 * yapardı.
 */
export const PANEL_DURUMLARI: {
  kod: PanelDurumKodu
  ad: string
  harf: string
  renk: string
  kenar: string
  yazi: string
}[] = [
  {
    kod: "LOKAL_BOYALI",
    ad: "Lokal Boyalı",
    harf: "LB",
    renk: "#f5a623",
    kenar: "#c97f0c",
    yazi: "#ffffff",
  },
  {
    kod: "BOYALI",
    ad: "Boyalı",
    harf: "B",
    renk: "#2f6fc0",
    kenar: "#1f4f8f",
    yazi: "#ffffff",
  },
  {
    kod: "DEGISMIS",
    ad: "Değişen",
    harf: "D",
    renk: "#e8412f",
    kenar: "#b32b1c",
    yazi: "#ffffff",
  },
]

/** İşaretlenmemiş panel — "orijinal" kabul edilir, veritabanına YAZILMAZ. */
export const ORIJINAL = {
  ad: "Orijinal",
  renk: "#c9ccd1",
  kenar: "#adb1b8",
  yazi: "#3f4550",
}

export function panelDurumu(kod: PanelDurumKodu) {
  return PANEL_DURUMLARI.find((d) => d.kod === kod)
}

// ============================================================================
//  ÇİZİM ALTYAPISI
//
//  Yollar düz metin yerine komut dizisi olarak yazılıyor. Tek sebebi var:
//  sağ profil, solun AYNASI olarak üretiliyor. Metin olsaydı sağ tarafı elle
//  yazmak gerekirdi ve iki taraf er geç birbirinden kayardı ("sağ kapı sol
//  kapıdan farklı çizilmiş" hatası). Komut dizisinde x'i çevirmek yeterli.
// ============================================================================

type Komut =
  | ["M", number, number]
  | ["L", number, number]
  | ["Q", number, number, number, number]

/** Komutları SVG yoluna çevirir; `dx` fonksiyonu x eksenini taşır/çevirir. */
function yol(komutlar: Komut[], dx: (x: number) => number, dy: number): string {
  const parcalar = komutlar.map((k) => {
    if (k[0] === "Q") {
      return `Q${dx(k[1])},${k[2] + dy} ${dx(k[3])},${k[4] + dy}`
    }
    return `${k[0]}${dx(k[1])},${k[2] + dy}`
  })
  return `${parcalar.join(" ")} Z`
}

/** Tıklanabilir panel. */
export type PanelSekli = {
  kod: string
  ad: string
  d: string
  /** Kısaltmanın basılacağı nokta. */
  yaziX: number
  yaziY: number
}

/** Tıklanamayan süsler: camlar, tekerlekler, yön yazıları. */
export type SemaSusu =
  | { tur: "govde"; d: string }
  | { tur: "cam"; d: string }
  | { tur: "teker"; cx: number; cy: number; r: number }
  | { tur: "yazi"; x: number; y: number; metin: string }

export type Sema = {
  ad: string
  genislik: number
  yukseklik: number
  paneller: PanelSekli[]
  susler: SemaSusu[]
}

// ============================================================================
//  YERLEŞİM
// ============================================================================

const G = 420 // viewBox genişliği
const Y = 400 // viewBox yüksekliği

// Yan profiller kenardan içeride başlar: tekerlek daireleri profilin DIŞINA
// taşıyor, taşan kısma yer kalsın diye.
const SOL_TABAN = 34 // sol profilin dış kenarı (yerel x = 0 buraya düşer)
const SAG_TABAN = 386 // sağ profilin dış kenarı
const YAN_UST = 26 // yan profillerin üst boşluğu

const solX = (x: number) => SOL_TABAN + x
const sagX = (x: number) => SAG_TABAN - x

const OX = 210 // orta sütunun merkezi

// ============================================================================
//  YAN PROFİL — tek tanım, sol ve sağ için iki kez üretilir
// ============================================================================

type YanParca = {
  /** Kod eki: "on_kapi" → "sol_on_kapi" / "sag_on_kapi" */
  ek: string
  /** Ad eki: "Ön Kapı" → "Sol Ön Kapı" / "Sağ Ön Kapı" */
  ad: string
  govde: Komut[]
  cam?: Komut[]
  yazi: [number, number]
}

/**
 * Yan profil, aracın yandan görünüşünün dışa yatırılmış hâli. Burun yukarıda,
 * tekerlek tarafı dışarıda. Çamurluklar burunda/kuyrukta daralır, kapıların
 * iç kenarı cam hattı boyunca genişler — düz dikdörtgen çizilseydi araçtan
 * çok merdivene benzerdi.
 */
const YAN_PARCALAR: YanParca[] = [
  {
    ek: "on_camurluk",
    ad: "Ön Çamurluk",
    govde: [
      ["M", 2, 34],
      ["Q", 4, 8, 32, 3],
      ["L", 58, 5],
      ["Q", 74, 12, 78, 38],
      ["L", 80, 86],
      ["L", 0, 86],
    ],
    yazi: [46, 58],
  },
  {
    ek: "on_kapi",
    ad: "Ön Kapı",
    govde: [
      ["M", 0, 90],
      ["L", 80, 90],
      ["Q", 96, 98, 98, 126],
      ["L", 99, 178],
      ["L", 0, 178],
    ],
    cam: [
      ["M", 26, 120],
      ["L", 90, 128],
      ["L", 92, 160],
      ["L", 26, 154],
    ],
    yazi: [46, 170],
  },
  {
    ek: "arka_kapi",
    ad: "Arka Kapı",
    govde: [
      ["M", 0, 182],
      ["L", 99, 182],
      ["L", 98, 242],
      ["Q", 96, 260, 84, 268],
      ["L", 0, 268],
    ],
    cam: [
      ["M", 26, 192],
      ["L", 92, 192],
      ["L", 88, 226],
      ["L", 26, 224],
    ],
    yazi: [46, 256],
  },
  {
    ek: "arka_camurluk",
    ad: "Arka Çamurluk",
    govde: [
      ["M", 0, 272],
      ["L", 84, 272],
      ["Q", 76, 320, 52, 338],
      ["Q", 28, 348, 0, 332],
    ],
    yazi: [40, 298],
  },
]

function yanPanelleriUret(): { paneller: PanelSekli[]; camlar: SemaSusu[] } {
  const paneller: PanelSekli[] = []
  const camlar: SemaSusu[] = []

  for (const parca of YAN_PARCALAR) {
    paneller.push(
      {
        kod: `sol_${parca.ek}`,
        ad: `Sol ${parca.ad}`,
        d: yol(parca.govde, solX, YAN_UST),
        yaziX: solX(parca.yazi[0]),
        yaziY: parca.yazi[1] + YAN_UST,
      },
      {
        kod: `sag_${parca.ek}`,
        ad: `Sağ ${parca.ad}`,
        d: yol(parca.govde, sagX, YAN_UST),
        yaziX: sagX(parca.yazi[0]),
        yaziY: parca.yazi[1] + YAN_UST,
      }
    )

    if (parca.cam) {
      camlar.push(
        { tur: "cam", d: yol(parca.cam, solX, YAN_UST) },
        { tur: "cam", d: yol(parca.cam, sagX, YAN_UST) }
      )
    }
  }

  return { paneller, camlar }
}

const { paneller: YAN_PANELLER, camlar: YAN_CAMLAR } = yanPanelleriUret()

// ============================================================================
//  ORTA SÜTUN — kuş bakışı gövde
// ============================================================================

const ortaX = (x: number) => OX + x
const orta = (komutlar: Komut[]) => yol(komutlar, ortaX, 0)

/**
 * Kuş bakışı gövde. Düz dikdörtgen kutular yerine gerçek siluet çiziliyor:
 * burun dar, kabin geniş, kuyruk tekrar daralıyor; camlar yamuk, dışarıda
 * ayna kulakları var. Kâğıda bakan müşteri "bu bir araba" demeli, yoksa
 * hangi kutunun kaput hangisinin bagaj olduğunu tarif okumadan anlamıyor.
 */
const ORTA_PANELLER: PanelSekli[] = [
  {
    kod: "on_tampon",
    ad: "Ön Tampon",
    d: orta([
      ["M", -34, 32],
      ["Q", -34, 18, -20, 16],
      ["L", 20, 16],
      ["Q", 34, 18, 34, 32],
      ["L", 39, 58],
      ["L", -39, 58],
    ]),
    yaziX: OX,
    yaziY: 46,
  },
  {
    kod: "on_kaput",
    ad: "Ön Kaput",
    d: orta([
      ["M", -39, 62],
      ["L", 39, 62],
      ["Q", 45, 80, 46, 106],
      ["L", -46, 106],
      ["Q", -45, 80, -39, 62],
    ]),
    yaziX: OX,
    yaziY: 90,
  },
  {
    kod: "tavan",
    ad: "Tavan",
    d: orta([
      ["M", -47, 148],
      ["L", 47, 148],
      ["L", 47, 250],
      ["L", -47, 250],
    ]),
    yaziX: OX,
    yaziY: 203,
  },
  {
    kod: "bagaj_kapagi",
    ad: "Bagaj Kapağı",
    d: orta([
      ["M", -43, 292],
      ["L", 43, 292],
      ["L", 41, 344],
      ["L", -41, 344],
    ]),
    yaziX: OX,
    yaziY: 320,
  },
  {
    kod: "arka_tampon",
    ad: "Arka Tampon",
    d: orta([
      ["M", -41, 348],
      ["L", 41, 348],
      ["L", 39, 376],
      ["Q", 37, 386, 25, 386],
      ["L", -25, 386],
      ["Q", -37, 386, -39, 376],
    ]),
    yaziX: OX,
    yaziY: 372,
  },
]

const ORTA_SUSLER: SemaSusu[] = [
  // Gövde silueti — panellerin arkasında duran açık gri zemin. Parçalar
  // arasındaki ince boşluklarda görünüp hepsinin tek araca ait olduğunu
  // gösteriyor.
  {
    tur: "govde",
    d: orta([
      ["M", -36, 30],
      ["Q", -36, 14, -20, 12],
      ["L", 20, 12],
      ["Q", 36, 14, 36, 30],
      ["Q", 47, 60, 49, 110],
      ["L", 49, 300],
      ["Q", 49, 350, 43, 372],
      ["Q", 40, 390, 26, 390],
      ["L", -26, 390],
      ["Q", -40, 390, -43, 372],
      ["Q", -49, 350, -49, 300],
      ["L", -49, 110],
      ["Q", -47, 60, -36, 30],
    ]),
  },
  // ayna kulakları
  {
    tur: "govde",
    d: orta([
      ["M", -49, 116],
      ["L", -60, 119],
      ["L", -60, 131],
      ["L", -49, 132],
    ]),
  },
  {
    tur: "govde",
    d: orta([
      ["M", 49, 116],
      ["L", 60, 119],
      ["L", 60, 131],
      ["L", 49, 132],
    ]),
  },
  // farlar / stoplar — tamponun araç olduğunu belli eden detay
  { tur: "cam", d: orta([["M", -30, 24], ["L", -13, 27], ["L", -13, 38], ["L", -30, 36]]) },
  { tur: "cam", d: orta([["M", 30, 24], ["L", 13, 27], ["L", 13, 38], ["L", 30, 36]]) },
  { tur: "cam", d: orta([["M", -36, 355], ["L", -16, 355], ["L", -16, 368], ["L", -36, 368]]) },
  { tur: "cam", d: orta([["M", 36, 355], ["L", 16, 355], ["L", 16, 368], ["L", 36, 368]]) },
  // ön cam — aşağı doğru genişleyen yamuk
  {
    tur: "cam",
    d: orta([
      ["M", -44, 110],
      ["L", 44, 110],
      ["L", 47, 144],
      ["L", -47, 144],
    ]),
  },
  // arka cam
  {
    tur: "cam",
    d: orta([
      ["M", -47, 254],
      ["L", 47, 254],
      ["L", 43, 288],
      ["L", -43, 288],
    ]),
  },
]


// ============================================================================

export const ARAC_SEMASI: Sema = {
  ad: "Araç Şeması",
  genislik: G,
  yukseklik: Y,
  paneller: [...YAN_PANELLER, ...ORTA_PANELLER],
  susler: [
    ...ORTA_SUSLER,
    ...YAN_CAMLAR,
    { tur: "teker", cx: solX(-15), cy: YAN_UST + 52, r: 25 },
    { tur: "teker", cx: solX(-15), cy: YAN_UST + 298, r: 25 },
    { tur: "teker", cx: sagX(-15), cy: YAN_UST + 52, r: 25 },
    { tur: "teker", cx: sagX(-15), cy: YAN_UST + 298, r: 25 },
    { tur: "yazi", x: OX, y: 6, metin: "ÖN" },
    { tur: "yazi", x: OX, y: 396, metin: "ARKA" },
  ],
}

/** Şemadaki tüm panel kodları — formdan geleni doğrulamak için. */
export function panelKoduGecerli(kod: string): boolean {
  return ARAC_SEMASI.paneller.some((p) => p.kod === kod)
}

export function panelAdi(kod: string): string {
  return ARAC_SEMASI.paneller.find((p) => p.kod === kod)?.ad ?? kod
}
