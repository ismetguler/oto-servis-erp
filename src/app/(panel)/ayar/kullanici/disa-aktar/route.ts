import type { NextRequest } from "next/server"

import { kullaniciListeKosulu } from "../veri"
import { csvOlustur, csvTarih, csvYaniti } from "@/lib/csv"
import { logKaydet } from "@/lib/log"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { ROL_ADLARI } from "@/lib/yetki"

/**
 * KULLANICILARI EXCEL'E AKTAR
 *
 * `/ayar/log/disa-aktar` deseninin aynısı: ekran, sayaç ve CSV aynı
 * `kullaniciListeKosulu` koşulunu kullanıyor, filtreye uyan TÜM kayıtlar
 * iner. Şifre hash'i asla yazılmaz.
 */
export async function GET(istek: NextRequest) {
  const kullanici = await yetkiliOturum("ayar", "gor")

  const p = istek.nextUrl.searchParams
  const filtreler = {
    q: p.get("q") ?? "",
    rol: p.get("rol") ?? "",
    durum: p.get("durum") ?? "aktif",
  }

  const kayitlar = await prisma.kullanici.findMany({
    where: kullaniciListeKosulu(filtreler),
    orderBy: [{ aktif: "desc" }, { kod: "asc" }],
    select: {
      kod: true,
      ad: true,
      soyad: true,
      email: true,
      telefon: true,
      rol: true,
      aktif: true,
      kilitBitis: true,
      sonGirisTarihi: true,
      olusturmaTarihi: true,
    },
  })

  const simdi = Date.now()
  const icerik = csvOlustur(
    ["Kullanıcı Adı", "Ad", "Soyad", "E-Posta", "Telefon", "Rol", "Durum", "Son Giriş", "Kayıt Tarihi"],
    kayitlar.map((k) => [
      k.kod,
      k.ad,
      k.soyad ?? "",
      k.email ?? "",
      k.telefon ?? "",
      ROL_ADLARI[k.rol] ?? k.rol,
      !k.aktif
        ? "Pasif"
        : k.kilitBitis && k.kilitBitis.getTime() > simdi
          ? "Kilitli"
          : "Aktif",
      csvTarih(k.sonGirisTarihi),
      csvTarih(k.olusturmaTarihi),
    ])
  )

  await logKaydet({
    islem: "DISA_AKTAR",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "kullanicilar",
    aciklama: `Kullanıcı listesi dışa aktarıldı (${kayitlar.length} kayıt)`,
    yeniDeger: filtreler,
  })

  const bugun = new Date().toISOString().slice(0, 10)
  return csvYaniti(icerik, `kullanicilar-${bugun}.csv`)
}
