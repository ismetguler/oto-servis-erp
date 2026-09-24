import "server-only"

import type { NumaratorTur } from "@/generated/prisma/enums"
import type { Prisma } from "@/generated/prisma/client"

/**
 * NUMARATÖR — otomatik kod / evrak numarası üretimi
 *
 * Numara "en büyük kaydı bul, bir artır" şeklinde ÜRETİLMEZ. İki kullanıcı
 * aynı anda kayıt açtığında ikisi de aynı numarayı bulur ve biri hata alırdı.
 * Bunun yerine sayaç veritabanında tek satırda tutulur ve `update` ile atomik
 * artırılır: PostgreSQL o satırı kilitlediği için ikinci kullanıcı sırasını
 * bekler, sonra bir sonraki numarayı alır.
 *
 * Bu yüzden fonksiyon MUTLAKA bir transaction içinde çağrılır — numara
 * artarsa ama kayıt oluşmazsa o numara boşa yanmasın.
 */

/**
 * Yıl bazlı sıfırlanmayan sayaçlar (cari kodu, stok kodu) için kullanılan
 * sahte yıl değeri. `yil` sütununu NULL bırakmıyoruz: PostgreSQL'de NULL'lar
 * birbirinden farklı sayıldığı için `@@unique([tur, yil])` kısıtı NULL
 * satırların çoğalmasını engelleyemezdi.
 */
export const YILSIZ = 0

type Secenekler = {
  /** true ise sayaç her yıl sıfırdan başlar (fatura, kabul no gibi). */
  yilBazli?: boolean
  /** Sayacın ilk kez oluşturulması gerekirse kullanılacak ön ek. */
  varsayilanOnEk?: string
  /** Sıfırla doldurma genişliği. C1 yerine C000001. */
  basamak?: number
}

export async function siradakiNumara(
  tx: Prisma.TransactionClient,
  tur: NumaratorTur,
  { yilBazli = false, varsayilanOnEk = "", basamak = 6 }: Secenekler = {}
): Promise<string> {
  const yil = yilBazli ? new Date().getFullYear() : YILSIZ

  // Sayaç satırı yoksa (yeni yıl / yeni tür) sessizce oluştur.
  await tx.numarator.upsert({
    where: { tur_yil: { tur, yil } },
    update: {},
    create: { tur, yil, onEk: varsayilanOnEk, sonNo: 0 },
  })

  const sayac = await tx.numarator.update({
    where: { tur_yil: { tur, yil } },
    data: { sonNo: { increment: 1 } },
    select: { onEk: true, sonNo: true },
  })

  return `${sayac.onEk}${String(sayac.sonNo).padStart(basamak, "0")}`
}
