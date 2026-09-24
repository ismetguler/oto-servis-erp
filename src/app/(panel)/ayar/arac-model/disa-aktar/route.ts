import type { NextRequest } from "next/server"

import { csvOlustur, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

/**
 * ARAÇ MODEL KATALOĞUNU EXCEL'E AKTAR
 *
 * Varsayılan: yalnız ELLE eklenen kayıtlar (`?tumu=1` ile hazır 1174 satır
 * da dahil). "Kaynak" sütunu hazır/elle ayrımını taşır.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("ayar", "gor")

  const tumu = istek.nextUrl.searchParams.get("tumu") === "1"

  const kayitlar = await prisma.aracModelKatalog.findMany({
    where: tumu ? {} : { kilitli: false },
    orderBy: [{ marka: "asc" }, { model: "asc" }],
    select: { marka: true, model: true, kilitli: true, aktif: true },
  })

  const icerik = csvOlustur(
    ["Marka", "Model", "Kaynak", "Durum"],
    kayitlar.map((k) => [
      k.marka,
      k.model,
      k.kilitli ? "Hazır katalog" : "Elle eklendi",
      k.aktif ? "Aktif" : "Pasif",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "arac_model_katalog",
    aciklama: `Araç model kataloğu dışa aktarıldı (${kayitlar.length} kayıt${tumu ? ", hazır dahil" : ""})`,
    yeniDeger: { tumu },
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `arac-modelleri-${bugun}.csv`)
}
