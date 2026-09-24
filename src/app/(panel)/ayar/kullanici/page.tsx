import type { Metadata } from "next"
import Link from "next/link"
import { Plus, Users } from "lucide-react"

import { kilitliMi, kullaniciListeKosulu } from "./veri"
import { KullaniciDurumDugmesi } from "@/components/ayar/kullanici-durum-dugmesi"
import { KullaniciFiltre } from "@/components/ayar/kullanici-filtre"
import { DisaAktarDugmesi } from "@/components/rapor-araclari"
import { Button } from "@/components/ui/button"
import { tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { prisma } from "@/lib/prisma"
import { ROL_ADLARI, yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Kullanıcılar" }
export const dynamic = "force-dynamic"

export default async function KullaniciListesi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rol?: string; durum?: string }>
}) {
  const kullanici = await yetkiliOturum("ayar", "gor")
  const p = await searchParams

  const q = (p.q ?? "").trim()
  const rol = p.rol ?? ""
  const durum = p.durum ?? "aktif"

  const kosul = kullaniciListeKosulu({ q, rol, durum })

  const kayitlar = await prisma.kullanici.findMany({
    where: kosul,
    orderBy: [{ aktif: "desc" }, { kod: "asc" }],
    select: {
      id: true,
      kod: true,
      ad: true,
      soyad: true,
      rol: true,
      aktif: true,
      kilitBitis: true,
      sonGirisTarihi: true,
    },
  })

  const duzenleyebilir = yetkiVar(kullanici, "ayar", "duzelt")
  const ekleyebilir = yetkiVar(kullanici, "ayar", "ekle")

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Kullanıcılar</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Sisteme giriş yapan hesaplar — {kayitlar.length} kayıt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DisaAktarDugmesi
            yol={`/ayar/kullanici/disa-aktar?${new URLSearchParams({ q, rol, durum }).toString()}`}
          />
          {ekleyebilir ? (
            <Button size="sm" asChild>
              <Link href="/ayar/kullanici/yeni">
                <Plus className="size-4" aria-hidden />
                Yeni Kullanıcı
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="yazdirma-disi">
        <KullaniciFiltre q={q} rol={rol} durum={durum} />
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          {kayitlar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Users className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-[0.875rem] font-medium">
                {q || rol || durum !== "aktif"
                  ? "Bu ölçütlere uyan kullanıcı bulunamadı"
                  : "Henüz kullanıcı kaydı yok"}
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100svh-16rem)] overflow-auto">
              <table className="veri-tablosu">
                <thead>
                  <tr>
                    <th>Kullanıcı Adı</th>
                    <th>Ad Soyad</th>
                    <th>Rol</th>
                    <th>Son Giriş</th>
                    <th>Durum</th>
                    {duzenleyebilir ? <th className="text-right">İşlem</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((k) => {
                    const kilitli = kilitliMi(k.kilitBitis)
                    return (
                      <tr key={k.id}>
                        <td className="font-mono text-[0.75rem]">
                          {duzenleyebilir ? (
                            <Link
                              href={`/ayar/kullanici/${k.id}/duzenle`}
                              className="text-primary hover:underline"
                            >
                              {k.kod}
                            </Link>
                          ) : (
                            k.kod
                          )}
                        </td>
                        <td className="font-medium">
                          {[k.ad, k.soyad].filter(Boolean).join(" ")}
                        </td>
                        <td className="text-muted-foreground">{ROL_ADLARI[k.rol]}</td>
                        <td className="text-muted-foreground">
                          {k.sonGirisTarihi ? tarihSaat(k.sonGirisTarihi) : "—"}
                        </td>
                        <td>
                          <DurumRozetleri aktif={k.aktif} kilitli={kilitli} />
                        </td>
                        {duzenleyebilir ? (
                          <td className="text-right">
                            <KullaniciDurumDugmesi id={k.id} aktif={k.aktif} kod={k.kod} />
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DurumRozetleri({ aktif, kilitli }: { aktif: boolean; kilitli: boolean }) {
  const rozetler: Array<[string, string]> = []
  // Kilitli işareti "neden giremiyor" sorusunun doğrudan cevabı — admin bu
  // ekrandan görüp Şifre Sıfırla ile açabilsin diye ayrı ve dikkat çekici.
  if (kilitli) rozetler.push(["Kilitli", "bg-tehlike-yumusak text-tehlike"])
  if (!aktif) rozetler.push(["Pasif", "bg-uyari-yumusak text-uyari"])
  if (rozetler.length === 0) rozetler.push(["Aktif", "bg-basari-yumusak text-basari"])

  return (
    <div className="flex flex-wrap gap-1">
      {rozetler.map(([ad, sinif]) => (
        <span
          key={ad}
          className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium ${sinif}`}
        >
          {ad}
        </span>
      ))}
    </div>
  )
}
