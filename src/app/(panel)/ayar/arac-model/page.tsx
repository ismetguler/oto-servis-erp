import type { Metadata } from "next"

import { aracModelEkraniVerisi } from "./veri"
import { AracModelYonetim } from "@/components/ayar/arac-model-yonetim"
import { DisaAktarDugmesi } from "@/components/rapor-araclari"
import { yetkiliOturum } from "@/lib/oturum"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Araç Modelleri" }
export const dynamic = "force-dynamic"

/**
 * AYARLAR > ARAÇ MODELLERİ (SA-5 / madde 15)
 *
 * Stok "Araca Özel Parça" tipi ve Araç kartındaki marka/model alanları bu
 * katalogdan beslenir. Hazır liste dış açık veriden seed'lenir ve
 * `kilitli = true`'dur — bu ekrandan değiştirilemez. Kullanıcı yalnızca
 * elle yeni marka/model ekler.
 */
export default async function AracModelSayfasi() {
  const kullanici = await yetkiliOturum("ayar", "gor")
  const veri = await aracModelEkraniVerisi()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Araç Modelleri</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Stok ve araç kartlarındaki marka / model listesi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DisaAktarDugmesi yol="/ayar/arac-model/disa-aktar" etiket="Elle Eklenenler — Excel" />
          <DisaAktarDugmesi yol="/ayar/arac-model/disa-aktar?tumu=1" etiket="Tüm Katalog — Excel" />
        </div>
      </div>

      <div className="p-4">
        <AracModelYonetim
          markalar={veri.markalar}
          elle={veri.elle}
          hazirSayi={veri.hazirSayi}
          ekleyebilir={yetkiVar(kullanici, "ayar", "ekle")}
          duzeltebilir={yetkiVar(kullanici, "ayar", "duzelt")}
          silebilir={yetkiVar(kullanici, "ayar", "sil")}
        />
      </div>
    </div>
  )
}
