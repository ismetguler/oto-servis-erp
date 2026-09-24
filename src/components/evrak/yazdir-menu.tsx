import Link from "next/link"
import { ChevronDown, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * EVRAK "YAZDIR" MENÜSÜ (adım 11.8) — hangi baskı şablonunun anlamlı olduğu
 * evrak TÜRÜNE göre değişir (11.7'deki kabul kartı menüsüyle aynı desen,
 * `/servis/kabul/[id]`). PERAKENDE (Hızlı Satış) için tam fatura yerine Fiş
 * öne çıkarılıyor; İADE_SATIS/İADE_ALIS için tek anlamlı seçenek İade
 * Faturası — bir iadede "İrsaliye" ya da "Tevkifat" seçeneği göstermek
 * kafa karıştırırdı.
 *
 * 11.9'da AYNI menüye iki seçenek daha eklendi (ayrı düğme açılmadı):
 * **Kargo Etiketi** (koli üstü yapışkan etiket — A4 İrsaliye kâğıdıyla
 * karıştırılmasın) ve **Toplama Fişi** (depocunun raf listesi, A4/Termal).
 * İkisi de sevkiyatla ilgili olduğu için iade evrakında GÖSTERİLMİYOR:
 * iadede mal gelir, gitmez.
 */
export function EvrakYazdirMenu({ id, tur }: { id: number; tur: string }) {
  const sevkiyatSecenekleri = [
    { href: `/baski/kargo-etiket/${id}`, etiket: "Kargo Etiketi" },
    { href: `/baski/toplama-fisi/evrak/${id}`, etiket: "Toplama Fişi" },
  ]

  const secenekler: { href: string; etiket: string }[] =
    tur === "IADE_SATIS" || tur === "IADE_ALIS"
      ? [{ href: `/baski/iade-faturasi/${id}`, etiket: "İade Faturası" }]
      : tur === "PERAKENDE"
        ? [
            { href: `/baski/fis/${id}`, etiket: "Fiş" },
            { href: `/baski/servis-fatura/${id}`, etiket: "Fatura" },
            ...sevkiyatSecenekleri,
          ]
        : [
            { href: `/baski/servis-fatura/${id}`, etiket: "Servis Fatura" },
            { href: `/baski/irsaliyeli-fatura/${id}`, etiket: "İrsaliyeli Fatura" },
            { href: `/baski/tevkifatli-fatura/${id}`, etiket: "Tevkifatlı Fatura" },
            { href: `/baski/irsaliye/${id}`, etiket: "İrsaliye" },
            ...sevkiyatSecenekleri,
          ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="size-4" aria-hidden />
          Yazdır
          <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {secenekler.map((s) => (
          <DropdownMenuItem key={s.href} asChild>
            <Link href={s.href} target="_blank">
              {s.etiket}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
