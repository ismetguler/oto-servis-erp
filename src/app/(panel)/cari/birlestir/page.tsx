import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, ArrowRight, ArrowLeftRight, Search } from "lucide-react"

import { birlestirmeOnizlemesi, cariAra, cariGetir, type BirlestirmeCarisi } from "./veri"
import { CARI_TUR_ADLARI } from "../sema"
import { BirlestirFormu } from "@/components/cari/birlestir-formu"
import { para, tarihSaat } from "@/lib/bicim"
import { yetkiliOturum } from "@/lib/oturum"

export const metadata: Metadata = { title: "Cari Birleştir" }
export const dynamic = "force-dynamic"

/**
 * CARİ BİRLEŞTİR
 *
 * Mükerrer Cari Kontrolü ekranından "Birleştir" düğmesiyle iki kayıt seçili
 * olarak açılır; doğrudan girildiğinde kaynak ve hedef burada aranır.
 *
 * Ekran bilerek iki aşamalı: önce ne olacağının TAM dökümü (hangi tablodan
 * kaç satır taşınacak, hedefin hangi boş alanları dolacak, bakiye ne olacak),
 * sonra onay. Geri alma ekranı olmayan bir işlemde önizlemesiz düğme
 * koymak, kullanıcıyı kör imzaya zorlamak olurdu.
 *
 * Yetki `cari` + SİL: birleştirme bir kartı kapatıyor ve sonucu silmekten
 * ağır — silinen kayıt geri alınabilir, birleşen kayıt alınamaz.
 */
export default async function CariBirlestir({
  searchParams,
}: {
  searchParams: Promise<{ kaynak?: string; hedef?: string; q?: string }>
}) {
  await yetkiliOturum("cari", "sil")
  const p = await searchParams
  const q = (p.q ?? "").trim()
  const kaynakId = Number(p.kaynak) || 0
  const hedefId = Number(p.hedef) || 0

  const [kaynak, hedef] = await Promise.all([
    kaynakId ? cariGetir(kaynakId) : Promise.resolve(null),
    hedefId ? cariGetir(hedefId) : Promise.resolve(null),
  ])

  const secili = kaynak && hedef && kaynak.id !== hedef.id && !kaynak.silindi && !hedef.silindi
  const onizleme = secili ? await birlestirmeOnizlemesi(kaynak, hedef) : null

  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div>
          <h1 className="text-[1.0625rem] font-semibold tracking-tight">Cari Birleştir</h1>
          <p className="text-[0.8125rem] text-muted-foreground">
            Mükerrer açılmış iki kartı tek karta indirir
          </p>
        </div>
        <Link
          href="/cari/mukerrer"
          className="h-8 rounded-sm border border-input bg-background px-3 text-[0.8125rem] font-medium leading-8 hover:bg-accent"
        >
          Mükerrer Kontrolü
        </Link>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="panel flex items-start gap-2 border-uyari/40 bg-uyari-yumusak p-3.5 text-[0.8125rem] text-uyari">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Kaynak</strong> kartın araçları, iş emirleri, ekstresi, evrakları,
            çek-senetleri, kasa hareketleri ve kara liste geçmişi{" "}
            <strong>hedef</strong> karta taşınır; kaynak kart kapatılır. İşlemin
            tamamı tek seferde yapılır — yarım kalmaz — ama <strong>geri alma
            ekranı yoktur</strong>. Hangisinin doğru kayıt olduğuna emin olun.
          </p>
        </div>

        <Secim
          etiket="Kaynak (kapatılacak kart)"
          cari={kaynak}
          rol="kaynak"
          digerId={hedefId}
          q={q}
        />
        <Secim
          etiket="Hedef (kalacak kart)"
          cari={hedef}
          rol="hedef"
          digerId={kaynakId}
          q={q}
        />

        {kaynakId && hedefId && kaynakId === hedefId ? (
          <p className="text-[0.8125rem] text-tehlike">
            Bir cari kendisiyle birleştirilemez — farklı bir kart seçin.
          </p>
        ) : null}

        {!secili ? (
          <Arama q={q} kaynakId={kaynakId} hedefId={hedefId} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/cari/birlestir?kaynak=${hedefId}&hedef=${kaynakId}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-input bg-background px-3 text-[0.8125rem] font-medium hover:bg-accent"
              >
                <ArrowLeftRight className="size-3.5" aria-hidden />
                Kaynak ve hedefi değiştir
              </Link>
              <Link
                href="/cari/birlestir"
                className="inline-flex h-8 items-center rounded-sm px-3 text-[0.8125rem] text-muted-foreground hover:underline"
              >
                Seçimi temizle
              </Link>
            </div>

            {kaynak!.turu !== hedef!.turu ? (
              <p className="text-[0.8125rem] text-uyari">
                Dikkat: kartların türü farklı ({CARI_TUR_ADLARI[kaynak!.turu]} →{" "}
                {CARI_TUR_ADLARI[hedef!.turu]}). Hedefin türü değişmeyecek.
              </p>
            ) : null}

            <Onizleme onizleme={onizleme!} kaynak={kaynak!} hedef={hedef!} />

            <BirlestirFormu
              kaynakId={kaynak!.id}
              hedefId={hedef!.id}
              kaynakKod={kaynak!.kod}
              kaynakUnvan={kaynak!.unvan}
              hedefKod={hedef!.kod}
              hedefUnvan={hedef!.unvan}
            />
          </>
        )}
      </div>
    </div>
  )
}

/** Seçili kartın özeti — yanlış kaydı seçtiğini fark etmenin en hızlı yolu. */
function Secim({
  etiket,
  cari,
  rol,
  digerId,
  q,
}: {
  etiket: string
  cari: NonNullable<BirlestirmeCarisi> | null
  rol: "kaynak" | "hedef"
  digerId: number
  q: string
}) {
  const temizleYolu = () => {
    const parametre = new URLSearchParams()
    if (digerId) parametre.set(rol === "kaynak" ? "hedef" : "kaynak", String(digerId))
    if (q) parametre.set("q", q)
    const metin = parametre.toString()
    return metin ? `/cari/birlestir?${metin}` : "/cari/birlestir"
  }

  return (
    <div
      className={`panel p-3.5 ${
        rol === "kaynak" ? "border-tehlike/30" : "border-basari/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground">
          {etiket}
        </span>
        {cari ? (
          <Link
            href={temizleYolu()}
            className="text-[0.75rem] text-muted-foreground hover:underline"
          >
            değiştir
          </Link>
        ) : null}
      </div>

      {!cari ? (
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          Henüz seçilmedi — aşağıdaki listeden seçin.
        </p>
      ) : cari.silindi ? (
        <p className="mt-1 text-[0.8125rem] text-tehlike">
          {cari.kod} — bu kart silinmiş, birleştirmede kullanılamaz.
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.8125rem]">
          <Link href={`/cari/${cari.id}`} className="font-mono text-primary hover:underline">
            {cari.kod}
          </Link>
          <span className="font-medium">{cari.unvan}</span>
          <span className="text-muted-foreground">{CARI_TUR_ADLARI[cari.turu]}</span>
          <span className="text-muted-foreground">
            VKN: {cari.vergiNo ?? "—"} · Tel: {cari.gsm ?? cari.telefon ?? "—"}
          </span>
          <span className="text-muted-foreground">
            Açılış: {tarihSaat(cari.olusturmaTarihi)}
          </span>
          <span className="ml-auto font-medium">
            Bakiye: {para(Number(String(cari.bakiye)))}
          </span>
        </div>
      )}
    </div>
  )
}

/** Doğrudan girildiğinde kaynak/hedef seçimi. */
async function Arama({
  q,
  kaynakId,
  hedefId,
}: {
  q: string
  kaynakId: number
  hedefId: number
}) {
  const sonuclar = await cariAra(q)

  const yol = (rol: "kaynak" | "hedef", id: number) => {
    const parametre = new URLSearchParams()
    parametre.set("kaynak", String(rol === "kaynak" ? id : kaynakId))
    parametre.set("hedef", String(rol === "hedef" ? id : hedefId))
    if (q) parametre.set("q", q)
    return `/cari/birlestir?${parametre.toString()}`
  }

  return (
    <div className="panel overflow-hidden">
      <div className="panel-baslik">
        <h2 className="panel-baslik-yazi">Cari Ara</h2>
      </div>
      <form action="/cari/birlestir" className="flex items-center gap-2 p-3.5">
        {kaynakId ? <input type="hidden" name="kaynak" value={kaynakId} /> : null}
        {hedefId ? <input type="hidden" name="hedef" value={hedefId} /> : null}
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Kod, ünvan, vergi no veya telefon"
          className="h-8 w-72 rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <button
          type="submit"
          className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-input bg-background px-3 text-[0.8125rem] font-medium hover:bg-accent"
        >
          <Search className="size-3.5" aria-hidden />
          Ara
        </button>
      </form>

      {q === "" ? null : sonuclar.length === 0 ? (
        <p className="border-t border-border/70 px-3.5 py-6 text-center text-[0.8125rem] text-muted-foreground">
          Bu aramaya uyan cari yok.
        </p>
      ) : (
        <div className="tablo-sarmal">
          <table className="veri-tablosu">
            <tbody>
              {sonuclar.map((c) => (
                <tr key={c.id}>
                  <td className="w-28 font-mono text-[0.75rem]">{c.kod}</td>
                  <td className="font-medium">{c.unvan}</td>
                  <td className="w-28 text-muted-foreground">{CARI_TUR_ADLARI[c.turu]}</td>
                  <td className="w-36 text-muted-foreground">
                    {c.gsm ?? c.telefon ?? "—"}
                  </td>
                  <td className="w-32 text-right">{para(Number(String(c.bakiye)))}</td>
                  <td className="w-48 text-right">
                    <Link
                      href={yol("kaynak", c.id)}
                      className="mr-3 text-[0.75rem] text-tehlike hover:underline"
                    >
                      kaynak seç
                    </Link>
                    <Link
                      href={yol("hedef", c.id)}
                      className="text-[0.75rem] text-primary hover:underline"
                    >
                      hedef seç
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Ne olacağının dökümü — onay düğmesinin üstünde durması bilinçli. */
function Onizleme({
  onizleme,
  kaynak,
  hedef,
}: {
  onizleme: NonNullable<Awaited<ReturnType<typeof birlestirmeOnizlemesi>>>
  kaynak: NonNullable<BirlestirmeCarisi>
  hedef: NonNullable<BirlestirmeCarisi>
}) {
  const dolu = onizleme.kalemler.filter((k) => k.adet > 0)

  return (
    <div className="[&>*]:min-w-0 grid gap-4 lg:grid-cols-2">
      <div className="panel overflow-hidden">
        <div className="panel-baslik">
          <h2 className="panel-baslik-yazi">Taşınacak Kayıtlar</h2>
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-medium">
            toplam {onizleme.toplamKayit}
          </span>
        </div>
        {dolu.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[0.8125rem] text-muted-foreground">
            Kaynak kartın taşınacak hareketi yok — yalnızca kart kapatılacak.
          </p>
        ) : (
          <div className="tablo-sarmal">
            <table className="veri-tablosu">
              <tbody>
                {dolu.map((k) => (
                  <tr key={k.anahtar}>
                    <td>{k.etiket}</td>
                    <td className="w-24 text-right font-medium">{k.adet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-baslik">
          <h2 className="panel-baslik-yazi">Birleşme Sonrası</h2>
        </div>
        <div className="tablo-sarmal">
          <table className="veri-tablosu">
            <tbody>
              <tr>
                <td>Bakiye</td>
                <td className="w-56 text-right">
                  <span className="text-muted-foreground">
                    {para(Number(String(hedef.bakiye)))}
                  </span>
                  <ArrowRight className="mx-1.5 inline size-3" aria-hidden />
                  <span className="font-medium">{para(onizleme.yeniBakiye)}</span>
                </td>
              </tr>
              <tr>
                <td>Açılış bakiyesi (tek satırda toplanır)</td>
                <td className="text-right font-medium">
                  {para(Math.abs(onizleme.yeniAcilisNet))}{" "}
                  <span className="text-muted-foreground">
                    {onizleme.yeniAcilisNet < 0 ? "alacak" : "borç"}
                  </span>
                </td>
              </tr>
              {onizleme.kopyalanacak.map((k) => (
                <tr key={k.alan}>
                  <td>
                    {k.etiket}{" "}
                    <span className="text-[0.75rem] text-muted-foreground">
                      (hedefte boş, kaynaktan dolacak)
                    </span>
                  </td>
                  <td className="text-right font-medium">{k.deger}</td>
                </tr>
              ))}
              {onizleme.notEklenecek ? (
                <tr>
                  <td colSpan={2} className="text-muted-foreground">
                    Kaynak kartın notu, hedefin notunun altına eklenecek (hiçbir not
                    silinmiyor).
                  </td>
                </tr>
              ) : null}
              {onizleme.hedefKaraListeyeGirecek ? (
                <tr>
                  <td colSpan={2} className="text-tehlike">
                    Kaynak kart <strong>kara listede</strong> — geçmişi taşındığı için
                    hedef kart da kara listeye girecek.
                  </td>
                </tr>
              ) : null}
              {onizleme.kendiPlasiyeriOlacakti ? (
                <tr>
                  <td colSpan={2} className="text-uyari">
                    {kaynak.kod} hedef kartın sorumlu personeli olarak yazılmış; bir kart
                    kendi sorumlusu olamayacağı için bu bağ kaldırılacak.
                  </td>
                </tr>
              ) : null}
              {onizleme.cakisanKabulPersoneli > 0 ? (
                <tr>
                  <td colSpan={2} className="text-uyari">
                    {onizleme.cakisanKabulPersoneli} iş emrinde iki kart da usta olarak
                    yazılı; kaynağın satırı silinecek (aynı usta iki kez yazılamaz).
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={2} className="text-muted-foreground">
                  {kaynak.kod} kartı silinmiş olarak işaretlenecek, ünvanına
                  &laquo;(BİRLEŞTİRİLDİ &rarr; {hedef.kod})&raquo; notu düşülecek.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
