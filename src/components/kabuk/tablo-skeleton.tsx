import { Skeleton } from "@/components/ui/skeleton"

/**
 * LİSTE İSKELETİ — `loading.tsx` dosyalarında kullanılır.
 *
 * Navigasyonda boş beyaz ekran yerine tablo hayaleti görünür; gerçek veri
 * hazır olunca Next.js iskeleti otomatik olarak içerikle değiştirir.
 * Sütun/satır sayısı ekrana göre ayarlanır ki hayalet gerçek tabloya yakın
 * dursun (layout sıçraması az olsun).
 */
export function TabloSkeleton({
  satir = 12,
  sutun = 6,
  baslik = true,
  filtre = true,
}: {
  satir?: number
  sutun?: number
  baslik?: boolean
  filtre?: boolean
}) {
  const izgara = { gridTemplateColumns: `repeat(${sutun}, minmax(0, 1fr))` }

  return (
    <div className="flex flex-col">
      {baslik ? (
        <div className="sayfa-basligi">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
      ) : null}

      <div className="p-4">
        <div className="panel overflow-hidden">
          {filtre ? (
            <div className="flex flex-wrap gap-2 border-b border-border p-3">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-32" />
            </div>
          ) : null}

          <div className="divide-y divide-border/70">
            <div className="grid gap-3 bg-secondary px-3 py-2" style={izgara}>
              {Array.from({ length: sutun }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 w-full max-w-[6rem]" />
              ))}
            </div>

            {Array.from({ length: satir }).map((_, r) => (
              <div key={r} className="grid items-center gap-3 px-3 py-2.5" style={izgara}>
                {Array.from({ length: sutun }).map((_, c) => (
                  <Skeleton
                    key={c}
                    className="h-3.5"
                    style={{
                      width: "100%",
                      maxWidth: c === 0 ? "4rem" : c === 1 ? "100%" : "7rem",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
