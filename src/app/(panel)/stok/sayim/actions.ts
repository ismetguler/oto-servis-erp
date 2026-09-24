"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { sayimOlusturSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type SayimFormDurumu = { hata?: string }

/**
 * Yeni sayım fişi oluşturur — filtreye uyan stoklardan sadece SAYILAN
 * (miktar girilmiş) satırlar kaleme dönüşür. Fiş TASLAK açılır, henüz
 * hiçbir StokHareket yazılmaz; sistem miktarı bu anda donup kalemde
 * saklanır (`sistemMiktar`) — fiş onaylanana kadar geçen sürede stok
 * başka bir işlemle değişse bile fark bu dondurulmuş değere göre hesaplanır.
 */
export async function sayimOlustur(
  _oncekiDurum: SayimFormDurumu,
  form: FormData
): Promise<SayimFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const depoMetni = String(form.get("depoId") ?? "").trim()
  const urunGrubu = String(form.get("urunGrubu") ?? "").trim() || null
  const aciklama = String(form.get("aciklama") ?? "").trim() || null

  const stokIdler = form.getAll("stokId").map(String)
  const miktarlar = form.getAll("sayilanMiktar").map(String)
  const satirlar = stokIdler
    .map((stokId, i) => ({ stokId, sayilanMiktar: miktarlar[i] }))
    .filter((s) => s.sayilanMiktar.trim() !== "")

  const cozum = sayimOlusturSemasi.safeParse({
    depoId: depoMetni ? Number(depoMetni) : null,
    urunGrubu,
    aciklama,
    satirlar,
  })

  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Formda hata var." }
  }
  const v = cozum.data

  let fisId: number
  try {
    fisId = await prisma.$transaction(async (tx) => {
      const stoklar = await tx.stok.findMany({
        where: { id: { in: v.satirlar.map((s) => s.stokId) } },
        select: { id: true, mevcutMiktar: true },
      })
      const sistemMap = new Map(stoklar.map((s) => [s.id, s.mevcutMiktar]))

      // Yıl ön ekte (SY2026-00001): sayaç yıl bazlı sıfırlandığı için yıl ön
      // ekte olmazsa ertesi yıl üretilen SY00001, bu yılınkiyle çakışırdı
      // (Tahsilat fiş numarasındaki desenin aynısı).
      const yil = new Date().getFullYear()
      const onEk = `SY${yil}-`
      await tx.numarator.updateMany({
        where: { tur: "SAYIM", yil, NOT: { onEk: { contains: String(yil) } } },
        data: { onEk },
      })
      const fisNo = await siradakiNumara(tx, "SAYIM", { yilBazli: true, varsayilanOnEk: onEk, basamak: 5 })

      const fis = await tx.sayimFisi.create({
        data: {
          fisNo,
          depoId: v.depoId,
          urunGrubu: v.urunGrubu,
          aciklama: v.aciklama,
          olusturanId: kullanici.id,
        },
      })

      for (const satir of v.satirlar) {
        const sistemMiktar = sistemMap.get(satir.stokId)
        if (sistemMiktar === undefined) continue // stok silinmiş/bulunamadı — atla
        const sistem = Number(sistemMiktar.toString())
        await tx.sayimKalem.create({
          data: {
            sayimFisiId: fis.id,
            stokId: satir.stokId,
            sistemMiktar,
            sayilanMiktar: satir.sayilanMiktar,
            fark: satir.sayilanMiktar - sistem,
          },
        })
      }

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "sayim_fisleri",
        kayitId: fis.id,
        aciklama: `${fis.fisNo} — ${v.satirlar.length} kalem`,
      })

      return fis.id
    })
  } catch (hata) {
    console.error("Sayım fişi oluşturulamadı:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/stok/sayim")
  redirect(`/stok/sayim/${fisId}`)
}

/**
 * Fişi onaylar: her kalemdeki `fark` kadar StokHareket (tur=SAYIM) yazılır
 * ve `Stok.mevcutMiktar` aynı miktarda increment edilir — açılış miktarı
 * eşitlemedeki (`acilisMiktariniEsitle`) increment/decrement mantığının
 * aynısı, farkın işareti (+/-) artış/azalışı zaten kendinde taşıyor.
 * Onaydan sonra fiş kilitlenir; yanlış girilen sayım yeni bir fişle
 * düzeltilir.
 */
export async function sayimOnayla(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const fis = await tx.sayimFisi.findUnique({
        where: { id },
        include: { kalemler: true },
      })
      if (!fis) throw new Error("Sayım fişi bulunamadı.")
      if (fis.durum !== "TASLAK") throw new Error("Bu fiş zaten onaylanmış veya iptal edilmiş.")

      for (const kalem of fis.kalemler) {
        const fark = Number(kalem.fark.toString())
        if (fark === 0) continue

        const stok = await tx.stok.findUnique({ where: { id: kalem.stokId }, select: { depoId: true } })

        await tx.stokHareket.create({
          data: {
            stok: { connect: { id: kalem.stokId } },
            ...(stok?.depoId ? { depo: { connect: { id: stok.depoId } } } : {}),
            tur: "SAYIM",
            miktar: fark,
            sayimFisiId: fis.id,
            aciklama: `Sayım fişi ${fis.fisNo} — sistem ${kalem.sistemMiktar}, sayılan ${kalem.sayilanMiktar}`,
            kullaniciId: kullanici.id,
          },
        })

        await tx.stok.update({
          where: { id: kalem.stokId },
          data: { mevcutMiktar: { increment: fark } },
        })
      }

      const guncelFis = await tx.sayimFisi.update({
        where: { id: fis.id },
        data: { durum: "ONAYLANDI", onaylayanId: kullanici.id, onayTarihi: new Date() },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "sayim_fisleri",
        kayitId: fis.id,
        aciklama: `${fis.fisNo} onaylandı — ${fis.kalemler.length} kalem işlendi`,
        yeniDeger: guncelFis,
      })
    })
  } catch (hata) {
    console.error("Sayım fişi onaylanamadı:", hata)
    return { hata: hata instanceof Error ? hata.message : "Onaylama sırasında hata oluştu." }
  }

  revalidatePath("/stok/sayim")
  revalidatePath(`/stok/sayim/${id}`)
  revalidatePath("/stok")
  return {}
}

/** TASLAK fişi iptal eder — henüz hiçbir StokHareket yazılmadığı için kalemler dahil kalıcı silinmez, yalnızca durum değişir. */
export async function sayimIptalEt(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const fis = await prisma.sayimFisi.findUnique({ where: { id }, select: { durum: true, fisNo: true } })
  if (!fis) return { hata: "Sayım fişi bulunamadı." }
  if (fis.durum !== "TASLAK") return { hata: "Yalnızca taslak fişler iptal edilebilir." }

  await prisma.sayimFisi.update({ where: { id }, data: { durum: "IPTAL" } })
  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "sayim_fisleri",
    kayitId: id,
    aciklama: `${fis.fisNo} iptal edildi`,
  })

  revalidatePath("/stok/sayim")
  revalidatePath(`/stok/sayim/${id}`)
  return {}
}
