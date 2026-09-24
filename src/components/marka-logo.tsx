import { cn } from "@/lib/utils"

/**
 * Marka işareti — altıgen somun başı içinde anahtar ağzı.
 * Otomotiv servis çağrışımı yapsın diye seçildi; tek renk olduğu için
 * hem koyu menüde hem beyaz zeminde çalışır.
 */
export function MarkaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-8", className)}
    >
      <path
        d="M16 2.4 27.4 9v14L16 29.6 4.6 23V9L16 2.4Z"
        className="fill-current opacity-15"
      />
      <path
        d="M16 2.4 27.4 9v14L16 29.6 4.6 23V9L16 2.4Z"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M20.2 11.6a4.6 4.6 0 0 0-6.1 5.6l-4.3 4.3a1.4 1.4 0 0 0 0 2l.7.7a1.4 1.4 0 0 0 2 0l4.3-4.3a4.6 4.6 0 0 0 5.6-6.1l-2.5 2.5-2.2-.6-.6-2.2 2.5-2.5Z"
        className="fill-current"
      />
    </svg>
  )
}
