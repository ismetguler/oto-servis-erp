import type { NextRequest } from "next/server"

import { personelListeKosulu } from "../veri"
import { csvOlustur, csvTarih, csvTutar, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * PERSONEL LİSTESİNİ EXCEL'E AKTAR
 *
 * Cari dışa aktarmasıyla aynı desen: ekrandaki sayfa değil, filtreye uyan
 * TÜM kayıtlar iner ve indirme işlemi loglanır (maaş bilgisi içeren bir
 * döküm, kimin ne zaman aldığı bilinmeli).
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("cari", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    durum: p.get("durum") ?? "aktif",
    gorev: p.get("gorev") ?? "",
  }

  const kayitlar = await prisma.cari.findMany({
    where: personelListeKosulu(filtreler),
    orderBy: { unvan: "asc" },
    include: {
      _count: { select: { plasiyerCarileri: true, kabulGorevleri: true } },
    },
  })

  const icerik = csvOlustur(
    [
      "Kod",
      "Ad Soyad",
      "Görev",
      "TCKN",
      "SGK No",
      "Doğum Tarihi",
      "İşe Giriş",
      "İşten Çıkış",
      "Telefon",
      "Cep",
      "E-Posta",
      "İl",
      "İlçe",
      "Adres",
      "IBAN",
      "Maaş",
      "Sorumlu Cari",
      "Üstlendiği İş",
      "Bakiye",
      "Bakiye Durumu",
      "Aktif",
      "Kayıt Tarihi",
    ],
    kayitlar.map((k) => {
      const bakiye = Number(k.bakiye.toString())
      return [
        k.kod,
        k.unvan,
        k.gorevi,
        k.vergiNo,
        k.sgkNo,
        csvTarih(k.dogumTarihi),
        csvTarih(k.iseGirisTarihi),
        csvTarih(k.istenCikisTarihi),
        k.telefon,
        k.gsm,
        k.email,
        k.il,
        k.ilce,
        k.adres,
        k.ibanNo,
        csvTutar(k.maas),
        k._count.plasiyerCarileri,
        k._count.kabulGorevleri,
        csvTutar(Math.abs(bakiye)),
        bakiye > 0 ? "BORÇ" : bakiye < 0 ? "ALACAK" : "",
        k.aktif ? "EVET" : "HAYIR",
        csvTarih(k.olusturmaTarihi),
      ]
    })
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "cariler",
    aciklama: `Personel listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `personel-listesi-${bugun}.csv`)
}
