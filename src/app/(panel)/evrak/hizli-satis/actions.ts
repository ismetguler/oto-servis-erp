"use server";

import { revalidatePath } from "next/cache";

import { hizliSatisSemasi } from "./sema";
import { parcaOku, perakendeMusteriIdGetir } from "./veri";
import { bakiyeyiHesapla } from "@/app/(panel)/cari/actions";
import {
  evrakStoklariniDus,
  evrakToplamlariniYenile,
} from "@/app/(panel)/evrak/satis/stok-islem";
import {
  cariEtkisiniYaz,
  cekSenetEtkisiniYaz,
  fisNumarasi,
  kasaEtkisiniYaz,
} from "@/app/(panel)/tahsilat/actions";
import { kasaGerektirir } from "@/app/(panel)/tahsilat/sema";
import { para } from "@/lib/bicim";
import { kalemHesapla } from "@/lib/hesap";
import { logKaydet } from "@/lib/log";
import { siradakiNumara } from "@/lib/numarator";
import { yetkiliOturum } from "@/lib/oturum";
import { prisma } from "@/lib/prisma";
import { YetkiHatasi } from "@/lib/yetki";

/**
 * HIZLI SATIŞ / PERAKENDE — yazma tarafı (adım 9.3)
 *
 * Tek ekran, tek işlem: sepet Kabul Parça Çıkışı'ndaki gibi barkodla
 * doldurulur ama satır satır DB'ye yazılmaz (taslak evrak açıp satır satır
 * kaydetmek tezgâh üstünde gereksiz gidiş-geliş olurdu) — sepet tarayıcıda
 * tutulur, "Satışı Tamamla" tek transaction'da:
 *   evrak (PERAKENDE, doğrudan KESİLDİ) → stok düşümü → cari borç →
 *   tahsilat fişi → cari/kasa/çek-senet etkisi.
 * Tahsilat tarafı 6.1'in `cariEtkisiniYaz`/`kasaEtkisiniYaz`/
 * `cekSenetEtkisiniYaz`/`fisNumarasi` fonksiyonlarını AYNEN kullanıyor —
 * ikinci bir tahsilat yazma yolu açılsaydı bakiye hesabı ikiye ayrılırdı.
 */

export type HizliSatisDurumu = {
  hata?: string;
  basarili?: string;
  evrakNo?: string;
  fisNo?: string;
};

class IsKuraliHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "IsKuraliHatasi";
  }
}

/** Barkod/kod okuma — parça çıkışı ve stok barkod aramasıyla aynı motor. */
export async function hizliSatisBarkodAra(metin: string) {
  await yetkiliOturum("evrak", "gor");
  return parcaOku(metin);
}

export async function hizliSatisTamamla(
  _oncekiDurum: HizliSatisDurumu,
  form: FormData,
): Promise<HizliSatisDurumu> {
  let kullanici;
  try {
    kullanici = await yetkiliOturum("evrak", "ekle");
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    throw hata;
  }

  const cozum = hizliSatisSemasi.safeParse(Object.fromEntries(form));
  if (!cozum.success) {
    return {
      hata: cozum.error.issues[0]?.message ?? "Formda hatalı alanlar var.",
    };
  }
  const v = cozum.data;

  const kasaId = kasaGerektirir(v.odemeSekli) ? (v.kasaId ?? null) : null;

  let sonuc: { evrakNo: string; fisNo: string; tutar: number };
  try {
    sonuc = await prisma.$transaction(
      async (tx) => {
        const cariId = v.cariId ?? (await perakendeMusteriIdGetir(tx));
        const cari = await tx.cari.findUnique({
          where: { id: cariId },
          select: { id: true, unvan: true, silindi: true },
        });
        if (!cari || cari.silindi)
          throw new IsKuraliHatasi("Seçilen müşteri bulunamadı.");

        if (kasaId) {
          const kasa = await tx.kasa.findUnique({
            where: { id: kasaId },
            select: { id: true, aktif: true, silindi: true },
          });
          if (!kasa || kasa.silindi)
            throw new IsKuraliHatasi("Seçilen kasa bulunamadı.");
          if (!kasa.aktif)
            throw new IsKuraliHatasi("Pasif kasaya işlem yapılamaz.");
        }

        const yil = new Date().getFullYear();
        const evrakNo = await siradakiNumara(tx, "PERAKENDE", {
          yilBazli: true,
          varsayilanOnEk: `PR${yil}-`,
          basamak: 5,
        });

        const evrak = await tx.evrak.create({
          data: {
            evrakNo,
            tur: "PERAKENDE",
            cari: { connect: { id: cariId } },
            olusturanId: kullanici.id,
          },
        });

        let sira = 0;
        for (const k of v.kalemler) {
          sira += 1;
          // Adım 11.8 düzeltmesi: `evrakToplamlariniYenile` yalnız Evrak
          // BAŞLIĞINI (araToplam/kdvToplam/genelToplam) günceller, satır
          // düzeyindeki tutar/kdvTutar/toplam'a hiç dokunmaz (bkz. o
          // fonksiyonun kendisi, `stok-islem.ts`) — buradaki eski yorum
          // yanlıştı. Satır alanları burada YAZILMAZSA baskı şablonları
          // (Fiş, adım 11.8) ve ileride açılacak her satır bazlı rapor 0
          // görürdü; normal fatura akışındaki `kalemKaydet` (evrak/satis/
          // actions.ts) ile AYNI hesap tek satırda burada da yapılıyor.
          const hesap = kalemHesapla(k);
          await tx.evrakKalem.create({
            data: {
              evrak: { connect: { id: evrak.id } },
              sira,
              ...(k.stokId ? { stok: { connect: { id: k.stokId } } } : {}),
              aciklama: k.aciklama,
              birim: k.birim,
              miktar: k.miktar,
              birimFiyat: k.birimFiyat,
              kdvOrani: k.kdvOrani,
              tutar: hesap.tutar,
              kdvTutar: hesap.kdvTutar,
              toplam: hesap.toplam,
            },
          });
        }

        const toplam = await evrakToplamlariniYenile(tx, evrak.id);
        if (toplam.genelToplam <= 0)
          throw new IsKuraliHatasi("Satış toplamı sıfırdan büyük olmalı.");

        await evrakStoklariniDus(tx, evrak.id, evrakNo, kullanici.id);
        await tx.evrak.update({
          where: { id: evrak.id },
          data: { durum: "KESILDI", guncelleyenId: kullanici.id },
        });

        await tx.cariHareket.create({
          data: {
            cari: { connect: { id: cariId } },
            evrak: { connect: { id: evrak.id } },
            tur: "EVRAK",
            borc: toplam.genelToplam,
            aciklama: `Perakende satış ${evrakNo}`,
            olusturanId: kullanici.id,
          },
        });

        // Tahsilat: tezgâh üstünde kısmi ödeme yok, tutar her zaman satış
        // toplamı — 6.1'deki normal tahsilat yolu tek satırda kapatılıyor.
        const fisNo = await fisNumarasi(tx, "TAHSILAT");
        const tahsilat = await tx.tahsilat.create({
          data: {
            cariId,
            tur: "TAHSILAT",
            fisNo,
            tarih: new Date(),
            tutar: toplam.genelToplam,
            odemeSekli: v.odemeSekli,
            kasaId,
            evrakId: evrak.id,
            posBanka:
              v.odemeSekli === "KREDI_KARTI" ? (v.posBanka ?? null) : null,
            posKartSahibi:
              v.odemeSekli === "KREDI_KARTI" ? (v.posKartSahibi ?? null) : null,
            posSon4:
              v.odemeSekli === "KREDI_KARTI" ? (v.posSon4 ?? null) : null,
            posProvizyon:
              v.odemeSekli === "KREDI_KARTI" ? (v.posProvizyon ?? null) : null,
            posTaksit:
              v.odemeSekli === "KREDI_KARTI" ? (v.posTaksit ?? null) : null,
            aciklama: `${evrakNo} hızlı satış tahsilatı${v.aciklama ? ` — ${v.aciklama}` : ""}`,
            olusturanId: kullanici.id,
          },
        });

        await cariEtkisiniYaz(tx, tahsilat, kullanici.id);
        // `kasaEtkisiniYaz` kasasız ödeme şekillerinde (çek/senet/mahsup)
        // zaten hiçbir şey yazmıyor, `kasaId` kontrolüne burada gerek yok —
        // fonksiyonun kendi içindeki `kasaGerektirir` kontrolü yeterli.
        await kasaEtkisiniYaz(tx, tahsilat, kullanici.id);
        await cekSenetEtkisiniYaz(
          tx,
          tahsilat,
          {
            cekVadeTarihi: v.cekVadeTarihi,
            cekBelgeNo: v.cekBelgeNo,
            cekBanka: v.cekBanka,
            cekBorclu: v.cekBorclu,
          },
          kullanici.id,
          kullanici.kod,
        );
        await bakiyeyiHesapla(tx, cariId);

        await logKaydet({
          islem: "EKLE",
          kullaniciId: kullanici.id,
          kullaniciKod: kullanici.kod,
          tablo: "evraklar",
          kayitId: evrak.id,
          aciklama: `${evrakNo} hızlı satış — ${cari.unvan} — ${toplam.genelToplam.toFixed(2)} TL`,
          yeniDeger: evrak,
        });

        return { evrakNo, fisNo: tahsilat.fisNo, tutar: toplam.genelToplam };
      },
      // Varsayılan 5 sn zaman aşımı burada dar geliyor: tek satışta evrak +
      // sepetteki her kalem + stok düşümü + tahsilat/kasa/çek-senet etkisi
      // hepsi TEK transaction'da (diğer modüllerde bunlar ayrı kullanıcı
      // eylemleri olarak bölünmüştü). Sepet büyükse Neon'a gidiş-geliş
      // toplamı 5 sn'yi rahat aşıyor.
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (hata) {
    if (hata instanceof IsKuraliHatasi) return { hata: hata.message };
    console.error("Hızlı satış tamamlanamadı:", hata);
    return { hata: "İşlem tamamlanamadı." };
  }

  revalidatePath("/evrak/satis");
  revalidatePath("/stok");
  revalidatePath("/tahsilat");
  revalidatePath("/kasa");
  revalidatePath("/kasa/defter");
  revalidatePath("/cek-senet");
  revalidatePath("/cari");

  return {
    basarili: `${sonuc.evrakNo} kesildi, ${para(sonuc.tutar)} tahsil edildi (${sonuc.fisNo}).`,
    evrakNo: sonuc.evrakNo,
    fisNo: sonuc.fisNo,
  };
}
