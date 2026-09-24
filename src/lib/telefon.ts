/**
 * Telefon numaraları tek tip biçimde tutulur: `+90 (552) 213 33 81`.
 * Kullanıcı hangi biçimde yazarsa yazsın (boşluklu, tireli, başında 0 ya
 * da 90 ile) rakamlar ayıklanıp aynı kalıba dökülür — cari kartı, kabul
 * formu, fatura vb. her yerde aynı görünüm.
 */
export function telefonFormatla(deger: string): string {
  let rakamlar = deger.replace(/\D/g, "")

  // Baştaki ülke kodu (90) ya da trunk sıfırı (0) yazılmış olabilir.
  if (rakamlar.startsWith("90")) rakamlar = rakamlar.slice(2)
  else if (rakamlar.startsWith("0")) rakamlar = rakamlar.slice(1)

  rakamlar = rakamlar.slice(0, 10)
  if (!rakamlar) return ""

  let sonuc = "+90 (" + rakamlar.slice(0, 3)
  if (rakamlar.length >= 3) sonuc += ")"
  if (rakamlar.length > 3) sonuc += " " + rakamlar.slice(3, 6)
  if (rakamlar.length > 6) sonuc += " " + rakamlar.slice(6, 8)
  if (rakamlar.length > 8) sonuc += " " + rakamlar.slice(8, 10)
  return sonuc
}
