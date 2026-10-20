"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRupiah, ambilFotoUtama } from "@/lib/format";
import Tombol from "@/components/Tombol";
import {
  hapusProduk,
  toggleStatusProduk,
  simpanUrutanProduk,
  imporProdukCSV,
} from "@/app/admin/actions";

export default function TabelProduk({ daftarProduk, nonaktifIds = [] }) {
  const [cari, setCari] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [modalImpor, setModalImpor] = useState(false);
  const [statusImpor, setStatusImpor] = useState(null);
  const [memproses, setMemproses] = useState(false);

  const ITEM_PER_PAGE = 8;

  // Filter pencarian dan kategori
  const terfilter = daftarProduk.filter((p) => {
    const matchCari =
      !cari ||
      p.nama.toLowerCase().includes(cari.toLowerCase()) ||
      (p.kategori && p.kategori.toLowerCase().includes(cari.toLowerCase()));
    const matchKategori = !kategoriFilter || p.kategori === kategoriFilter;
    return matchCari && matchKategori;
  });

  // Paginasi di admin (US-33)
  const totalHalaman = Math.ceil(terfilter.length / ITEM_PER_PAGE) || 1;
  const halamanAktif = Math.min(halaman, totalHalaman);
  const awal = (halamanAktif - 1) * ITEM_PER_PAGE;
  const produkTampil = terfilter.slice(awal, awal + ITEM_PER_PAGE);

  // Ambil daftar kategori unik
  const kategoriList = [
    ...new Set(daftarProduk.map((p) => p.kategori).filter(Boolean)),
  ].sort();

  // Geser urutan produk (US-47)
  async function geserUrutan(index, arah) {
    const targetIdx = index + arah;
    if (targetIdx < 0 || targetIdx >= daftarProduk.length) return;

    const copy = [...daftarProduk];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    const urutanIds = copy.map((p) => p.id);
    await simpanUrutanProduk(urutanIds);
  }

  // Handle Impor CSV
  async function handleImpor(e) {
    e.preventDefault();
    setMemproses(true);
    setStatusImpor(null);
    const formData = new FormData(e.target);
    const res = await imporProdukCSV(null, formData);
    setMemproses(false);
    if (res?.error) {
      setStatusImpor({ error: res.error });
    } else if (res?.sukses) {
      setStatusImpor({ sukses: res.sukses });
      setTimeout(() => {
        setModalImpor(false);
        setStatusImpor(null);
      }, 1500);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: Cari, Filter, Ekspor, Impor */}
      <div className="flex flex-col gap-3 rounded-2xl border border-garis bg-permukaan p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Kolom Cari Produk (US-33) */}
          <input
            type="search"
            placeholder="Cari nama atau kategori…"
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
            className="w-full rounded-xl border border-garis bg-latar px-3.5 py-2 text-sm text-teks placeholder:text-teks-lembut focus:border-utama focus:outline-none sm:w-60"
          />

          {/* Filter Kategori */}
          <select
            value={kategoriFilter}
            onChange={(e) => {
              setKategoriFilter(e.target.value);
              setHalaman(1);
            }}
            className="rounded-xl border border-garis bg-latar px-3 py-2 text-sm text-teks focus:border-utama focus:outline-none"
          >
            <option value="">Semua Kategori</option>
            {kategoriList.map((kat) => (
              <option key={kat} value={kat}>
                {kat}
              </option>
            ))}
          </select>
        </div>

        {/* Tombol Ekspor CSV & Impor CSV (US-35 & US-46) */}
        <div className="flex items-center gap-2">
          <a
            href="/admin/ekspor-csv"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-latar px-3.5 py-2 text-xs font-bold text-teks transition hover:border-utama hover:text-utama shadow-xs"
            title="Unduh seluruh data produk ke file CSV"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-3.5 w-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.5V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Ekspor CSV</span>
          </a>

          <button
            type="button"
            onClick={() => setModalImpor(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-latar px-3.5 py-2 text-xs font-bold text-teks transition hover:border-utama hover:text-utama shadow-xs"
            title="Unggah berkas CSV untuk menambah banyak produk sekaligus"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-3.5 w-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.5V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <span>Impor CSV</span>
          </button>
        </div>
      </div>

      {/* Tabel Data Produk */}
      <div className="overflow-x-auto rounded-2xl border border-garis bg-latar">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-permukaan text-teks-lembut">
            <tr>
              <th className="px-4 py-3 font-semibold">Urutan</th>
              <th className="px-4 py-3 font-semibold">Produk</th>
              <th className="px-4 py-3 font-semibold">Kategori</th>
              <th className="px-4 py-3 font-semibold">Harga</th>
              <th className="px-4 py-3 font-semibold">Status (Katalog)</th>
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {produkTampil.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-teks-lembut">
                  Tidak ada produk yang cocok dengan pencarian.
                </td>
              </tr>
            ) : (
              produkTampil.map((produk, idx) => {
                const globalIdx = awal + idx;
                const isNonaktif = nonaktifIds.includes(produk.id);

                return (
                  <tr key={produk.id} className="border-t border-garis hover:bg-permukaan/40 transition">
                    {/* Urutan tampil (US-47) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => geserUrutan(globalIdx, -1)}
                          disabled={globalIdx === 0}
                          className="rounded p-1 text-xs text-teks-lembut hover:bg-permukaan hover:text-teks disabled:opacity-30"
                          title="Geser ke Atas"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => geserUrutan(globalIdx, 1)}
                          disabled={globalIdx === daftarProduk.length - 1}
                          className="rounded p-1 text-xs text-teks-lembut hover:bg-permukaan hover:text-teks disabled:opacity-30"
                          title="Geser ke Bawah"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    {/* Info Produk */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={ambilFotoUtama(produk)}
                          alt=""
                          className="h-11 w-11 rounded-lg border border-garis object-cover bg-permukaan"
                          onError={(e) => {
                            e.currentTarget.src = "/images/placeholder.svg";
                          }}
                        />
                        <div>
                          <span className="font-semibold block text-teks leading-tight">
                            {produk.nama}
                          </span>
                          <span className="text-xs text-teks-lembut">ID: #{produk.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-teks-lembut">{produk.kategori || "—"}</td>
                    <td className="px-4 py-3 font-bold text-harga">{formatRupiah(produk.harga)}</td>

                    {/* Toggle Status Aktif / Nonaktif (US-32) */}
                    <td className="px-4 py-3">
                      <form action={toggleStatusProduk}>
                        <input type="hidden" name="id" value={produk.id} />
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition shadow-xs ${
                            isNonaktif
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                          }`}
                          title="Klik untuk mengubah status tampil di katalog pengunjung"
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isNonaktif ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                          />
                          <span>{isNonaktif ? "Nonaktif (Draft)" : "Aktif (Tampil)"}</span>
                        </button>
                      </form>
                    </td>

                    {/* Aksi Ubah & Hapus */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Tombol href={`/admin/produk/${produk.id}/ubah`} varian="garis" className="py-1 px-3 text-xs">
                          Ubah
                        </Tombol>
                        <form
                          action={hapusProduk}
                          onSubmit={(e) => {
                            if (!confirm(`Yakin ingin menghapus produk "${produk.nama}"?`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={produk.id} />
                          <Tombol type="submit" varian="bahaya" className="py-1 px-3 text-xs">
                            Hapus
                          </Tombol>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginasi Tabel Admin (US-33) */}
      {totalHalaman > 1 && (
        <div className="flex items-center justify-between border-t border-garis pt-4 text-xs text-teks-lembut">
          <p>
            Menampilkan <span className="font-bold text-teks">{awal + 1}</span>–
            <span className="font-bold text-teks">
              {Math.min(awal + ITEM_PER_PAGE, terfilter.length)}
            </span>{" "}
            dari <span className="font-bold text-teks">{terfilter.length}</span> produk
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHalaman((h) => Math.max(1, h - 1))}
              disabled={halamanAktif <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-garis bg-latar px-3 py-1.5 font-semibold text-teks hover:border-utama disabled:opacity-40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
              </svg>
              <span>Sebelumnya</span>
            </button>
            <span className="font-bold text-teks">
              Halaman {halamanAktif} dari {totalHalaman}
            </span>
            <button
              type="button"
              onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))}
              disabled={halamanAktif >= totalHalaman}
              className="inline-flex items-center gap-1 rounded-lg border border-garis bg-latar px-3 py-1.5 font-semibold text-teks hover:border-utama disabled:opacity-40"
            >
              <span>Selanjutnya</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Modal Impor CSV (US-46) */}
      {modalImpor && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalImpor(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-garis bg-latar p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-garis pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-utama/10 text-utama">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.5V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-teks">Impor Produk dari CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalImpor(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-teks-lembut hover:bg-permukaan hover:text-teks transition"
                aria-label="Tutup modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleImpor} className="mt-4 flex flex-col gap-4">
              <p className="text-xs text-teks-lembut leading-relaxed">
                Pilih file <strong>.csv</strong> yang berisi kolom:
                <br />
                <code className="mt-1 block rounded bg-permukaan p-2 text-[11px] font-mono text-teks">
                  ID,Nama Produk,Kategori,Harga,Deskripsi,Foto URL
                </code>
              </p>

              <div className="rounded-xl border-2 border-dashed border-garis p-6 text-center bg-permukaan/50">
                <input
                  type="file"
                  name="file_csv"
                  accept=".csv,text/csv"
                  required
                  className="w-full text-xs text-teks-lembut file:mr-3 file:rounded-lg file:border-0 file:bg-utama file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-utama-gelap"
                />
              </div>

              {statusImpor?.error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-xs font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                  {statusImpor.error}
                </div>
              )}

              {statusImpor?.sukses && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-xs font-semibold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50">
                  {statusImpor.sukses}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-garis">
                <button
                  type="button"
                  onClick={() => setModalImpor(false)}
                  className="rounded-xl border border-garis px-4 py-2 text-xs font-semibold text-teks hover:bg-permukaan"
                >
                  Batal
                </button>
                <Tombol type="submit" disabled={memproses}>
                  {memproses ? "Memproses…" : "Mulai Impor Produk"}
                </Tombol>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
