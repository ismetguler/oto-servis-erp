import { NextResponse } from "next/server"

import { logKaydet } from "@/lib/log"
import { logBudamaCalistir } from "@/lib/log-budama"

export const dynamic = "force-dynamic"

/**
 * LOG BUDAMA — korumalı bakım ucu (GUNCELLEMELER madde 8 / SA-6)
 *
 * Vercel Cron ayda bir GET ile çağırır (`vercel.json` > `crons`). Proje
 * env'inde `CRON_SECRET` tanımlıysa Vercel isteğe otomatik
 * `Authorization: Bearer <CRON_SECRET>` başlığı ekler; başka kimse
 * çağıramasın diye burada o başlık doğrulanır.
 *
 * Elle test:
 *   curl -H "Authorization: Bearer YANLIS"  https://<site>/api/bakim/log-budama   -> 401
 *   curl -H "Authorization: Bearer <DOGRU>" https://<site>/api/bakim/log-budama   -> 200 + sonuç
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const gelen = request.headers.get("authorization")

  if (!secret || gelen !== `Bearer ${secret}`) {
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 401 })
  }

  const sonuc = await logBudamaCalistir()

  // Budama kendi işini de loglar — hem denetim izi, hem `/ayar/log` üstündeki
  // "Son otomatik budama" bilgi satırının kaynağı (yeni tablo/alan yok).
  await logKaydet({
    islem: "SIL",
    tablo: "islem_loglari",
    aciklama:
      `otomatik budama: JSON boşaltılan ${sonuc.jsonBosaltilan} · ` +
      `silinen ${sonuc.silinen.toplam} (kısa ${sonuc.silinen.kisa}, orta ${sonuc.silinen.orta}) · ` +
      `${sonuc.sure} ms`,
  })

  return NextResponse.json({ tamam: true, ...sonuc })
}
