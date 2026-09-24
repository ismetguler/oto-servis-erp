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
 * SİPARİŞ "YAZDIR" MENÜSÜ (adım 11.9) — `EvrakYazdirMenu` (11.8) ve kabul
 * kartındaki (11.7) tek düğme + açılır menü deseninin aynısı. Alınan ve
 * verilen sipariş AYNI seçenekleri görüyor (Sipariş Formu tek şablon,
 * başlığı `tip` alanından kendisi çözüyor), o yüzden bileşen tipe göre
 * dallanmıyor.
 *
 * Toplama Fişi'nin iki görünümü var (A4 / Termal); menüde tek satır tutulup
 * geçiş bağlantısı fişin kendi üstünde bırakıldı — menüyü iki neredeyse
 * aynı satırla şişirmemek için.
 */
export function SiparisYazdirMenu({ id }: { id: number }) {
  const secenekler = [
    { href: `/baski/siparis/${id}`, etiket: "Sipariş Formu" },
    { href: `/baski/toplama-fisi/siparis/${id}`, etiket: "Toplama Fişi" },
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
