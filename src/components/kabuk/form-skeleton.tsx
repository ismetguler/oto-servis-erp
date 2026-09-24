import { Skeleton } from "@/components/ui/skeleton"

/**
 * FORM / DETAY İSKELETİ — form ve detay rotalarının `loading.tsx`'inde
 * kullanılır ki liste iskeleti (tablo hayaleti) bu ekranlara sızmasın.
 */
export function FormSkeleton({ alan = 8 }: { alan?: number }) {
  return (
    <div className="flex flex-col">
      <div className="sayfa-basligi">
        <div className="space-y-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>

      <div className="p-4">
        <div className="panel p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: alan }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
