import { oturumZorunlu } from "@/lib/oturum"

/**
 * BASKI YERLEŞİMİ — yazdırılabilir belgelerin ortak çerçevesi.
 *
 * `(panel)` grubundan bilinçli olarak AYRI: sol menü/üst bar burada YOK,
 * kâğıda o gitmemeli. Girişi yine zorunlu kılıyor (`oturumZorunlu`) —
 * belge içeriği yine hassas veri, sadece görünüm sade.
 */
export default async function BaskiDuzeni({
  children,
}: {
  children: React.ReactNode
}) {
  await oturumZorunlu()

  return <div className="min-h-dvh bg-neutral-200 print:bg-white">{children}</div>
}
