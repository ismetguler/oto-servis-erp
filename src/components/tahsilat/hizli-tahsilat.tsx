"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Banknote, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import {
  hizliTahsilatKaydet,
  type HizliTahsilatDurumu,
} from "@/app/(panel)/tahsilat/actions"
import {
  kagitGerektirir,
  KASALI_ODEME_SEKILLERI,
  posAlanlariGorunur,
} from "@/app/(panel)/tahsilat/sema"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { para } from "@/lib/bicim"
import { formGonderimi } from "@/lib/form-gonderim"
import { metniSayiyaCevir } from "@/lib/sayi"

/**
 * HIZLI TAHSİLAT — kabul kartından tek tıkla tahsilat (adım 6.2).
 *
 * Tahsilat sayfasına gidip müşteriyi yeniden aramak, kasada bekleyen
 * müşterinin karşısında yapılamayacak kadar uzun bir yol. Burada cari ve
 * kabul zaten belli; kullanıcıya yalnızca tutar / ödeme şekli / kasa
 * soruluyor, gerisi sunucudaki normal tahsilat akışının aynısı.
 *
 * Kayıt sonrası modal AÇIK kalıyor ama forma dönmüyor: kalan tutar
 * yenilenip "tekrar tahsilat gir" seçeneği veriliyor — parçalı ödeme
 * (yarısı nakit, yarısı kart) serviste sık.
 */

const ALAN_SINIFI =
  "h-8 w-full rounded-sm border border-input bg-background px-2 text-[0.8125rem] shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"

export type HizliTahsilatKasasi = { id: number; ad: string; bakiye: number }

export type HizliTahsilatKarti = {
  kabulId: number
  kabulNo: string
  cariUnvan: string
  genelToplam: number
  tahsilEdilen: number
  kalan: number
  /** SA-2 / 2.5 — kara listedeki cariyle işlem yapılırken uyarı bandı. */
  karaListe?: boolean
  karaListeNedeni?: string | null
}

function kasaliMi(odemeSekli: string) {
  return (KASALI_ODEME_SEKILLERI as readonly string[]).includes(odemeSekli)
}

function bugunMetni() {
  const g = new Date()
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(
    g.getDate()
  ).padStart(2, "0")}`
}

export function HizliTahsilat({
  kart,
  kasalar,
  boyut = "sm",
  gorunum = "outline",
  etiket = "Hızlı Tahsilat",
  sadeceSimge = false,
}: {
  kart: HizliTahsilatKarti
  kasalar: HizliTahsilatKasasi[]
  boyut?: "sm" | "icon"
  gorunum?: "outline" | "default" | "ghost"
  etiket?: string
  sadeceSimge?: boolean
}) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [durum, gonder, bekliyor] = useActionState<HizliTahsilatDurumu, FormData>(
    hizliTahsilatKaydet,
    {}
  )
  const [odemeSekli, setOdemeSekli] = useState("NAKIT")
  // Tutar denetimli: "kalanı yaz" düğmesi ve kayıt sonrası sıfırlama için
  // değerin bileşende tutulması gerekiyor.
  const [tutar, setTutar] = useState("")
  // Kayıt başarılı olunca tutarı boşaltmak için "render sırasında state
  // düzeltme" kalıbı: effect içinde setState yapmak React 19'da zincirleme
  // render uyarısı veriyor, bu kalıp React'in önerdiği yol.
  const [islenenFis, setIslenenFis] = useState<string | undefined>(undefined)
  // Form artık `onSubmit` ile gönderiliyor (React'in otomatik sıfırlaması
  // hatada da vurduğu için bırakıldı — bkz. `formGonderimi`). Başarılı kayıttan
  // sonra modal açık kaldığından açıklama / çek alanlarının temizlenmesi
  // gerekiyor: sayaç değişince form yeniden kuruluyor, alanlar varsayılana döner.
  const [formSayac, setFormSayac] = useState(0)
  if (durum.fisNo !== islenenFis) {
    setIslenenFis(durum.fisNo)
    if (durum.fisNo) {
      setTutar("")
      setOdemeSekli("NAKIT")
      setFormSayac((s) => s + 1)
    }
  }

  const hata = (alan: string) => durum.alanHatalari?.[alan]
  const kasaLazim = kasaliMi(odemeSekli)
  const kagitLazim = kagitGerektirir(odemeSekli)
  const posGorunur = posAlanlariGorunur(odemeSekli)
  // Kayıt başarılıysa güncel kalanı sunucudan gelen değer söyler; modal
  // açıkken sayfa yenilenmediği için prop'taki kalan eskimiş olabilir.
  const kalan = durum.basarili && durum.kalan !== undefined ? durum.kalan : kart.kalan

  // Kalandan fazlası girilemez (sunucu da aynı kuralı uyguluyor; buradaki
  // denetim kullanıcıyı kaydetmeden önce uyarmak için).
  const kapandi = kalan <= 0.005
  const girilenTutar = tutar.trim() ? metniSayiyaCevir(tutar) : 0
  const asimVar = Number.isFinite(girilenTutar) && girilenTutar > kalan + 0.005

  // Toast dış bir sistem — effect'te kalması doğru. Kayıt başarılıysa ayrıca
  // sunucu bileşenini tazele: modal açık kalıyor ama arkadaki liste (kabul
  // listesi, "Onarım Tahsilatları") güncel kalanı/durumu göstersin.
  useEffect(() => {
    if (durum.basarili) {
      toast.success(durum.basarili)
      router.refresh()
    }
  }, [durum, router])

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button
          variant={gorunum}
          size={boyut}
          title={`${kart.kabulNo} için hızlı tahsilat`}
          aria-label={`${kart.kabulNo} için hızlı tahsilat`}
        >
          <Banknote className="size-4" aria-hidden />
          {sadeceSimge ? null : etiket}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hızlı Tahsilat — {kart.kabulNo}</DialogTitle>
          <DialogDescription>
            {kart.cariUnvan} · fiş cariye ve seçilen kasaya anında işlenir.
          </DialogDescription>
        </DialogHeader>

        {kart.karaListe ? (
          <div className="rounded-md border border-tehlike/40 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
            <span className="font-semibold">⚠ Bu cari kara listede.</span>
            {kart.karaListeNedeni ? (
              <span className="mt-0.5 block whitespace-pre-wrap">
                Sebep: {kart.karaListeNedeni}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 rounded-sm border border-border bg-muted/40 px-3 py-2 text-[0.75rem]">
          <div>
            <span className="block text-muted-foreground">Kart Toplamı</span>
            <span className="font-medium tabular-nums">{para(kart.genelToplam)}</span>
          </div>
          <div>
            <span className="block text-muted-foreground">Tahsil Edilen</span>
            <span className="font-medium tabular-nums text-basari">
              {para(kart.tahsilEdilen)}
            </span>
          </div>
          <div>
            <span className="block text-muted-foreground">Kalan</span>
            <span
              className={`font-medium tabular-nums ${kalan > 0.005 ? "text-tehlike" : "text-basari"}`}
            >
              {para(kalan)}
            </span>
          </div>
        </div>

        {durum.hata ? (
          <div className="rounded-md border border-tehlike/30 bg-tehlike-yumusak px-3 py-2 text-[0.8125rem] text-tehlike">
            {durum.hata}
          </div>
        ) : null}

        {kapandi && !durum.basarili ? (
          <div className="rounded-md border border-basari/30 bg-basari-yumusak px-3 py-2 text-[0.8125rem] text-basari">
            Bu kartın tamamı tahsil edilmiş, girilecek tutar kalmadı.
          </div>
        ) : null}

        {durum.basarili ? (
          <div className="rounded-md border border-basari/30 bg-basari-yumusak px-3 py-2 text-[0.8125rem] text-basari">
            {durum.basarili}
            {kalan > 0.005
              ? ` Kartın ${para(kalan)} tutarı hâlâ açık — istersen bir fiş daha girebilirsin.`
              : " Kart tamamen tahsil edildi."}
          </div>
        ) : null}

        <form
          key={formSayac}
          onSubmit={(olay) => formGonderimi(olay, gonder)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="kabulId" value={kart.kabulId} />

          <div className="form-alani sm:col-span-2">
            <label htmlFor={`tutar-${kart.kabulId}`} className="form-etiket">
              Tahsil Edilen Tutar *
            </label>
            <div className="flex gap-2">
              <input
                id={`tutar-${kart.kabulId}`}
                name="tutar"
                value={tutar}
                onChange={(e) => setTutar(e.target.value)}
                inputMode="decimal"
                required
                autoFocus
                placeholder="0,00"
                className={`${ALAN_SINIFI} text-right font-mono text-[0.9375rem]`}
              />
              {kalan > 0.005 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTutar(kalan.toFixed(2).replace(".", ","))}
                >
                  Kalanı Yaz
                </Button>
              ) : null}
            </div>
            {hata("tutar") ? (
              <p className="text-[0.75rem] text-tehlike">{hata("tutar")}</p>
            ) : asimVar ? (
              <p className="text-[0.75rem] text-tehlike">
                Kartta kalan {para(kalan)}. Bundan fazla tahsilat girilemez.
              </p>
            ) : (
              <p className="text-[0.6875rem] text-muted-foreground">
                En fazla {para(kalan)} girebilirsiniz.
              </p>
            )}
          </div>

          <div className="form-alani">
            <label htmlFor={`tarih-${kart.kabulId}`} className="form-etiket">
              Tarih *
            </label>
            <input
              id={`tarih-${kart.kabulId}`}
              name="tarih"
              type="date"
              defaultValue={bugunMetni()}
              className={ALAN_SINIFI}
              required
            />
            {hata("tarih") ? (
              <p className="text-[0.75rem] text-tehlike">{hata("tarih")}</p>
            ) : null}
          </div>

          <div className="form-alani">
            <label htmlFor={`odeme-${kart.kabulId}`} className="form-etiket">
              Ödeme Şekli *
            </label>
            <select
              id={`odeme-${kart.kabulId}`}
              name="odemeSekli"
              value={odemeSekli}
              onChange={(e) => setOdemeSekli(e.target.value)}
              className={ALAN_SINIFI}
            >
              <option value="NAKIT">Nakit</option>
              <option value="KREDI_KARTI">Kredi Kartı</option>
              <option value="HAVALE">Havale / EFT</option>
              <option value="CEK">Çek</option>
              <option value="SENET">Senet</option>
              <option value="MAHSUP">Mahsup</option>
            </select>
          </div>

          {kasaLazim ? (
            <div className="form-alani sm:col-span-2">
              <label htmlFor={`kasa-${kart.kabulId}`} className="form-etiket">
                Giren Kasa *
              </label>
              <select
                id={`kasa-${kart.kabulId}`}
                name="kasaId"
                defaultValue={kasalar[0]?.id ?? ""}
                className={ALAN_SINIFI}
              >
                <option value="">— seçin —</option>
                {kasalar.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad} ({para(k.bakiye)})
                  </option>
                ))}
              </select>
              {hata("kasaId") ? (
                <p className="text-[0.75rem] text-tehlike">{hata("kasaId")}</p>
              ) : null}
            </div>
          ) : (
            /* Kasasız ödeme şekillerinde alan hiç gönderilmiyor — sunucu da
               yok sayıyor ama boş string şemayı gereksiz hataya sokuyordu. */
            <p className="rounded-sm border border-border bg-muted/40 px-2 py-1.5 text-[0.75rem] text-muted-foreground sm:col-span-2">
              {odemeSekli === "MAHSUP"
                ? "Mahsup para hareketi değildir, kasaya işlenmez."
                : "Çek / senet kasaya ancak tahsil edildiğinde girer. Kâğıdı Çek-Senet modülünden takip edin."}
            </p>
          )}

          {kagitLazim ? (
            <>
              {/* Vade zorunlu: kâğıt buradan Çek-Senet portföyüne otomatik
                  düşüyor (adım 6.3), vadesiz kâğıt vade listesinde kaybolurdu. */}
              <div className="form-alani">
                <label htmlFor={`cekVade-${kart.kabulId}`} className="form-etiket">
                  Vade Tarihi *
                </label>
                <input
                  id={`cekVade-${kart.kabulId}`}
                  name="cekVadeTarihi"
                  type="date"
                  className={ALAN_SINIFI}
                />
                {hata("cekVadeTarihi") ? (
                  <p className="text-[0.75rem] text-tehlike">{hata("cekVadeTarihi")}</p>
                ) : null}
              </div>

              <div className="form-alani">
                <label htmlFor={`cekBelge-${kart.kabulId}`} className="form-etiket">
                  {odemeSekli === "SENET" ? "Senet Seri No" : "Çek No"}
                </label>
                <input
                  id={`cekBelge-${kart.kabulId}`}
                  name="cekBelgeNo"
                  maxLength={50}
                  className={`${ALAN_SINIFI} font-mono`}
                />
              </div>

              <div className="form-alani">
                <label htmlFor={`cekBanka-${kart.kabulId}`} className="form-etiket">
                  Banka
                </label>
                <input
                  id={`cekBanka-${kart.kabulId}`}
                  name="cekBanka"
                  maxLength={100}
                  className={ALAN_SINIFI}
                />
              </div>

              <div className="form-alani">
                <label htmlFor={`cekBorclu-${kart.kabulId}`} className="form-etiket">
                  Keşideci / Borçlu
                </label>
                <input
                  id={`cekBorclu-${kart.kabulId}`}
                  name="cekBorclu"
                  maxLength={200}
                  className={ALAN_SINIFI}
                />
              </div>
            </>
          ) : null}

          {posGorunur ? (
            <>
              <div className="form-alani">
                <label htmlFor={`posBanka-${kart.kabulId}`} className="form-etiket">
                  Banka / POS
                </label>
                <input
                  id={`posBanka-${kart.kabulId}`}
                  name="posBanka"
                  maxLength={100}
                  placeholder="dekonttan elle"
                  className={ALAN_SINIFI}
                />
              </div>

              <div className="form-alani">
                <label htmlFor={`posSon4-${kart.kabulId}`} className="form-etiket">
                  Kart Son 4 Hane
                </label>
                <input
                  id={`posSon4-${kart.kabulId}`}
                  name="posSon4"
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="1234"
                  className={`${ALAN_SINIFI} font-mono`}
                />
                {hata("posSon4") ? (
                  <p className="text-[0.75rem] text-tehlike">{hata("posSon4")}</p>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="form-alani sm:col-span-2">
            <label htmlFor={`aciklama-${kart.kabulId}`} className="form-etiket">
              Açıklama
            </label>
            <input
              id={`aciklama-${kart.kabulId}`}
              name="aciklama"
              maxLength={1000}
              placeholder="isteğe bağlı"
              className={ALAN_SINIFI}
            />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAcik(false)}>
              Kapat
            </Button>
            <Button type="submit" size="sm" disabled={bekliyor || asimVar || kapandi}>
              {bekliyor ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {bekliyor ? "Kaydediliyor…" : "Tahsilatı Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
