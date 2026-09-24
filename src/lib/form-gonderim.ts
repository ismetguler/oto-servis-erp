"use client"

import { startTransition } from "react"

/**
 * FORM GÖNDERİMİ — "hata dönünce form boşalmasın"
 *
 * React 19, `<form action={fn}>` ile gönderilen bir formu action bittikten
 * sonra SIFIRLIYOR; başarı da hata da fark etmiyor. Sunucu "Tutar sıfırdan
 * büyük olmalı." dediğinde kullanıcı tutarı, tarihi, açıklamayı, seçtiği
 * kasayı yeniden yazmak zorunda kalıyordu (6.1'den beri süren şikâyet).
 *
 * `action` yerine kendi `onSubmit`'imizi bağlayınca React formu sıfırlamıyor:
 * girilen her şey (input, select, textarea, checkbox — hepsi) olduğu gibi
 * duruyor, kullanıcı yalnızca hatalı alana dokunuyor.
 *
 * Başarıdan sonra formun boşalması İSTENEN yerlerde (tanım listeleri gibi
 * aynı ekranda arka arkaya kayıt açılan formlar) sıfırlama zaten elle
 * `formRef.current?.reset()` ile yapılıyor — o davranış korunuyor.
 *
 * Kaybolan tek şey JavaScript kapalıyken gönderim; bu ekranların hepsi
 * zaten `useState`'e bağlı istemci bileşeni, JS'siz çalışmıyorlardı.
 *
 * Kullanım: `<form onSubmit={(olay) => formGonderimi(olay, gonder)}>`.
 * Render sırasında değil olay anında çağrılıyor: içinde `formRef` okuyan
 * gönderim fonksiyonları `react-hooks/refs` kuralına takılmasın diye.
 */
export function formGonderimi(
  olay: React.FormEvent<HTMLFormElement>,
  gonder: (form: FormData) => void
) {
  olay.preventDefault()
  // Gönderen düğme name/value taşıyorsa (çok düğmeli formlar) FormData'ya
  // girmesi için submitter'ı vermek şart.
  const submitter = (olay.nativeEvent as SubmitEvent).submitter
  const form = new FormData(
    olay.currentTarget,
    submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
      ? submitter
      : undefined
  )
  startTransition(() => gonder(form))
}
