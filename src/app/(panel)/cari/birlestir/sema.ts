import { z } from "zod"

/**
 * CARİ BİRLEŞTİRME — doğrulama.
 *
 * Bu projedeki en yıkıcı işlem: geri alma ekranı YOK, kaynak carinin bütün
 * geçmişi başka bir karta geçiyor. Bu yüzden şema iki ayrı fren içeriyor:
 *
 *  1. `onayKodu` — kullanıcı kaynak carinin kodunu ELLE yazmak zorunda.
 *     Yanlışlıkla tıklanan bir düğmenin veri taşımasını engelleyen tek şey bu.
 *  2. `onaylandi` — "geri alınamaz" onay kutusu.
 *
 * `aciklama` zorunlu değil ama işlem loguna yazılıyor: aylar sonra "bu iki
 * kayıt neden birleştirilmiş" sorusunun tek cevabı orası olacak.
 */
export const birlestirSemasi = z
  .object({
    kaynakId: z.coerce.number().int().positive("Kaynak cari seçilmedi."),
    hedefId: z.coerce.number().int().positive("Hedef cari seçilmedi."),
    onayKodu: z.string().trim().min(1, "Kaynak carinin kodunu yazın."),
    onaylandi: z.coerce.boolean().refine((v) => v, {
      message: "İşlemin geri alınamayacağını onaylamalısınız.",
    }),
    aciklama: z
      .string()
      .trim()
      .max(300, "Açıklama en fazla 300 karakter olabilir.")
      .optional(),
  })
  .refine((v) => v.kaynakId !== v.hedefId, {
    path: ["hedefId"],
    message: "Bir cari kendisiyle birleştirilemez.",
  })

/**
 * Hedefte BOŞ olup kaynakta dolu olan alanlar birleşmede hedefe kopyalanır.
 * Dolu olan hiçbir alan EZİLMEZ — hangisinin doğru olduğuna yazılım karar
 * veremez, doğru kayıt kullanıcının "hedef" seçtiği karttır.
 *
 * Listede yalnızca boşluğu net anlaşılan alanlar var (metin ve ilişki id'si).
 * `vadeGun` gibi sayısal koşullar bilerek dışarıda:
 * varsayılanları 0 ve "0 = boş mu, bilinçli sıfır mı" ayrımı yapılamaz;
 * yanlış kopyalanan bir değer sessizce paraya dokunur.
 *
 * `notu` bu listede değil, ayrı işleniyor: iki kayıtta da not varsa
 * kaynağınki hedefin altına ekleniyor (silinmesin diye).
 */
export const KOPYALANACAK_ALANLAR = [
  ["vergiNo", "Vergi No / TCKN"],
  ["vergiDair", "Vergi Dairesi"],
  ["yetkili", "Yetkili"],
  ["yetkiliTelefon", "Yetkili Telefonu"],
  ["telefon", "Telefon"],
  ["gsm", "GSM"],
  ["email", "E-posta"],
  ["adres", "Adres"],
  ["il", "İl"],
  ["ilce", "İlçe"],
  ["banka", "Banka"],
  ["bankaSube", "Banka Şubesi"],
  ["hesapNo", "Hesap No"],
  ["ibanNo", "IBAN"],
  ["ozelKod", "Özel Kod"],
  ["musteriSinifi", "Müşteri Sınıfı"],
  ["plasiyerId", "Sorumlu Personel"],
] as const

export type KopyalanacakAlan = (typeof KOPYALANACAK_ALANLAR)[number][0]
