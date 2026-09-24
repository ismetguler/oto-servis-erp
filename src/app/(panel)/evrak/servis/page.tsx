import type { Metadata } from "next"
import Link from "next/link"
import { FileText, Receipt } from "lucide-react"

import {
  faturaBekleyenKabullerGetir,
  servisFaturalariGetir,
  type ServisFaturaFiltreleri,
} from "./veri"
import { EvrakDurumRozeti } from "@/components/evrak/durum-rozeti"
import { Button } from "@/components/ui/button"
import { para, plaka as plakaBicim, tarih } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"
import { cn } from "@/lib/utils"
import { yetkiVar } from "@/lib/yetki"

export const metadata: Metadata = { title: "Servis Faturaları" }
export const dynamic = "force-dynamic"

type Aramalar = ServisFaturaFiltreleri & { sekme?: string }

/**
 * SERVİS FATURALARI (adım 11.10)
 *
 * Sol menüde "yakında" olarak duran son ekran. Kabulden faturaya dönüştürme
 * altyapısı adım 9.2'de bitmişti; eksik olan tek şey servis işlerine kesilen
 * faturaların TOPLU görünümüydü — bugüne dek bir servis faturası ancak
 * kabul kartının içinden görülebiliyordu.
 *
 * İki sekme var ve varsayılan olan "Faturayı Bekleyen": bu ekranın asıl işi
 * biten ama faturası kesilmemiş işi yakalamak. Sekme durumu adres çubuğunda
 * (?sekme=) tutuluyor — filtre formu sunucuya gidip geldiği için istemci
 * state'i olsaydı kullanıcı her filtrelemede ilk sekmeye düşerdi
 * (`cari/tanimlar` ekranındaki gerekçenin aynısı).
 *
 * "Yeni" düğmesi YOK: servis faturası havadan kesilmez, mutlaka bir kabul
 * kartından doğar. Serbest fatura isteyen Satış Evrakları'na gider.
 */
export default async function ServisFaturalari({
  searchParams,
}: {
  searchParams: Promise<Aramalar>
}) {
  const kullanici = await yetkiliOturum("evrak", "gor")
  const f = await searchParams
  const sekme = f.sekme === "fatura" ? "fatura" : "bekleyen"
  const filtre: ServisFaturaFiltreleri = {
    q: f.q,
    durum: f.durum,
    bas: f.bas,
    bit: f.bit,
  }

  // İki sorgu da her zaman çalışıyor: sekme başlıklarındaki sayaçlar
  // ("Faturayı Bekleyen (3)") ancak böyle doğru olabiliyor ve kullanıcı
  // sekmeye tıklamadan da bekleyen iş olduğunu görüyor.
  const [bekleyenler, faturalar] = await Promise.all([
    faturaBekleyenKabullerGetir(filtre),
    servisFaturalariGetir(filtre),
  ])

  const bekleyenToplam = bekleyenler.reduce(
    (t, k) => t + Number(k.genelToplam.toString()),
    0
  )
  const kesilenToplam = faturalar
    .filter((e) => e.durum === "KESILDI")
    .reduce((t, e) => t + Number(e.genelToplam.toString()), 0)

  const faturalayabilir = yetkiVar(kullanici, "evrak", "ekle")

  // Sekme bağlantısı mevcut filtreyi koruyor: kullanıcı tarih aralığı
  // seçtikten sonra sekme değiştirince aralığın sıfırlanması şaşırtıcı olurdu.
  const sekmeYolu = (ad: string) => {
    const p = new URLSearchParams()
    for (const [anahtar, deger] of Object.entries(filtre)) {
      if (deger) p.set(anahtar, deger)
    }
    p.set("sekme", ad)
    return `/evrak/servis?${p.toString()}`
  }

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Servis Faturaları</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Araç kabul kartlarından kesilen faturalar — {bekleyenler.length} iş bekliyor (
            {para(bekleyenToplam)}) · kesilmiş toplam {para(kesilenToplam)}
          </p>
        </div>
      </div>

      <div className="tablo-sarmal yazdirma-disi flex items-center gap-1 whitespace-nowrap border-b border-border bg-card px-4 pt-2">
        <Sekme yol={sekmeYolu("bekleyen")} etkin={sekme === "bekleyen"}>
          Faturayı Bekleyen ({bekleyenler.length})
        </Sekme>
        <Sekme yol={sekmeYolu("fatura")} etkin={sekme === "fatura"}>
          Kesilen Faturalar ({faturalar.length})
        </Sekme>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <form className="panel flex flex-wrap items-end gap-2 p-3">
          <input type="hidden" name="sekme" value={sekme} />
          <FiltreAlani
            ad="q"
            etiket="Ara"
            tip="text"
            deger={filtre.q}
            yerTutucu="fatura / kabul no / plaka / cari"
          />
          {sekme === "fatura" ? (
            <div className="form-alani">
              <label className="form-etiket" htmlFor="durum">
                Durum
              </label>
              <select
                id="durum"
                name="durum"
                defaultValue={filtre.durum ?? ""}
                className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem]"
              >
                <option value="">Tümü</option>
                <option value="TASLAK">Taslak</option>
                <option value="KESILDI">Kesildi</option>
                <option value="IPTAL">İptal</option>
              </select>
            </div>
          ) : null}
          <FiltreAlani ad="bas" etiket="Başlangıç" tip="date" deger={filtre.bas} />
          <FiltreAlani ad="bit" etiket="Bitiş" tip="date" deger={filtre.bit} />
          <Button type="submit" size="sm" variant="secondary">
            Filtrele
          </Button>
        </form>

        {sekme === "bekleyen" ? (
          <BekleyenTablosu kayitlar={bekleyenler} faturalayabilir={faturalayabilir} />
        ) : (
          <FaturaTablosu kayitlar={faturalar} />
        )}
      </div>
    </div>
  )
}

/**
 * Teslim edilmiş ama faturalanmamış işler. Tarih sütunu GİRİŞ değil TESLİM
 * tarihi: faturanın gecikip gecikmediği teslimden itibaren sayılır.
 */
function BekleyenTablosu({
  kayitlar,
  faturalayabilir,
}: {
  kayitlar: Awaited<ReturnType<typeof faturaBekleyenKabullerGetir>>
  faturalayabilir: boolean
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-auto">
        <table className="veri-tablosu">
          <thead>
            <tr>
              <th>Kabul No</th>
              <th>Teslim</th>
              <th>Plaka</th>
              <th>Müşteri</th>
              <th className="text-right">Kart Toplamı</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((k) => (
              <tr key={k.id}>
                <td>
                  <Link
                    href={`/servis/kabul/${k.id}`}
                    className="font-mono text-[0.75rem] text-primary hover:underline"
                  >
                    {k.kabulNo}
                  </Link>
                </td>
                <td className="text-muted-foreground">{tarih(k.teslimTarihi)}</td>
                <td className="font-medium">{plakaBicim(k.arac.plaka)}</td>
                <td>
                  {k.cari.unvan}
                  <span className="ml-1 text-muted-foreground">({k.cari.kod})</span>
                </td>
                <td className="text-right tabular-nums">
                  {para(Number(k.genelToplam.toString()), false)}
                </td>
                <td className="text-right">
                  {faturalayabilir ? (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/evrak/satis/yeni?kabulId=${k.id}`}>
                        <Receipt className="size-4" aria-hidden />
                        Faturaya Dönüştür
                      </Link>
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {kayitlar.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Faturayı bekleyen kapalı iş yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Kabul kartına bağlı faturalar — satır sonundaki bağlantı baskı şablonunu açar. */
function FaturaTablosu({
  kayitlar,
}: {
  kayitlar: Awaited<ReturnType<typeof servisFaturalariGetir>>
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-auto">
        <table className="veri-tablosu">
          <thead>
            <tr>
              <th>Fatura No</th>
              <th>Tarih</th>
              <th>Kabul No</th>
              <th>Plaka</th>
              <th>Müşteri</th>
              <th className="text-right">Genel Toplam</th>
              <th>Durum</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link
                    href={`/evrak/satis/${e.id}`}
                    className="font-mono text-[0.75rem] text-primary hover:underline"
                  >
                    {e.evrakNo}
                  </Link>
                  {e.tur === "IADE_SATIS" ? (
                    <span className="ml-1 text-[0.6875rem] text-muted-foreground">(iade)</span>
                  ) : null}
                </td>
                <td className="text-muted-foreground">{tarih(e.tarih)}</td>
                <td>
                  {e.kabul ? (
                    <Link
                      href={`/servis/kabul/${e.kabul.id}`}
                      className="font-mono text-[0.75rem] text-primary hover:underline"
                    >
                      {e.kabul.kabulNo}
                    </Link>
                  ) : null}
                </td>
                <td className="font-medium">{plakaBicim(e.kabul?.arac.plaka)}</td>
                <td>
                  {e.cari.unvan}
                  <span className="ml-1 text-muted-foreground">({e.cari.kod})</span>
                </td>
                <td className="text-right tabular-nums">
                  {para(Number(e.genelToplam.toString()), false)}
                </td>
                <td>
                  <EvrakDurumRozeti durum={e.durum} />
                </td>
                <td className="text-right">
                  <Link
                    href={`/baski/servis-fatura/${e.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 whitespace-nowrap text-[0.75rem] text-primary hover:underline"
                  >
                    <FileText className="size-3.5" aria-hidden />
                    Yazdır
                  </Link>
                </td>
              </tr>
            ))}
            {kayitlar.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-foreground">
                  Henüz servis faturası kesilmemiş.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Sekme({
  yol,
  etkin,
  children,
}: {
  yol: string
  etkin: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={yol}
      className={cn(
        "-mb-px shrink-0 border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition-colors",
        etkin
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  )
}

function FiltreAlani({
  ad,
  etiket,
  tip,
  deger,
  yerTutucu,
}: {
  ad: string
  etiket: string
  tip: string
  deger?: string
  yerTutucu?: string
}) {
  return (
    <div className="form-alani">
      <label className="form-etiket" htmlFor={ad}>
        {etiket}
      </label>
      <input
        id={ad}
        name={ad}
        type={tip}
        defaultValue={deger ?? ""}
        placeholder={yerTutucu}
        className="h-8 rounded-sm border border-input bg-background px-2 text-[0.8125rem]"
      />
    </div>
  )
}
