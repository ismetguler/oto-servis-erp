import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { aramaKosullari } from "@/lib/arama"
import { prisma } from "@/lib/prisma"

/**
 * ÖNCEKİ ONARIMLAR — veri katmanı.
 *
 * Selpar'daki "Önceki Onarımlar" ekranı bir listeleme değil, bir SORU'nun
 * cevabıdır: "bu araca daha önce ne yaptık?". Bu yüzden kabul kartlarını
 * kalemleriyle birlikte çekiyoruz — servis danışmanı "bu balatayı 6 ay önce
 * değiştirmişiz" diyebilsin diye. Tüm Kabuller listesinden farkı bu:
 * orada kalemler yok, burada satır satır var.
 */

/** Aramaya uyan araçlar — hangi aracın geçmişine bakılacağı seçilir. */
export async function gecmisiOlanAraclar(q: string) {
  const arama = q.trim()
  if (arama === "") return []

  return prisma.arac.findMany({
    where: {
      silindi: false,
      OR: [
        { plaka: { contains: arama.replace(/\s+/g, ""), mode: "insensitive" as const } },
        ...aramaKosullari<Prisma.AracWhereInput>(
          ["saseNo", "marka", "model", "cari.unvan"],
          arama
        ),
      ],
    },
    orderBy: { plaka: "asc" },
    take: 30,
    select: {
      id: true,
      plaka: true,
      marka: true,
      model: true,
      sonKm: true,
      cari: { select: { id: true, unvan: true } },
      _count: { select: { kabuller: { where: { silindi: false } } } },
    },
  })
}

type GecmisArgumanlari = {
  aracId?: number
  cariId?: number
  /** Kabul kartından gelindiğinde o kartın kendisi listeye girmesin. */
  haricId?: number
}

/**
 * Geçmiş onarımlar — en yeniden eskiye.
 *
 * İptal kartları da listede kalıyor: "bu iş açılmış ama yapılmamış" bilgisi
 * de geçmişin parçası. Sadece silinenler dışarıda — onlar zaten yok sayılmış
 * kayıtlar.
 */
export async function oncekiOnarimlar({ aracId, cariId, haricId }: GecmisArgumanlari) {
  if (!aracId && !cariId) return []

  const kabuller = await prisma.kabul.findMany({
    where: {
      silindi: false,
      ...(aracId ? { aracId } : {}),
      ...(cariId ? { cariId } : {}),
      ...(haricId ? { id: { not: haricId } } : {}),
    },
    orderBy: [{ girisTarihi: "desc" }, { id: "desc" }],
    take: 200,
    select: {
      id: true,
      kabulNo: true,
      durum: true,
      girisTarihi: true,
      teslimTarihi: true,
      girisKm: true,
      sikayet: true,
      yapilanIsler: true,
      istekTuru: true,
      bakimSekli: true,
      genelToplam: true,
      faturaKesildi: true,
      odendi: true,
      arac: { select: { id: true, plaka: true, marka: true, model: true } },
      cari: { select: { id: true, unvan: true } },
      formen: { select: { ad: true, soyad: true } },
      kalemler: {
        orderBy: { sira: "asc" },
        select: {
          id: true,
          tur: true,
          aciklama: true,
          miktar: true,
          birim: true,
          toplam: true,
          garantili: true,
        },
      },
    },
  })

  // Km farkı ("bir önceki gelişten bu yana kaç km") burada hesaplanıyor:
  // liste zaten tarihe göre sıralı, ikinci bir sorgu atmaya gerek yok.
  // Farklı araçlar karışmasın diye plaka bazında eşleştiriliyor.
  return kabuller.map((k, i) => {
    let onceki: number | null = null
    for (let j = i + 1; j < kabuller.length; j++) {
      if (kabuller[j].arac.id !== k.arac.id) continue
      onceki = kabuller[j].girisKm
      break
    }
    const kmFarki =
      k.girisKm !== null && onceki !== null && k.girisKm >= onceki ? k.girisKm - onceki : null

    return {
      ...k,
      genelToplam: Number(k.genelToplam.toString()),
      kmFarki,
      kalemler: k.kalemler.map((s) => ({
        ...s,
        miktar: Number(s.miktar.toString()),
        toplam: Number(s.toplam.toString()),
      })),
    }
  })
}

export type OncekiOnarim = Awaited<ReturnType<typeof oncekiOnarimlar>>[number]
