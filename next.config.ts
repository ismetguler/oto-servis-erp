import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * AKICILIK — istemci yönlendirici önbelleği (client router cache)
   *
   * Panelin ~150 sayfası `dynamic = "force-dynamic"`. Next varsayılanında
   * dinamik sayfa istemcide 0 sn tutulur: Cari → Stok → geri Cari'ye
   * dönünce Cari sıfırdan sunucudan çekilir (~600 ms). `staleTimes.dynamic`
   * ile bir kez açılan ekran oturum boyunca (burada 3 dk) istemcide kalır;
   * ileri/geri ve menüden aynı ekrana dönüş ANINDA olur.
   *
   * Bayatlama riski yok: kayıt/güncelleme sunucu aksiyonları zaten
   * `revalidatePath` çağırıyor, o da ilgili yolun istemci önbelleğini
   * düşürüyor. Yani değişen veri bir sonraki gezinişte taze gelir.
   */
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
  async redirects() {
    return [
      // Teklif modülü kaldırıldı (SA-1 / 1.1). Eski yer imleri ve dış
      // bağlantılar Alınan Siparişler listesine düşsün — sipariş artık
      // teklif olmadan doğrudan açılıyor.
      {
        source: "/teklif/:path*",
        destination: "/siparis/alinan",
        permanent: false,
      },
      {
        source: "/baski/teklif/:path*",
        destination: "/siparis/alinan",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
