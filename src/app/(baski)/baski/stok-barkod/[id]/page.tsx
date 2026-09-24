import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * STOK BARKODU (11.9) — SIFIRDAN YAZILMADI, "ince kapı" (73.3/75'teki
 * desen). Stok barkod etiketi adım 8.7'de zaten yazılmıştı:
 * `/stok/etiket` — filtre + toplu seçim + kart başına adet + `jsbarcode`
 * ile taranabilir çizgi, üstelik barkodu boş kartlarda stok KODUnu basma
 * kuralıyla. Onu `(baski)` grubuna kopyalamak aynı ekranın ikinci bir
 * sürümünü doğururdu (biri düzelir, diğeri unutulur).
 *
 * Bu route yalnız 11.9 şablon listesindeki adresi karşılıyor ve kartı ön
 * seçili olacak şekilde var olan ekrana yönlendiriyor. Stok kartındaki
 * "Etiket Yazdır" düğmesi de doğrudan oraya gidiyor (8.7'den beri), ayrı
 * bir düğme AÇILMADI.
 */
export default async function StokBarkodBaskisi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const kayitId = Number(id)
  redirect(Number.isInteger(kayitId) ? `/stok/etiket?id=${kayitId}` : "/stok/etiket")
}
