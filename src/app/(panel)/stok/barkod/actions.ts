"use server"

import { parcaOku } from "@/app/(panel)/servis/parca-cikis/veri"
import { yetkiliOturum } from "@/lib/oturum"

/**
 * Barkod/kod okuma — Kabul Parça Çıkışı'ndaki `parcaOku` motorunun aynısı
 * (tam eşleşme önce denenir, yoksa geniş arama). Burada yeniden yazmıyoruz,
 * sadece stok modülü yetkisiyle sarmalıyoruz: parça çıkışı "servis" yetkisi
 * ister, stoktan arama ise "stok/gör" yeterli olmalı.
 */
export async function stokBarkodAra(metin: string) {
  await yetkiliOturum("stok", "gor")
  return parcaOku(metin)
}
