import { z } from "zod"

/**
 * KARA LİSTE
 *
 * Tek bir kural var ama ödün verilmiyor: hem listeye ALIRKEN hem de
 * ÇIKARIRKEN neden yazılmak zorunda. Sebebi Selim Abi'nin "kim yaptı belli
 * olsun" isteği — nedeni boş bırakılan bir kayıt aylar sonra kimseye bir şey
 * anlatmıyor, üstelik kabul ekranındaki uyarı da boş görünüyordu.
 */

const neden = (etiket: string) =>
  z
    .string()
    .trim()
    .min(3, `${etiket} en az 3 karakter olmalı.`)
    .max(300, `${etiket} en fazla 300 karakter olabilir.`)

export const karaListeyeAlSemasi = z.object({
  cariId: z.coerce.number().int().positive("Cari geçersiz."),
  neden: neden("Kara liste nedeni"),
})

export const karaListedenCikarSemasi = z.object({
  cariId: z.coerce.number().int().positive("Cari geçersiz."),
  kaldirmaNedeni: neden("Kaldırma nedeni"),
})
