"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { transferOlusturSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type TransferFormDurumu = { hata?: string }

/**
 * Yeni transfer fişi oluşturur — seçilen stok kartları kaleme dönüşür,
 * fiş TASLAK açılır, henüz hiçbir StokHareket yazılmaz/depoId değişmez.
 * Kalemin `miktar`ı burada yalnız BİLGİ amaçlı yazılır (o anki mevcut
 * miktar); gerçek/güncel miktar onay anında tekrar okunur (bkz. actions
 * `transferOnayla`) — sayımdaki "donmuş sistem miktarı" mantığından farklı
 * olarak burada kart taşınıyor, sayım yapılmıyor.
 */
export async function transferOlustur(
  _oncekiDurum: TransferFormDurumu,
  form: FormData
): Promise<TransferFormDurumu> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = transferOlusturSemasi.safeParse({
    kaynakDepoId: form.get("kaynakDepoId"),
    hedefDepoId: form.get("hedefDepoId"),
    aciklama: String(form.get("aciklama") ?? "").trim() || null,
    stokIdler: form.getAll("stokId"),
  })

  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Formda hata var." }
  }
  const v = cozum.data

  let fisId: number
  try {
    fisId = await prisma.$transaction(async (tx) => {
      const stoklar = await tx.stok.findMany({
        where: { id: { in: v.stokIdler }, depoId: v.kaynakDepoId, silindi: false },
        select: { id: true, mevcutMiktar: true },
      })
      if (stoklar.length === 0) throw new Error("Seçili stok kartları kaynak depoda bulunamadı.")

      const yil = new Date().getFullYear()
      const onEk = `TR${yil}-`
      await tx.numarator.updateMany({
        where: { tur: "TRANSFER", yil, NOT: { onEk: { contains: String(yil) } } },
        data: { onEk },
      })
      const fisNo = await siradakiNumara(tx, "TRANSFER", { yilBazli: true, varsayilanOnEk: onEk, basamak: 5 })

      const fis = await tx.stokTransferFisi.create({
        data: {
          fisNo,
          kaynakDepoId: v.kaynakDepoId,
          hedefDepoId: v.hedefDepoId,
          aciklama: v.aciklama,
          olusturanId: kullanici.id,
        },
      })

      for (const stok of stoklar) {
        await tx.stokTransferKalem.create({
          data: { stokTransferFisiId: fis.id, stokId: stok.id, miktar: stok.mevcutMiktar },
        })
      }

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "stok_transfer_fisleri",
        kayitId: fis.id,
        aciklama: `${fis.fisNo} — ${stoklar.length} kart`,
      })

      return fis.id
    })
  } catch (hata) {
    console.error("Transfer fişi oluşturulamadı:", hata)
    return { hata: hata instanceof Error ? hata.message : "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/stok/transfer")
  redirect(`/stok/transfer/${fisId}`)
}

/**
 * Fişi onaylar: her kalem için kaynak depoda CIKIS + hedef depoda TRANSFER
 * (giriş) olmak üzere çift StokHareket yazılır, kartın `depoId`si hedef
 * depoya taşınır. `mevcutMiktar` toplamı DEĞİŞMEZ (kart taşındı, miktar
 * aynı) — bu yüzden stok.update yalnız depoId'yi günceller. Onaydan sonra
 * fiş kilitlenir; geri almak için `transferGeriAl` kullanılır.
 */
export async function transferOnayla(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const fis = await tx.stokTransferFisi.findUnique({
        where: { id },
        include: { kalemler: true },
      })
      if (!fis) throw new Error("Transfer fişi bulunamadı.")
      if (fis.durum !== "TASLAK") throw new Error("Bu fiş zaten onaylanmış, iptal edilmiş veya geri alınmış.")

      for (const kalem of fis.kalemler) {
        const stok = await tx.stok.findUnique({
          where: { id: kalem.stokId },
          select: { depoId: true, mevcutMiktar: true },
        })
        if (!stok) continue // kart silinmiş — atla
        if (stok.depoId !== fis.kaynakDepoId) {
          throw new Error("Kalemlerden biri fiş açıldıktan sonra başka bir depoya taşınmış, bu fiş onaylanamaz.")
        }

        const canliMiktar = stok.mevcutMiktar

        if (Number(canliMiktar.toString()) > 0) {
          await tx.stokHareket.create({
            data: {
              stok: { connect: { id: kalem.stokId } },
              depo: { connect: { id: fis.kaynakDepoId } },
              tur: "CIKIS",
              miktar: canliMiktar,
              aciklama: `Depo transferi ${fis.fisNo} — çıkış`,
              kullaniciId: kullanici.id,
            },
          })
          await tx.stokHareket.create({
            data: {
              stok: { connect: { id: kalem.stokId } },
              depo: { connect: { id: fis.hedefDepoId } },
              tur: "TRANSFER",
              miktar: canliMiktar,
              aciklama: `Depo transferi ${fis.fisNo} — giriş`,
              kullaniciId: kullanici.id,
            },
          })
        }

        await tx.stok.update({ where: { id: kalem.stokId }, data: { depoId: fis.hedefDepoId } })
        await tx.stokTransferKalem.update({ where: { id: kalem.id }, data: { miktar: canliMiktar } })
      }

      const guncelFis = await tx.stokTransferFisi.update({
        where: { id: fis.id },
        data: { durum: "ONAYLANDI", onaylayanId: kullanici.id, onayTarihi: new Date() },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "stok_transfer_fisleri",
        kayitId: fis.id,
        aciklama: `${fis.fisNo} onaylandı — ${fis.kalemler.length} kart taşındı`,
        yeniDeger: guncelFis,
      })
    })
  } catch (hata) {
    console.error("Transfer fişi onaylanamadı:", hata)
    return { hata: hata instanceof Error ? hata.message : "Onaylama sırasında hata oluştu." }
  }

  revalidatePath("/stok/transfer")
  revalidatePath(`/stok/transfer/${id}`)
  revalidatePath("/stok")
  return {}
}

/** TASLAK fişi iptal eder — henüz hiçbir StokHareket yazılmadığı için kalemler dahil kalıcı silinmez, yalnızca durum değişir. */
export async function transferIptalEt(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const fis = await prisma.stokTransferFisi.findUnique({ where: { id }, select: { durum: true, fisNo: true } })
  if (!fis) return { hata: "Transfer fişi bulunamadı." }
  if (fis.durum !== "TASLAK") return { hata: "Yalnızca taslak fişler iptal edilebilir." }

  await prisma.stokTransferFisi.update({ where: { id }, data: { durum: "IPTAL" } })
  await logKaydet({
    islem: "GUNCELLE",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stok_transfer_fisleri",
    kayitId: id,
    aciklama: `${fis.fisNo} iptal edildi`,
  })

  revalidatePath("/stok/transfer")
  revalidatePath(`/stok/transfer/${id}`)
  return {}
}

/**
 * Onaylanmış bir fişi geri alır: her kalem hedef depodan kaynak depoya
 * TERS yönde taşınır (yine çift StokHareket, tek transaction). Orijinal
 * fişin kalemleri/hareketleri SİLİNMEZ — tarihsel kayıt korunur, yalnız
 * fişin durumu GERI_ALINDI'ya döner (Sayım modülündeki "geçmişe dokunma,
 * telafi eden yeni kayıt yaz" ilkesinin aynısı).
 */
export async function transferGeriAl(id: number): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "duzelt")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  try {
    await prisma.$transaction(async (tx) => {
      const fis = await tx.stokTransferFisi.findUnique({
        where: { id },
        include: { kalemler: true },
      })
      if (!fis) throw new Error("Transfer fişi bulunamadı.")
      if (fis.durum !== "ONAYLANDI") throw new Error("Yalnızca onaylanmış fişler geri alınabilir.")

      for (const kalem of fis.kalemler) {
        const stok = await tx.stok.findUnique({
          where: { id: kalem.stokId },
          select: { depoId: true },
        })
        if (!stok) continue
        if (stok.depoId !== fis.hedefDepoId) {
          throw new Error("Kalemlerden biri onaydan sonra başka bir depoya taşınmış, bu fiş geri alınamaz.")
        }

        if (Number(kalem.miktar.toString()) > 0) {
          await tx.stokHareket.create({
            data: {
              stok: { connect: { id: kalem.stokId } },
              depo: { connect: { id: fis.hedefDepoId } },
              tur: "CIKIS",
              miktar: kalem.miktar,
              aciklama: `Depo transferi ${fis.fisNo} — geri alma çıkışı`,
              kullaniciId: kullanici.id,
            },
          })
          await tx.stokHareket.create({
            data: {
              stok: { connect: { id: kalem.stokId } },
              depo: { connect: { id: fis.kaynakDepoId } },
              tur: "TRANSFER",
              miktar: kalem.miktar,
              aciklama: `Depo transferi ${fis.fisNo} — geri alma girişi`,
              kullaniciId: kullanici.id,
            },
          })
        }

        await tx.stok.update({ where: { id: kalem.stokId }, data: { depoId: fis.kaynakDepoId } })
      }

      const guncelFis = await tx.stokTransferFisi.update({
        where: { id: fis.id },
        data: { durum: "GERI_ALINDI", geriAlanId: kullanici.id, geriAlmaTarihi: new Date() },
      })

      await logKaydet({
        islem: "GUNCELLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "stok_transfer_fisleri",
        kayitId: fis.id,
        aciklama: `${fis.fisNo} geri alındı — ${fis.kalemler.length} kart eski depoya döndü`,
        yeniDeger: guncelFis,
      })
    })
  } catch (hata) {
    console.error("Transfer fişi geri alınamadı:", hata)
    return { hata: hata instanceof Error ? hata.message : "Geri alma sırasında hata oluştu." }
  }

  revalidatePath("/stok/transfer")
  revalidatePath(`/stok/transfer/${id}`)
  revalidatePath("/stok")
  return {}
}
