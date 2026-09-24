"use client"

import { useState } from "react"

import {
  ARAC_SEMASI,
  ORIJINAL,
  PANEL_DURUMLARI,
  type PanelDurumKodu,
  panelDurumu,
} from "@/config/arac-panel"
import { cn } from "@/lib/utils"

/**
 * ARAÇ BOYA / DEĞİŞEN ŞEMASI
 *
 * Selim abinin istediği "sahibinden'deki gibi işaretleme" ekranı.
 *
 * ÇALIŞMA MANTIĞI — "boya fırçası":
 * Üstten bir durum seçilir (Boyalı / Değişen / Lokal Boyalı), sonra
 * parçalara dokunulur. Tek tek her parçada menü açmak yerine bu seçildi:
 *  - Serviste tabletten işaretleniyor; açılır menü küçük ekranda yavaş.
 *  - Bir araçta genelde AYNI durumdan birkaç parça olur (üç parça boyalı
 *    gibi) — fırça seçilip üçüne dokunmak en hızlısı.
 * Aynı durumdaki parçaya tekrar dokunmak işareti KALDIRIR (orijinale
 * döner), yanlış dokunuş tek hareketle geri alınır.
 *
 * Form gönderimi gizli input'larla: her işaretli parça `panel_<kod>` adıyla
 * gider, değeri durum kodudur. Paralel iki dizi (kodlar + durumlar) yerine
 * bu seçildi — dizilerin sırası kayarsa parça yanlış duruma bağlanır, isim
 * eşlemesinde böyle bir risk yok. Mevcut FormData akışı da değişmiyor.
 *
 * `saltOkunur` modunda aynı bileşen detay ekranında ve A4 çıktısında
 * kullanılıyor — önizleme ile kâğıt birebir aynı olsun diye çizim TEK yerde.
 */

export type PanelSecimi = Record<string, PanelDurumKodu>

type Props = {
  /** Kontrolsüz kullanım için başlangıç değeri. */
  baslangic?: PanelSecimi
  saltOkunur?: boolean
  className?: string
}

export function AracSemasi({
  baslangic = {},
  saltOkunur = false,
  className,
}: Props) {
  const sema = ARAC_SEMASI
  const [secim, setSecim] = useState<PanelSecimi>(baslangic)
  const [firca, setFirca] = useState<PanelDurumKodu>("BOYALI")

  const isaretliler = Object.entries(secim)

  function panelTikla(kod: string) {
    if (saltOkunur) return
    setSecim((onceki) => {
      const yeni = { ...onceki }
      if (yeni[kod] === firca) delete yeni[kod]
      else yeni[kod] = firca
      return yeni
    })
  }

  /** Durumlara göre gruplanmış özet — sahibinden'in sağdaki listesi gibi. */
  const gruplar = PANEL_DURUMLARI.map((durum) => ({
    ...durum,
    parcalar: sema.paneller.filter((p) => secim[p.kod] === durum.kod),
  })).filter((g) => g.parcalar.length > 0)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* --- fırça çubuğu (yalnız düzenleme modunda) --- */}
      {!saltOkunur ? (
        <div className="yazdirma-disi flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            İşaretleme:
          </span>
          {PANEL_DURUMLARI.map((durum) => (
            <button
              key={durum.kod}
              type="button"
              onClick={() => setFirca(durum.kod)}
              aria-pressed={firca === durum.kod}
              className={cn(
                "flex items-center gap-2 rounded-md border-2 px-3 py-1.5 text-sm transition",
                firca === durum.kod
                  ? "border-foreground font-semibold shadow-sm"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
              style={{ backgroundColor: durum.renk, color: durum.yazi }}
            >
              <span className="grid min-w-5 place-items-center rounded border border-current px-1 text-[0.7rem] font-bold">
                {durum.harf}
              </span>
              {durum.ad}
            </button>
          ))}
          {isaretliler.length > 0 ? (
            <button
              type="button"
              onClick={() => setSecim({})}
              className="ml-auto rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            >
              Tümünü Temizle
            </button>
          ) : null}
        </div>
      ) : null}

      {!saltOkunur ? (
        <p className="yazdirma-disi text-xs text-muted-foreground">
          Önce üstten durumu seç, sonra araç üzerindeki parçaya dokun. Aynı
          parçaya tekrar dokunmak işareti kaldırır.
        </p>
      ) : null}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <SemaCizimi
          secim={secim}
          saltOkunur={saltOkunur}
          onPanelTikla={panelTikla}
        />

        {/* --- sağdaki özet listesi --- */}
        <div className="min-w-0 flex-1 text-xs">
          <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Rozet renk={ORIJINAL.renk} ad={ORIJINAL.ad} />
            {PANEL_DURUMLARI.map((d) => (
              <Rozet key={d.kod} renk={d.renk} ad={d.ad} />
            ))}
          </p>

          {gruplar.length === 0 ? (
            <p className="text-muted-foreground">
              İşaretlenmiş parça yok — araç tümüyle orijinal kabul edilir.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {gruplar.map((grup) => (
                <div key={grup.kod}>
                  <p className="flex items-center gap-2 font-semibold">
                    <span
                      className="inline-block size-3 rounded-[3px]"
                      style={{ backgroundColor: grup.renk }}
                    />
                    {grup.ad} Parçalar ({grup.parcalar.length})
                  </p>
                  <ul className="mt-1 ml-5 list-disc text-muted-foreground">
                    {grup.parcalar.map((p) => (
                      <li key={p.kod}>{p.ad}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 border-t pt-2 text-muted-foreground">
            Kısaltmalar:{" "}
            {PANEL_DURUMLARI.map((d) => `${d.harf} = ${d.ad}`).join(" · ")}
          </p>
        </div>
      </div>

      {/* --- forma giden gizli alanlar --- */}
      {!saltOkunur
        ? isaretliler.map(([kod, durum]) => (
            <input key={kod} type="hidden" name={`panel_${kod}`} value={durum} />
          ))
        : null}
    </div>
  )
}

function Rozet({ renk, ad }: { renk: string; ad: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-3 rounded-[3px] border border-black/10"
        style={{ backgroundColor: renk }}
      />
      {ad}
    </span>
  )
}

/**
 * Çizimin kendisi. Ayrı bileşen: A4 baskı şablonu da bunu doğrudan
 * kullanıyor (fırça çubuğu ve liste olmadan).
 */
export function SemaCizimi({
  secim,
  saltOkunur = true,
  onPanelTikla,
  className,
}: {
  secim: PanelSecimi
  saltOkunur?: boolean
  onPanelTikla?: (kod: string) => void
  className?: string
}) {
  const sema = ARAC_SEMASI

  return (
    <svg
      viewBox={`0 0 ${sema.genislik} ${sema.yukseklik}`}
      role="img"
      aria-label="Araç boya ve değişen parça şeması"
      className={cn("h-auto w-full max-w-[340px] shrink-0 select-none", className)}
    >
      {/* 1) gövde silueti + ayna kulakları — en altta */}
      {sema.susler.map((sus, sira) =>
        sus.tur === "govde" ? (
          <path
            key={`govde-${sira}`}
            d={sus.d}
            fill="#eef0f2"
            stroke="#dcdfe3"
            strokeWidth={1}
          />
        ) : null
      )}

      {/* 2) tıklanabilir paneller */}
      {sema.paneller.map((panel) => {
        const durumKodu = secim[panel.kod]
        const durum = durumKodu ? panelDurumu(durumKodu) : undefined
        return (
          <path
            key={panel.kod}
            d={panel.d}
            fill={durum?.renk ?? ORIJINAL.renk}
            stroke={durum?.kenar ?? ORIJINAL.kenar}
            strokeWidth={1.5}
            strokeLinejoin="round"
            onClick={saltOkunur ? undefined : () => onPanelTikla?.(panel.kod)}
            className={cn(!saltOkunur && "cursor-pointer hover:brightness-95")}
          >
            <title>
              {panel.ad} — {durum?.ad ?? ORIJINAL.ad}
            </title>
          </path>
        )
      })}

      {/* 3) camlar, farlar, tekerlekler, yön yazıları */}
      {sema.susler.map((sus, sira) => {
        if (sus.tur === "cam")
          return (
            <path
              key={`cam-${sira}`}
              d={sus.d}
              fill="#ffffff"
              stroke={ORIJINAL.kenar}
              strokeWidth={1}
              pointerEvents="none"
            />
          )
        if (sus.tur === "teker")
          return (
            <circle
              key={`teker-${sira}`}
              cx={sus.cx}
              cy={sus.cy}
              r={sus.r}
              fill="#e6e8ea"
              stroke="#c4c8cd"
              pointerEvents="none"
            />
          )
        if (sus.tur === "yazi")
          return (
            <text
              key={`yazi-${sira}`}
              x={sus.x}
              y={sus.y}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill="#8a9099"
              letterSpacing={1}
            >
              {sus.metin}
            </text>
          )
        return null
      })}

      {/* 4) kısaltmalar en üstte — cam/tekerlek altında kalmasın.
             Renge ek olarak basılıyor: form siyah-beyaz yazıcıdan
             çıktığında turuncu ile kırmızı ayırt edilemez. */}
      {sema.paneller.map((panel) => {
        const durumKodu = secim[panel.kod]
        const durum = durumKodu ? panelDurumu(durumKodu) : undefined
        if (!durum) return null
        return (
          <text
            key={`harf-${panel.kod}`}
            x={panel.yaziX}
            y={panel.yaziY}
            textAnchor="middle"
            fontSize={12}
            fontWeight={800}
            fill={durum.yazi}
            pointerEvents="none"
          >
            {durum.harf}
          </text>
        )
      })}
    </svg>
  )
}
