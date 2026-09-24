"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { stokSemasi } from "./sema"
import { logKaydet } from "@/lib/log"
import { siradakiNumara } from "@/lib/numarator"
import { prisma } from "@/lib/prisma"
import { yetkiliOturum } from "@/lib/oturum"
import { YetkiHatasi } from "@/lib/yetki"

export type StokFormDurumu = {
  hata?: string
  alanHatalari?: Record<string, string>
}

type Islem = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

function alanHatalariniTopla(sorunlar: readonly { path: PropertyKey[]; message: string }[]) {
  const sonuc: Record<string, string> = {}
  for (const sorun of sorunlar) {
    const alan = String(sorun.path[0] ?? "")
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

/**
 * Stok kartını kaydet (yeni kayıt veya güncelleme).
 * Gizli `id` alanının varlığı ekleme/güncellemeyi ayırır (Cari/İşçilik'teki desen).
 */
export async function stokKaydet(
  _oncekiDurum: StokFormDurumu,
  form: FormData
): Promise<StokFormDurumu> {
  const idMetni = String(form.get("id") ?? "").trim()
  const duzenleme = idMetni !== ""
  const id = duzenleme ? Number(idMetni) : 0
  if (duzenleme && !Number.isInteger(id)) return { hata: "Geçersiz kayıt." }

  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", duzenleme ? "duzelt" : "ekle")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const cozum = stokSemasi.safeParse({
    ...Object.fromEntries(form),
    aktif: form.get("aktif") === "on",
  })

  if (!cozum.success) {
    return {
      hata: "Formda eksik veya hatalı alanlar var.",
      alanHatalari: alanHatalariniTopla(cozum.error.issues),
    }
  }

  const v = cozum.data
  let kayitId: number

  try {
    kayitId = await prisma.$transaction(async (tx) => {
      const kod =
        v.kod ??
        (await siradakiNumara(tx, "STOK_KOD", { varsayilanOnEk: "S", basamak: 6 }))

      const cakisan = await tx.stok.findFirst({
        where: { kod, ...(duzenleme ? { NOT: { id } } : {}) },
        select: { id: true },
      })
      if (cakisan) throw new KodCakismasi(kod)

      const alanlar = {
        kod,
        ad: v.ad,
        barkod: v.barkod ?? null,
        tipi: v.tipi ?? null,
        uretici: v.uretici ?? null,
        ureticiKodu: v.ureticiKodu ?? null,
        orijinalKodu: v.orijinalKodu ?? null,
        muadilNo: v.muadilNo ?? null,
        ozelNo: v.ozelNo ?? null,
        grupKodu: v.grupKodu ?? null,
        urunGrubu: v.urunGrubu ?? null,
        gtipNo: v.gtipNo ?? null,
        // Araç uygunluğu yalnız "Araca Özel Parça" tipinde saklanır; tip
        // değişirse eski değerler temizlenir (kart yanlış araca eşleşmesin).
        uygunMarka: v.tipi === "ARAC" ? (v.uygunMarka ?? null) : null,
        uygunModel: v.tipi === "ARAC" ? (v.uygunModel ?? null) : null,
        uygunYilBas: v.tipi === "ARAC" ? (v.uygunYilBas ?? null) : null,
        uygunYilBit: v.tipi === "ARAC" ? (v.uygunYilBit ?? null) : null,
        birim: v.birim,
        minSeviye: v.minSeviye,
        maxSeviye: v.maxSeviye,
        rafYeri: v.rafYeri ?? null,
        alisFiyat: v.alisFiyat,
        satisFiyat: v.satisFiyat,
        ortalamaMaliyet: v.ortalamaMaliyet,
        kdvOrani: v.kdvOrani,
        paraBirimi: v.paraBirimi,
        desen: v.desen ?? null,
        mevsim: v.mevsim ?? null,
        hizYuk: v.hizYuk ?? null,
        yakitDirenci: v.yakitDirenci ?? null,
        gurultuSeviyesi: v.gurultuSeviyesi ?? null,
        gurultuSinifi: v.gurultuSinifi ?? null,
        resimUrl: v.resimUrl ?? null,
        teknikBilgi: v.teknikBilgi ?? null,
        aciklama: v.aciklama ?? null,
        aktif: v.aktif,
      }

      if (duzenleme) {
        const onceki = await tx.stok.findUnique({ where: { id } })
        if (!onceki || onceki.silindi) throw new BulunamadiHatasi()

        const stok = await tx.stok.update({
          where: { id },
          data: {
            ...alanlar,
            depo: v.depoId ? { connect: { id: v.depoId } } : { disconnect: true },
            guncelleyenId: kullanici.id,
          },
        })
        await acilisMiktariniEsitle(tx, stok.id, v.acilisMiktar)

        await logKaydet({
          islem: "GUNCELLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "stoklar",
          kayitId: stok.id,
          aciklama: `${stok.kod} — ${stok.ad}`,
          eskiDeger: onceki,
          yeniDeger: stok,
        })
        return stok.id
      }

      const stok = await tx.stok.create({
        data: {
          ...alanlar,
          ...(v.depoId ? { depo: { connect: { id: v.depoId } } } : {}),
          olusturanId: kullanici.id,
        },
      })
      await acilisMiktariniEsitle(tx, stok.id, v.acilisMiktar)

      await logKaydet({
        islem: "EKLE",
        kullaniciId: kullanici.id,
        kullaniciKod: kullanici.kod,
        tablo: "stoklar",
        kayitId: stok.id,
        aciklama: `${stok.kod} — ${stok.ad}`,
        yeniDeger: stok,
      })
      return stok.id
    })
  } catch (hata) {
    if (hata instanceof KodCakismasi) {
      return {
        hata: hata.message,
        alanHatalari: { kod: "Bu kod başka bir stokta kullanılıyor." },
      }
    }
    if (hata instanceof BulunamadiHatasi) {
      return { hata: "Stok kaydı bulunamadı; silinmiş olabilir." }
    }
    console.error("Stok kaydedilemedi:", hata)
    return { hata: "Kayıt sırasında beklenmeyen bir hata oluştu." }
  }

  revalidatePath("/stok")
  revalidatePath(`/stok/${kayitId}`)
  redirect(`/stok/${kayitId}?kaydedildi=1`)
}

/**
 * Stok kartını siler veya geri alır. Fiziksel silme YOK: kayıt yalnızca
 * `silindi` işaretlenir — arkasında hareket/evrak kalemleri durabilir.
 */
export async function stokSilmeDurumu(
  id: number,
  silinsin: boolean
): Promise<{ hata?: string }> {
  let kullanici
  try {
    kullanici = await yetkiliOturum("stok", "sil")
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message }
    throw hata
  }

  const onceki = await prisma.stok.findUnique({
    where: { id },
    select: { id: true, kod: true, ad: true, silindi: true },
  })
  if (!onceki) return { hata: "Stok bulunamadı." }

  await prisma.stok.update({
    where: { id },
    data: {
      silindi: silinsin,
      silmeTarihi: silinsin ? new Date() : null,
      guncelleyenId: kullanici.id,
    },
  })

  await logKaydet({
    islem: silinsin ? "SIL" : "GERI_AL",
    kullaniciId: kullanici.id,
    kullaniciKod: kullanici.kod,
    tablo: "stoklar",
    kayitId: id,
    aciklama: `${onceki.kod} — ${onceki.ad}`,
    eskiDeger: onceki,
  })

  revalidatePath("/stok")
  revalidatePath(`/stok/${id}`)
  return {}
}

class KodCakismasi extends Error {
  constructor(kod: string) {
    super(`"${kod}" kodu zaten kullanılıyor.`)
    this.name = "KodCakismasi"
  }
}

class BulunamadiHatasi extends Error {
  constructor() {
    super("Kayıt bulunamadı.")
    this.name = "BulunamadiHatasi"
  }
}

/**
 * Açılış miktarı, kart üzerinde tek bir DEVIR hareketiyle temsil edilir
 * (Cari'deki açılış bakiyesi/ACILIS hareketinin aynısı). `Stok.mevcutMiktar`
 * ise -- stok çıkışlarındaki gibi -- artırma/azaltma ile güncellenir; bu
 * yüzden burada farkın kadarı eklenir/çıkarılır, sıfırdan toplanmaz.
 */
async function acilisMiktariniEsitle(tx: Islem, stokId: number, yeniMiktar: number) {
  const mevcut = await tx.stokHareket.findFirst({
    where: { stokId, tur: "DEVIR" },
    select: { id: true, miktar: true },
  })
  const eskiMiktar = mevcut ? Number(mevcut.miktar.toString()) : 0
  const fark = yeniMiktar - eskiMiktar

  if (yeniMiktar === 0) {
    if (mevcut) await tx.stokHareket.delete({ where: { id: mevcut.id } })
  } else if (mevcut) {
    await tx.stokHareket.update({
      where: { id: mevcut.id },
      data: { miktar: yeniMiktar, aciklama: "Açılış miktarı" },
    })
  } else {
    await tx.stokHareket.create({
      data: {
        stok: { connect: { id: stokId } },
        tur: "DEVIR",
        miktar: yeniMiktar,
        aciklama: "Açılış miktarı",
      },
    })
  }

  if (fark !== 0) {
    await tx.stok.update({
      where: { id: stokId },
      data: { mevcutMiktar: { increment: fark } },
    })
  }
}
