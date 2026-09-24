import type { NextRequest } from "next/server"

import { paketKalemleriGetir, paketListeKosulu } from "../veri"
import { csvOlustur, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * BAKIM PAKETLERİNİ EXCEL'E AKTAR.
 * Satır bazlı çıkıyor (paket başına bir blok): pakette ne olduğu görünmeden
 * sadece başlık listesi vermek, "bu pakette ne var" sorusunu cevaplamıyordu.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("kabul", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = { q: p.get("q") ?? "", durum: p.get("durum") ?? "aktif" }

  const paketler = await prisma.bakimPaketi.findMany({
    where: paketListeKosulu(filtreler),
    orderBy: { ad: "asc" },
  })

  const satirlar: (string | number | null | undefined)[][] = []
  for (const paket of paketler) {
    const kalemler = await paketKalemleriGetir(paket.id)
    if (kalemler.length === 0) {
      satirlar.push([
        paket.kod,
        paket.ad,
        paket.km,
        paket.marka,
        paket.aracTuru,
        paket.aktif ? "EVET" : "HAYIR",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Paket boş",
      ])
      continue
    }

    for (const k of kalemler) {
      const tutar = k.miktar * k.gecerliFiyat
      satirlar.push([
        paket.kod,
        paket.ad,
        paket.km,
        paket.marka,
        paket.aracTuru,
        paket.aktif ? "EVET" : "HAYIR",
        k.tur === "PARCA" ? "Parça" : k.tur === "ISCILIK" ? "İşçilik" : "Dış Hizmet",
        k.aciklama,
        csvTutar(k.miktar),
        k.birim,
        csvTutar(k.gecerliFiyat),
        k.fiyatSabit !== null ? "Pakette sabit" : "Güncel katalog",
        csvTutar(tutar * (1 + k.kdvOrani / 100)),
        k.uyari,
      ])
    }
  }

  const icerik = csvOlustur(
    [
      "Paket Kodu",
      "Paket Adı",
      "Km",
      "Marka",
      "Araç Türü",
      "Aktif",
      "Satır Türü",
      "Satır Açıklaması",
      "Miktar",
      "Birim",
      "Birim Fiyat",
      "Fiyat Kaynağı",
      "Satır Tutarı (KDV dahil)",
      "Uyarı",
    ],
    satirlar
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "bakim_paketleri",
    aciklama: `Bakım paketleri dışa aktarıldı (${paketler.length} paket, ${satirlar.length} satır)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `bakim-paketleri-${bugun}.csv`)
}
