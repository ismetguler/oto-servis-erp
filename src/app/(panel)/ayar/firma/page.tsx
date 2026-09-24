import type { Metadata } from "next"

import { firmaBilgisi } from "./veri"
import { FirmaFormu } from "@/components/ayar/firma-formu"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Firma Bilgileri" }
export const dynamic = "force-dynamic"

/**
 * TEK EKRAN — liste/detay yok, doğrudan düzenlenebilir form. `Firma.id`
 * her zaman 1; kayıt yoksa (ilk açılış) form boş gösterilir, "yeni kayıt"
 * kavramı bilinçli olarak yok (bkz. adım 11.3 planı).
 */
export default async function FirmaBilgileriSayfasi() {
  await yetkiliOturum("ayar", "gor")

  const firma = await firmaBilgisi()

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Firma Bilgileri</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Fatura ve rapor başlıklarında kullanılacak firma kaydı
          </p>
        </div>
      </div>

      <FirmaFormu
        baslangic={
          firma
            ? {
                unvan: firma.unvan,
                vergiNo: firma.vergiNo,
                vergiDair: firma.vergiDair,
                adres: firma.adres,
                il: firma.il,
                ilce: firma.ilce,
                telefon: firma.telefon,
                gsm: firma.gsm,
                email: firma.email,
                webAdresi: firma.webAdresi,
                logoUrl: firma.logoUrl,
                logo: firma.logo,
                bankaAdi: firma.bankaAdi,
                ibanNo: firma.ibanNo,
                varsayilanKdv: firma.varsayilanKdv.toString(),
                paraBirimi: firma.paraBirimi,
              }
            : null
        }
      />
    </div>
  )
}
