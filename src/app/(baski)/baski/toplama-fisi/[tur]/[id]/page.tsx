import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BaskiAltBilgi, BaskiSayfasi, BelgeBasligi, FirmaBasligi } from "@/components/baski/baski-sablonu"
import { YazdirDugmesi } from "@/components/rapor-araclari"
import { tarih, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Toplama Fişi" }
export const dynamic = "force-dynamic"

type ToplamaSatiri = {
  id: number
  aciklama: string
  kod: string | null
  raf: string | null
  depo: string | null
  miktar: number
  birim: string
}

/**
 * TOPLAMA FİŞİ (11.9) — depocunun elindeki liste: bir siparişteki/faturadaki
 * kalemleri raftan toplarken kullanılıyor.
 *
 * FİYAT YOK — bağımsız İrsaliye'deki (11.8) kararla aynı gerekçe: bu kâğıt
 * depoda dolaşıyor, satır tutarlarının orada işi yok. Buna karşılık faturada
 * hiç bulunmayan iki bilgi var: `Stok.rafYeri` ve deponun adı — toplayan
 * kişinin tek ihtiyacı "nereden alacağım". Kataloğa bağlı OLMAYAN serbest
 * satırlarda (stokId boş) raf/kod kolonu boş kalır, satır yine listelenir;
 * depocu kâğıtta görmeli ki eksik toplamasın.
 *
 * İKİ KAYNAK: `tur` = `evrak` (fatura) ya da `siparis`. İkisi de aynı
 * "kalem + stok" iskeletine indirgeniyor (`ToplamaSatiri`), tek şablon.
 *
 * İKİ GÖRÜNÜM: `?format=termal` dar sütun (80mm, Fiş şablonundaki 11.8
 * deseninin aynısı — `BaskiSayfasi` A4 çerçevesi kullanılmaz), varsayılan
 * A4. İki görünüm arasında geçiş bağlantısı sayfanın üstünde (yalnız
 * ekranda, `yazdirma-disi`).
 */
export default async function ToplamaFisiBaskisi({
  params,
  searchParams,
}: {
  params: Promise<{ tur: string; id: string }>
  searchParams: Promise<{ format?: string }>
}) {
  const { tur, id } = await params
  const kayitId = Number(id)
  if (!Number.isInteger(kayitId)) notFound()
  if (tur !== "evrak" && tur !== "siparis") notFound()

  const kullanici = await yetkiliOturum(tur === "evrak" ? "evrak" : "siparis", "gor")

  const stokSecimi = {
    select: {
      kod: true,
      rafYeri: true,
      depo: { select: { ad: true } },
    },
  } as const

  let belgeNo: string
  let belgeTarihi: Date
  let cariUnvan: string
  let ustBilgi: string
  let satirlar: ToplamaSatiri[]

  if (tur === "evrak") {
    const evrak = await prisma.evrak.findUnique({
      where: { id: kayitId },
      include: {
        cari: { select: { unvan: true } },
        kalemler: { orderBy: { sira: "asc" }, include: { stok: stokSecimi } },
      },
    })
    if (!evrak || evrak.silindi) notFound()
    belgeNo = evrak.evrakNo
    belgeTarihi = evrak.tarih
    cariUnvan = evrak.cari.unvan
    ustBilgi = "Fatura"
    satirlar = evrak.kalemler.map((k) => ({
      id: k.id,
      aciklama: k.aciklama,
      kod: k.stok?.kod ?? null,
      raf: k.stok?.rafYeri ?? null,
      depo: k.stok?.depo?.ad ?? null,
      miktar: Number(k.miktar.toString()),
      birim: k.birim,
    }))
  } else {
    const siparis = await prisma.siparis.findUnique({
      where: { id: kayitId },
      include: {
        cari: { select: { unvan: true } },
        kalemler: { orderBy: { sira: "asc" }, include: { stok: stokSecimi } },
      },
    })
    if (!siparis || siparis.silindi) notFound()
    belgeNo = siparis.siparisNo
    belgeTarihi = siparis.tarih
    cariUnvan = siparis.cari.unvan
    ustBilgi = siparis.tip === "ALINAN" ? "Alınan Sipariş" : "Verilen Sipariş"
    // Siparişte toplanacak olan SÖZ VERİLEN miktarın tamamı değil, henüz
    // sevk edilmemiş KALAN kısmı — kısmi sevkte depocu aynı parçayı ikinci
    // kez toplamasın (`sevkMiktar`, siparişi faturadan ayıran alan).
    satirlar = siparis.kalemler
      .map((k) => ({
        id: k.id,
        aciklama: k.aciklama,
        kod: k.stok?.kod ?? null,
        raf: k.stok?.rafYeri ?? null,
        depo: k.stok?.depo?.ad ?? null,
        miktar: Number(k.miktar.toString()) - Number(k.sevkMiktar.toString()),
        birim: k.birim,
      }))
      .filter((s) => s.miktar > 0)
  }

  // Raf sırası depoda yürüme sırasıdır — rafı olmayanlar (serbest satır,
  // hizmet kalemi) sona atılıyor ki depocu koridoru bir kez dolaşsın.
  const sirali = [...satirlar].sort((a, b) => {
    if (!a.raf && !b.raf) return 0
    if (!a.raf) return 1
    if (!b.raf) return -1
    return a.raf.localeCompare(b.raf, "tr")
  })

  const p = await searchParams
  const termal = p.format === "termal"
  const digerFormatYolu = `/baski/toplama-fisi/${tur}/${kayitId}${termal ? "" : "?format=termal"}`

  const ustCubugu = (
    <div className="yazdirma-disi mb-4 flex flex-wrap items-center justify-between gap-2">
      <Link
        href={digerFormatYolu}
        className="text-[0.8125rem] text-neutral-600 underline hover:text-black"
      >
        {termal ? "A4 görünümüne geç" : "Termal (dar) görünüme geç"}
      </Link>
      <YazdirDugmesi etiket="Toplama Fişini Yazdır" />
    </div>
  )

  if (termal) {
    return (
      <div className="mx-auto w-[80mm] max-w-full bg-white p-3 text-[0.75rem] text-black">
        {ustCubugu}

        <div className="text-center">
          <p className="font-bold">TOPLAMA FİŞİ</p>
          <p className="text-[0.6875rem] text-neutral-700">
            {ustBilgi} · {belgeNo}
          </p>
        </div>

        <div className="my-2 border-t border-dashed border-neutral-400" />

        <p>Tarih: {tarih(belgeTarihi)}</p>
        <p>Cari: {cariUnvan}</p>
        <p>Yazdırma: {tarihSaat(new Date())}</p>

        <div className="my-2 border-t border-dashed border-neutral-400" />

        {sirali.map((s) => (
          <div key={s.id} className="mb-1.5">
            <div className="flex justify-between gap-2">
              <span className="flex-1 font-medium">{s.aciklama}</span>
              <span className="tabular-nums">
                {s.miktar.toLocaleString("tr-TR")} {s.birim}
              </span>
            </div>
            <div className="text-[0.6875rem] text-neutral-600">
              {[s.kod, s.raf ? `Raf: ${s.raf}` : null, s.depo].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        ))}
        {sirali.length === 0 ? (
          <p className="text-center text-neutral-500">Toplanacak kalem yok.</p>
        ) : null}

        <div className="my-2 border-t border-dashed border-neutral-400" />

        <p className="text-[0.6875rem]">Toplayan: ..............................</p>

        <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={belgeNo} />
      </div>
    )
  }

  return (
    <BaskiSayfasi>
      {ustCubugu}

      <FirmaBasligi />
      <BelgeBasligi baslik="Toplama Fişi" altBaslik={`${ustBilgi} — ${belgeNo}`} />

      <div className="flex flex-wrap gap-x-8 gap-y-1 border border-neutral-300 p-3 text-[0.8125rem]">
        <span>
          <span className="text-neutral-500">Belge:</span> {belgeNo}
        </span>
        <span>
          <span className="text-neutral-500">Tarih:</span> {tarih(belgeTarihi)}
        </span>
        <span>
          <span className="text-neutral-500">Cari:</span> {cariUnvan}
        </span>
        <span>
          <span className="text-neutral-500">Satır:</span> {sirali.length}
        </span>
      </div>

      <table className="mt-4 w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="border-y-2 border-black text-left uppercase text-[0.6875rem]">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Ürün Kodu</th>
            <th className="py-1 pr-2">Ürün Adı / Açıklama</th>
            <th className="py-1 pr-2">Raf</th>
            <th className="py-1 pr-2">Depo</th>
            <th className="py-1 pr-2 text-right">Miktar</th>
            <th className="w-16 py-1 text-center">Toplandı</th>
          </tr>
        </thead>
        <tbody>
          {sirali.map((s, i) => (
            <tr key={s.id} className="border-b border-neutral-300">
              <td className="py-1.5 pr-2">{i + 1}</td>
              <td className="py-1.5 pr-2 font-mono text-[0.75rem]">{s.kod ?? "—"}</td>
              <td className="py-1.5 pr-2">{s.aciklama}</td>
              <td className="py-1.5 pr-2 font-medium">{s.raf ?? "—"}</td>
              <td className="py-1.5 pr-2 text-neutral-700">{s.depo ?? "—"}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {s.miktar.toLocaleString("tr-TR")} {s.birim}
              </td>
              <td className="py-1.5 text-center">
                <span className="inline-block size-4 border border-black align-middle" />
              </td>
            </tr>
          ))}
          {sirali.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-3 text-center text-neutral-500">
                Toplanacak kalem yok.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <p className="mt-4 text-[0.75rem] text-neutral-700">
        Satırlar raf sırasına göre dizilmiştir; rafı tanımlı olmayan kalemler sondadır.
        Fiyat bilgisi bilinçli olarak basılmaz.
      </p>

      <div className="baski-imza mt-8 grid grid-cols-2 gap-8 text-[0.8125rem]">
        <div>
          <p className="mb-8 font-medium">Toplayan</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
        <div>
          <p className="mb-8 font-medium">Kontrol Eden</p>
          <p className="border-t border-neutral-400 pt-1 text-neutral-500">Ad Soyad / İmza</p>
        </div>
      </div>

      <BaskiAltBilgi kullaniciAdi={kullanici.tamAd} belgeNo={belgeNo} />
    </BaskiSayfasi>
  )
}
