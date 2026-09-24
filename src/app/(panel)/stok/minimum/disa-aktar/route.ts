import { kritikStokIdleriGetir } from "../../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * KRİTİK STOK LİSTESİNİ EXCEL'E AKTAR
 *
 * Ekrandaki tabloyla aynı kaynaktan (kritikStokIdleriGetir) besleniyor —
 * ekranda görünen sayı ile inen dosya asla farklı olamaz.
 */
export async function GET() {
  const kullanici = await yetkiliOturum("stok", "gor")

  const idler = await kritikStokIdleriGetir()
  const kayitlarHam = idler.length
    ? await prisma.stok.findMany({
        where: { id: { in: idler } },
        include: { depo: { select: { ad: true } } },
      })
    : []
  const sira = new Map(idler.map((id, i) => [id, i]))
  const kayitlar = kayitlarHam.sort((a, b) => (sira.get(a.id) ?? 0) - (sira.get(b.id) ?? 0))

  const icerik = csvOlustur(
    [
      "Kod",
      "Ürün Adı",
      "Marka / Üretici",
      "Depo",
      "Birim",
      "Mevcut Miktar",
      "Min. Seviye",
      "Eksik",
      "Satış Fiyatı",
    ],
    kayitlar.map((s) => {
      const mevcut = Number(s.mevcutMiktar.toString())
      const min = Number(s.minSeviye.toString())
      return [
        s.kod,
        s.ad,
        s.uretici,
        s.depo?.ad,
        s.birim,
        csvTutar(s.mevcutMiktar),
        csvTutar(s.minSeviye),
        csvTutar(Math.max(0, min - mevcut)),
        csvTutar(s.satisFiyat),
      ]
    })
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    aciklama: `Kritik stok listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `kritik-stok-${bugun}.csv`)
}
