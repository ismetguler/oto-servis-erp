import { z } from "zod"

/**
 * Yeni depo transfer fişi formu — kaynak depodaki stok kartlarından
 * seçilenler (checkbox) fişe kalem olarak girer. Miktar burada
 * GİRİLMEZ: "kart taşıma" modelinde transfer, kartın o andaki tüm
 * mevcut miktarını taşır, kısmi miktar bölünmez (bkz. şema yorumu).
 */
export const transferOlusturSemasi = z
  .object({
    kaynakDepoId: z.coerce.number().int().positive("Kaynak depo seçilmelidir."),
    hedefDepoId: z.coerce.number().int().positive("Hedef depo seçilmelidir."),
    aciklama: z.string().trim().max(500).nullable(),
    stokIdler: z
      .array(z.coerce.number().int().positive())
      .min(1, "En az bir stok kartı seçilmelidir."),
  })
  .refine((v) => v.kaynakDepoId !== v.hedefDepoId, {
    message: "Kaynak ve hedef depo aynı olamaz.",
    path: ["hedefDepoId"],
  })

export type TransferOlusturGirdisi = z.infer<typeof transferOlusturSemasi>
