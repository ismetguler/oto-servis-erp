import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * PERSONEL — okuma tarafı
 *
 * Personel ayrı tablo DEĞİL: cari tablosunda `turu = PERSONEL` olan kayıt
 * (Selpar'ın mimarisi, şemamız da baştan böyle kuruldu). Bu yüzden burada
 * yeni bir model yok, yalnızca cari sorgusunun personel kesiti var —
 * ayrı tablo yapılsaydı personelin avans/borç hareketleri cari ekstresinden
 * kopardı ve her raporda iki kaynak birleştirmek gerekirdi.
 */

/** Personel listesinin adres çubuğundan gelen filtreleri. */
export type PersonelFiltreleri = {
  q?: string
  durum?: string
  gorev?: string
}

/**
 * Liste koşulu tek yerde: aynı koşulu ekran, sayfa sayacı ve dışa aktarma
 * kullanıyor. Ayrı yazılsaydı ekrandaki liste ile inen dosya farklı olabilirdi.
 */
export function personelListeKosulu({
  q = "",
  durum = "aktif",
  gorev = "",
}: PersonelFiltreleri): Prisma.CariWhereInput {
  const arama = q.trim()

  return {
    turu: "PERSONEL",
    silindi: durum === "silinen",
    // "Calisanlar (aktif)" = kart aktif VE isten cikis tarihi gecmemis.
    // Yalniz `aktif` bakilsaydi, cikis tarihi girilip kart pasife alinmayan
    // (form yalnizca ipucu veriyor, zorlamiyor) personel calisanlar
    // listesinde kalir, alt satirdaki MAAS TOPLAMINA da eklenirdi.
    // Ayrilanlar kendi suzgecinde ("Isten ayrilanlar") gorunmeye devam ediyor.
    // AND icinde: asagidaki arama suzgeci ust duzey `OR` kullaniyor, ikisi
    // ayni anahtari paylasirsa biri digerini eziyordu.
    ...(durum === "aktif"
      ? {
          aktif: true,
          AND: [
            { OR: [{ istenCikisTarihi: null }, { istenCikisTarihi: { gt: new Date() } }] },
          ],
        }
      : {}),
    ...(durum === "pasif" ? { aktif: false } : {}),
    // "İşten çıkmışlar": çıkış tarihi dolu olanlar. Kart pasife alınmamış
    // olabilir, bu yüzden aktiflikten bağımsız bir filtre.
    ...(durum === "ayrilan" ? { NOT: { istenCikisTarihi: null } } : {}),
    ...(durum === "borclu" ? { NOT: { bakiye: 0 } } : {}),
    ...(gorev === "__yok__"
      ? { gorevi: null }
      : gorev
        ? { gorevi: gorev }
        : {}),
    ...(arama
      ? {
          OR: aramaKosullari<Prisma.CariWhereInput>(
            ["unvan", "kod", "gorevi", "vergiNo", "telefon", "gsm", "sgkNo"],
            arama
          ),
        }
      : {}),
  }
}

/** Filtreleri adres çubuğu metnine çevirir (dışa aktarma bağlantısı için). */
export function personelFiltreSorgusu(f: PersonelFiltreleri): string {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.durum && f.durum !== "aktif") p.set("durum", f.durum)
  if (f.gorev) p.set("gorev", f.gorev)
  const metin = p.toString()
  return metin ? `?${metin}` : ""
}

/**
 * Görev filtresinin seçenekleri. Görev serbest metin (ayrı tanım tablosu
 * açmadık — servis dükkânında görev adları az ve değişken); listede yalnızca
 * gerçekten kullanılmış olanlar çıksın diye kayıtlardan derleniyor.
 */
export async function gorevSecenekleriGetir(): Promise<string[]> {
  const satirlar = await prisma.cari.findMany({
    where: { turu: "PERSONEL", silindi: false, NOT: { gorevi: null } },
    distinct: ["gorevi"],
    orderBy: { gorevi: "asc" },
    select: { gorevi: true },
  })
  return satirlar.map((s) => s.gorevi!).filter(Boolean)
}
