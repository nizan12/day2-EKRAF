import Link from "next/link";
import { formatRupiah, ambilFotoUtama } from "@/lib/format";
import TombolKeranjang from "@/components/TombolKeranjang";
import TombolFavorit from "@/components/TombolFavorit";
import TombolBandingkan from "@/components/TombolBandingkan";

export default function KartuProduk({ produk }) {
  const isHabis =
    produk.stok === 0 ||
    produk.status_stok === "habis" ||
    produk.stok_habis === true;
  const adaDiskon =
    produk.harga_coret && Number(produk.harga_coret) > Number(produk.harga);
  const diskonPersen = adaDiskon
    ? Math.round((1 - Number(produk.harga) / Number(produk.harga_coret)) * 100)
    : 0;

  return (
    <Link
      href={`/produk/${produk.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-garis bg-latar transition hover:border-utama/50 hover:shadow-sm"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-permukaan">
        <img
          src={ambilFotoUtama(produk)}
          alt={produk.nama}
          className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
            isHabis ? "opacity-60 grayscale" : ""
          }`}
        />

        {/* Badge Diskon / Promo (US-20) */}
        {adaDiskon && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow">
            Hemat {diskonPersen}%
          </span>
        )}

        {/* Badge Status Stok (US-19) */}
        <span
          className={`absolute right-2.5 top-2.5 rounded-md px-2 py-0.5 text-xs font-semibold backdrop-blur-sm ${
            isHabis
              ? "bg-red-600/90 text-white"
              : "bg-emerald-600/85 text-white"
          }`}
        >
          {isHabis ? "Stok Habis" : "Tersedia"}
        </span>

        {/* Tombol Bandingkan (US-37) & Tombol Favorit (US-24) */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
          <TombolBandingkan produk={produk} ikonOnly />
          <TombolFavorit produk={produk} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-xs text-teks-lembut">{produk.kategori}</p>
        <h3 className="font-semibold leading-snug group-hover:text-utama">{produk.nama}</h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <p className="rounded-md bg-harga-latar px-2 py-0.5 text-sm font-bold text-harga">
              {formatRupiah(produk.harga)}
            </p>
            {adaDiskon && (
              <span className="text-xs text-teks-lembut line-through">
                {formatRupiah(produk.harga_coret)}
              </span>
            )}
          </div>
          <TombolKeranjang produk={produk} className="py-1 px-2.5 text-xs" teks="+ Keranjang" />
        </div>
      </div>
    </Link>
  );
}
