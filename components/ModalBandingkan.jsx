"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ambilProdukBandingkan,
  toggleBandingkan,
  kosongkanBandingkan,
} from "@/lib/pembanding";
import { formatRupiah, ambilFotoUtama } from "@/lib/format";
import { toko } from "@/lib/toko";
import { tambahKeKeranjang } from "@/lib/keranjang";

export default function ModalBandingkan() {
  const [items, setItems] = useState([]);
  const [modalBuka, setModalBuka] = useState(false);

  useEffect(() => {
    setItems(ambilProdukBandingkan());

    function handleUpdate(e) {
      setItems(e.detail || ambilProdukBandingkan());
    }

    window.addEventListener("bandingkan-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("bandingkan-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  if (items.length === 0) return null;

  const item1 = items[0];
  const item2 = items[1];

  return (
    <>
      {/* Floating Bar Pembanding di Bagian Bawah Layar */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-garis bg-latar/95 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all">
        <div className="flex items-center gap-2">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <img
                src={item.image}
                alt={item.nama}
                className="h-10 w-10 rounded-xl object-cover border border-garis"
              />
              <button
                type="button"
                onClick={() => toggleBandingkan(item)}
                className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-xs hover:bg-red-600 transition"
                title="Hapus dari perbandingan"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          ))}

          {items.length === 1 && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-garis text-[11px] font-semibold text-teks-lembut">
              +1
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-garis" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalBuka(true)}
            disabled={items.length < 2}
            className="inline-flex items-center gap-1.5 rounded-xl bg-utama px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-utama-gelap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M1 4.75C1 3.784 1.784 3 2.75 3h14.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 17.25 17H2.75A1.75 1.75 0 0 1 1 15.25V4.75ZM2.75 4.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h6.5v-11h-6.5Zm8 0v11h6.5a.25.25 0 0 0 .25-.25V4.75a.25.25 0 0 0-.25-.25h-6.5Z" clipRule="evenodd" />
            </svg>
            <span>Bandingkan ({items.length}/2)</span>
          </button>

          <button
            type="button"
            onClick={kosongkanBandingkan}
            className="text-xs text-teks-lembut hover:text-red-500 transition px-1"
            title="Tutup pembanding"
          >
            Batal
          </button>
        </div>
      </div>

      {/* Modal Dialog Pembanding 2 Produk */}
      {modalBuka && item1 && item2 && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalBuka(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-garis bg-latar p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-garis pb-4">
              <div>
                <h2 className="text-xl font-bold text-teks">Perbandingan Produk</h2>
                <p className="text-xs text-teks-lembut">
                  Perbandingan spesifikasi dan harga menu berdampingan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalBuka(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-teks-lembut hover:bg-permukaan hover:text-teks transition"
                aria-label="Tutup"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Konten Perbandingan Grid */}
            <div className="flex-1 overflow-y-auto py-5">
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {[item1, item2].map((item, idx) => {
                  const lawan = idx === 0 ? item2 : item1;
                  const isLebihMurah = item.harga < lawan.harga;
                  const urlWa = `https://wa.me/${toko.nomorWhatsApp}?text=${encodeURIComponent(
                    `Halo, saya ingin memesan: *${item.nama}* seharga ${formatRupiah(item.harga)}.`
                  )}`;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col rounded-2xl border border-garis bg-permukaan p-4 sm:p-5"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-latar border border-garis">
                        <img
                          src={ambilFotoUtama(item.image)}
                          alt={item.nama}
                          onError={(e) => {
                            e.currentTarget.src = "/images/placeholder.svg";
                          }}
                          className="h-full w-full object-cover"
                        />
                        {isLebihMurah && (
                          <span className="absolute top-2.5 left-2.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                            Harga Lebih Hemat
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex-1">
                        <span className="rounded bg-latar border border-garis px-2 py-0.5 text-[10px] font-semibold text-teks-lembut">
                          {item.kategori || "Umum"}
                        </span>
                        <h3 className="mt-1 text-base font-bold text-teks">{item.nama}</h3>
                        <p className="mt-1 text-lg font-extrabold text-harga">
                          {formatRupiah(item.harga)}
                        </p>

                        <div className="mt-3 border-t border-garis pt-3">
                          <p className="text-xs font-semibold text-teks mb-1">Deskripsi:</p>
                          <p className="text-xs text-teks-lembut leading-relaxed line-clamp-4">
                            {item.deskripsi}
                          </p>
                        </div>
                      </div>

                      {/* Tombol Aksi */}
                      <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-garis">
                        <a
                          href={urlWa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center rounded-xl bg-utama py-2 text-xs font-bold text-white hover:bg-utama-gelap transition"
                        >
                          Pesan via WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => tambahKeKeranjang(item, 1)}
                          className="inline-flex w-full items-center justify-center rounded-xl border border-garis bg-latar py-2 text-xs font-bold text-teks hover:border-utama hover:text-utama transition"
                        >
                          + Keranjang
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="border-t border-garis pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setModalBuka(false)}
                className="rounded-xl border border-garis bg-permukaan px-5 py-2 text-xs font-bold text-teks hover:border-utama hover:text-utama"
              >
                Tutup Perbandingan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
