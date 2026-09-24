import type { Metadata } from "next"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { DisaAktarDugmesi, YazdirDugmesi } from "@/components/rapor-araclari"
import { plaka, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Garanti / Sigorta Takibi" }
export const dynamic = "force-dynamic"

/**
 * GARANTİ / SİGORTA TAKİBİ — Selpar'daki aynı isimli raporun karşılığı.
 *
 * Araç listesini tekrar yazmak yerine, tarihi geçmiş VEYA önümüzdeki 30 gün
 * içinde dolacak her takip alanını (trafik sigortası, kasko, garanti,
 * muayene, akü, LPG tank) tek satıra indirip en yakın tarihe göre sıralıyor
 * — servis danışmanı "hangi araca dokunmam lazım" sorusunu tek bakışta görsün.
 */
export default async function GarantiSigortaTakibi() {
  await yetkiliOturum("arac", "gor")

  const bugun = new Date()
  const otuzGunSonra = new Date(bugun)
  otuzGunSonra.setDate(otuzGunSonra.getDate() + 30)

  const araclar = await prisma.arac.findMany({
    where: {
      silindi: false,
      aktif: true,
      OR: [
        { trafikSigBitis: { lte: otuzGunSonra } },
        { kaskoBitis: { lte: otuzGunSonra } },
        { garantiBitis: { lte: otuzGunSonra } },
        { muayeneBitis: { lte: otuzGunSonra } },
        { akuBitis: { lte: otuzGunSonra } },
        { lpgTankSonTarih: { lte: otuzGunSonra } },
      ],
    },
    select: {
      id: true,
      plaka: true,
      marka: true,
      model: true,
      trafikSigBitis: true,
      kaskoBitis: true,
      garantiBitis: true,
      muayeneBitis: true,
      akuBitis: true,
      lpgTankSonTarih: true,
      cari: { select: { unvan: true, telefon: true, gsm: true } },
    },
  })

  type Satir = {
    aracId: number
    plaka: string
    aracAdi: string
    sahip: string
    telefon: string
    tur: string
    tarih: Date
    gecmis: boolean
  }

  const satirlar: Satir[] = araclar
    .flatMap((a) => {
      const aday: Array<[string, Date | null]> = [
        ["Trafik Sigortası", a.trafikSigBitis],
        ["Kasko", a.kaskoBitis],
        ["Garanti", a.garantiBitis],
        ["Muayene", a.muayeneBitis],
        ["Akü Garantisi", a.akuBitis],
        ["LPG Tank Muayenesi", a.lpgTankSonTarih],
      ]
      return aday
        .filter(([, tarihDegeri]) => tarihDegeri && tarihDegeri <= otuzGunSonra)
        .map(([tur, tarihDegeri]) => ({
          aracId: a.id,
          plaka: a.plaka,
          aracAdi: [a.marka, a.model].filter(Boolean).join(" "),
          sahip: a.cari?.unvan ?? "—",
          telefon: a.cari?.gsm ?? a.cari?.telefon ?? "—",
          tur,
          tarih: tarihDegeri as Date,
          gecmis: (tarihDegeri as Date) < bugun,
        }))
    })
    .sort((a, b) => a.tarih.getTime() - b.tarih.getTime())

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="flex items-center gap-1.5 text-[1.0625rem] font-semibold tracking-tight">
            <ShieldAlert className="size-5" aria-hidden />
            Garanti / Sigorta Takibi
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Süresi geçmiş veya önümüzdeki 30 gün içinde dolacak {satirlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YazdirDugmesi />
          <DisaAktarDugmesi yol="/arac/disa-aktar" etiket="Araç Listesini Aktar" />
        </div>
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {satirlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <ShieldAlert className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">Yaklaşan bir süre dolumu yok</p>
              <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
                Sigorta, kasko, garanti, muayene, akü ve LPG tank tarihleri önümüzdeki
                30 gün için temiz.
              </p>
            </div>
          ) : (
            <div className="yazdirma-alani max-h-[calc(100svh-14rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Plaka</th>
                    <th>Araç</th>
                    <th>Sahibi</th>
                    <th>Telefon</th>
                    <th>Takip Türü</th>
                    <th>Bitiş Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((s, i) => (
                    <tr key={`${s.aracId}-${s.tur}-${i}`}>
                      <td className="font-mono text-[0.75rem]">
                        <Link href={`/arac/${s.aracId}`} className="text-primary hover:underline">
                          {plaka(s.plaka)}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{s.aracAdi || "—"}</td>
                      <td className="max-w-[14rem] truncate">{s.sahip}</td>
                      <td>{s.telefon}</td>
                      <td>{s.tur}</td>
                      <td className={s.gecmis ? "font-medium text-tehlike" : ""}>
                        {tarih(s.tarih)}
                        {s.gecmis ? " · süresi geçmiş" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
