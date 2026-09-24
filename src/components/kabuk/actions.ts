"use server"

import { redirect } from "next/navigation"

import { signOut } from "@/lib/auth"
import { logKaydet } from "@/lib/log"
import { oturumKullanicisi } from "@/lib/oturum"

/** Oturumu kapatir ve giris ekranina doner. Cikis da loglanir. */
export async function cikisYap() {
  const kullanici = await oturumKullanicisi()
  if (kullanici) {
    await logKaydet({
      islem: "CIKIS",
      kullaniciId: kullanici.id,
      kullaniciKod: kullanici.kod,
      tablo: "kullanicilar",
      kayitId: kullanici.id,
    })
  }
  await signOut({ redirect: false })
  redirect("/giris")
}
