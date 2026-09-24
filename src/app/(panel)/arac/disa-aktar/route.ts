import type { NextRequest } from "next/server"

import { aracListeKosulu } from "../veri"
import { csvOlustur, csvTarih, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/** ARAÇ LİSTESİNİ EXCEL'E AKTAR — cari modülündeki aynı desen. */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("arac", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    marka: p.get("marka") ?? "",
    durum: p.get("durum") ?? "aktif",
  }

  const kayitlar = await prisma.arac.findMany({
    where: aracListeKosulu(filtreler),
    orderBy: { plaka: "asc" },
    include: { cari: { select: { kod: true, unvan: true } } },
  })

  const icerik = csvOlustur(
    [
      "Plaka",
      "Marka",
      "Model",
      "Model Yılı",
      "Renk",
      "Şase No",
      "Motor Hacmi",
      "Yakıt Türü",
      "Vites Türü",
      "Kasa Tipi",
      "Son KM",
      "Sahibi Kodu",
      "Sahibi Ünvanı",
      "Trafik Sigortası Bitiş",
      "Kasko Bitiş",
      "Garanti Bitiş",
      "Muayene Bitiş",
      "Aktif",
    ],
    kayitlar.map((a) => [
      a.plaka,
      a.marka,
      a.model,
      a.modelYili,
      a.renk,
      a.saseNo,
      a.motorHacmi,
      a.yakitTuru,
      a.vitesTuru,
      a.kasaTipi,
      a.sonKm,
      a.cari?.kod,
      a.cari?.unvan,
      csvTarih(a.trafikSigBitis),
      csvTarih(a.kaskoBitis),
      csvTarih(a.garantiBitis),
      csvTarih(a.muayeneBitis),
      a.aktif ? "EVET" : "HAYIR",
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "araclar",
    aciklama: `Araç listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `arac-listesi-${bugun}.csv`)
}
