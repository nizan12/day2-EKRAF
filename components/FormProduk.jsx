"use client";

import { useState, useActionState, useRef } from "react";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";
import { buatDeskripsiAI, unggahFotoLangsung } from "@/app/admin/actions";

export default function FormProduk({ produk = {}, labelTombol, action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [nama, setNama] = useState(produk.nama || "");
  const [kategori, setKategori] = useState(produk.kategori || "");
  const [deskripsi, setDeskripsi] = useState(produk.deskripsi || "");

  // Manajemen Daftar Foto Produk (Multi-image CRUD)
  const initialPhotos = (produk.image || produk.foto_url || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const [daftarFoto, setDaftarFoto] = useState(initialPhotos);
  const [inputUrl, setInputUrl] = useState("");
  const [errorUrl, setErrorUrl] = useState(null);

  const [loadingUpload, setLoadingUpload] = useState(false);
  const [pesanUpload, setPesanUpload] = useState(null);
  const fileInputRef = useRef(null);

  const [modeManual, setModeManual] = useState(false);
  const [manualText, setManualText] = useState(daftarFoto.join(", "));

  const [loadingAI, setLoadingAI] = useState(false);
  const [pesanAI, setPesanAI] = useState(null);

  // Tambah URL baru ke daftar
  function handleTambahUrl() {
    setErrorUrl(null);
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setErrorUrl("Masukkan tautan URL foto terlebih dahulu.");
      return;
    }

    // Bisa memisahkan jika user paste beberapa URL sekaligus dipisah koma
    const urls = trimmed
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    const validUrls = urls.filter(
      (u) =>
        u.startsWith("http://") ||
        u.startsWith("https://") ||
        u.startsWith("/")
    );

    if (validUrls.length === 0) {
      setErrorUrl("Tautan URL harus diawali dengan http://, https://, atau /");
      return;
    }

    setDaftarFoto((prev) => {
      const updated = [...prev, ...validUrls];
      setManualText(updated.join(", "));
      return updated;
    });

    setInputUrl("");
  }

  // Upload file foto langsung ke storage Supabase
  async function handleUploadFile(e) {
    setPesanUpload(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 4.5 * 1024 * 1024) {
      setPesanUpload({
        error: `Ukuran file ${(file.size / (1024 * 1024)).toFixed(1)} MB terlalu besar. Maksimal 4.5 MB.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const tipeValid = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!tipeValid.includes(file.type)) {
      setPesanUpload({
        error: "Format file harus JPG, PNG, WEBP, atau GIF.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLoadingUpload(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await unggahFotoLangsung(formData);
      if (res?.error) {
        setPesanUpload({ error: res.error });
      } else if (res?.url) {
        setDaftarFoto((prev) => {
          const updated = [...prev, res.url];
          setManualText(updated.join(", "));
          return updated;
        });
        setPesanUpload({ sukses: "Foto berhasil diunggah dan ditambahkan." });
      }
    } catch (err) {
      setPesanUpload({ error: "Gagal mengunggah foto: " + err.message });
    } finally {
      setLoadingUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Hapus foto dari daftar
  function handleHapusFoto(index) {
    setDaftarFoto((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      setManualText(updated.join(", "));
      return updated;
    });
  }

  // Jadikan foto index ini sebagai foto utama (posisi pertama)
  function handleJadikanUtama(index) {
    if (index === 0) return;
    setDaftarFoto((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      const updated = [item, ...copy];
      setManualText(updated.join(", "));
      return updated;
    });
  }

  // Geser urutan foto
  function handleGeserUrutan(index, arah) {
    const target = index + arah;
    if (target < 0 || target >= daftarFoto.length) return;
    setDaftarFoto((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      setManualText(copy.join(", "));
      return copy;
    });
  }

  // Terapkan editan manual
  function handleTerapkanManual() {
    const parsed = manualText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setDaftarFoto(parsed);
    setModeManual(false);
  }

  // AI Generator
  async function handleBuatDeskripsiAI() {
    setPesanAI(null);
    if (!nama.trim()) {
      setPesanAI({
        error: "Isi nama produk terlebih dahulu untuk membuat deskripsi dengan AI.",
      });
      return;
    }

    setLoadingAI(true);
    try {
      const res = await buatDeskripsiAI({ nama, kategori });
      if (res?.error) {
        setPesanAI({ error: res.error });
      } else if (res?.deskripsi) {
        setDeskripsi(res.deskripsi);
        setPesanAI({ sukses: "Deskripsi berhasil dibuat dengan AI." });
      }
    } catch (err) {
      setPesanAI({ error: "Gagal membuat deskripsi: " + err.message });
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {produk.id && <input type="hidden" name="id" value={produk.id} />}

      {/* Hidden input yang memuat seluruh foto terupdate */}
      <input type="hidden" name="foto_url" value={daftarFoto.join(", ")} />

      <Input
        label="Nama produk"
        name="nama"
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        required
      />

      <Input
        label="Harga (Rp)"
        name="harga"
        type="number"
        min="0"
        defaultValue={produk.harga}
        required
      />

      <Input
        label="Kategori"
        name="kategori"
        value={kategori}
        onChange={(e) => setKategori(e.target.value)}
      />

      {/* Bagian Manajemen Gambar Produk */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-teks">
            Galeri Gambar Produk ({daftarFoto.length})
          </label>
          <button
            type="button"
            onClick={() => setModeManual(!modeManual)}
            className="text-xs font-medium text-teks-lembut hover:text-utama transition-colors"
          >
            {modeManual ? "Tutup Editor Teks" : "Edit Teks URL"}
          </button>
        </div>

        {modeManual && (
          <div className="rounded-xl border border-garis bg-permukaan/60 p-3 flex flex-col gap-2">
            <span className="text-xs text-teks-lembut font-medium">
              Edit tautan URL foto secara manual (pisahkan dengan koma jika lebih dari satu):
            </span>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-garis bg-latar p-2.5 text-xs font-mono text-teks focus:border-utama focus:outline-none"
              placeholder="https://contoh.com/foto1.jpg, https://contoh.com/foto2.jpg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleTerapkanManual}
                className="rounded-lg bg-utama px-3 py-1.5 text-xs font-semibold text-white hover:bg-utama-gelap transition-colors"
              >
                Terapkan Perubahan
              </button>
            </div>
          </div>
        )}

        {/* Thumbnail Grid & Pengelolaan Foto */}
        {daftarFoto.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl border border-garis bg-permukaan/40 p-3.5">
            {daftarFoto.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="group relative flex flex-col rounded-xl border border-garis bg-latar overflow-hidden shadow-xs hover:border-utama/50 transition-all"
              >
                {/* Gambar Thumbnail */}
                <div className="relative aspect-square w-full bg-permukaan overflow-hidden">
                  <img
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/images/placeholder.svg";
                    }}
                  />
                  {/* Badge Foto Utama */}
                  {idx === 0 ? (
                    <span className="absolute top-2 left-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      Foto Utama
                    </span>
                  ) : (
                    <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      #{idx + 1}
                    </span>
                  )}
                </div>

                {/* Baris Tombol Aksi */}
                <div className="flex items-center justify-between p-2 gap-1 bg-permukaan/80 border-t border-garis/60">
                  <div className="flex items-center gap-1">
                    {/* Tombol Geser Kiri / Atas */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleGeserUrutan(idx, -1)}
                      title="Geser ke kiri / sebelumnya"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-garis bg-latar text-teks-lembut hover:text-teks hover:border-teks-lembut disabled:opacity-30 disabled:cursor-not-allowed text-xs transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {/* Tombol Geser Kanan / Berikutnya */}
                    <button
                      type="button"
                      disabled={idx === daftarFoto.length - 1}
                      onClick={() => handleGeserUrutan(idx, 1)}
                      title="Geser ke kanan / sesudahnya"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-garis bg-latar text-teks-lembut hover:text-teks hover:border-teks-lembut disabled:opacity-30 disabled:cursor-not-allowed text-xs transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Tombol Jadikan Utama */}
                    {idx !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleJadikanUtama(idx)}
                        title="Jadikan Foto Utama"
                        className="rounded-md border border-garis bg-latar px-1.5 py-1 text-[10px] font-medium text-teks-lembut hover:text-emerald-600 hover:border-emerald-500 transition-colors"
                      >
                        Jadikan Utama
                      </button>
                    )}

                    {/* Tombol Hapus Foto */}
                    <button
                      type="button"
                      onClick={() => handleHapusFoto(idx)}
                      title="Hapus foto ini"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7a.75.75 0 0 1 .75-.75Zm3.59.75a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0v-7Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-garis bg-permukaan/30 py-6 px-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-teks-lembut mb-1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <p className="text-xs font-semibold text-teks">Belum ada foto produk</p>
            <p className="text-[11px] text-teks-lembut mt-0.5">
              Tambahkan foto melalui upload file atau tautan URL di bawah ini.
            </p>
          </div>
        )}

        {/* Input Tambah Gambar (Upload & URL) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-garis bg-permukaan/40 p-3.5">
          {/* Opsi 1: Upload File */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-teks flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-utama">
                <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909a.75.75 0 0 1-1.06 0l-4.22-4.219a.75.75 0 0 0-1.06 0L2.5 11.06ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
              </svg>
              Tambah dari Upload File (Maks. 4.5 MB)
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                disabled={loadingUpload}
                onChange={handleUploadFile}
                className="w-full text-xs text-teks-lembut file:mr-3 file:rounded-lg file:border-0 file:bg-utama file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white file:cursor-pointer hover:file:bg-utama-gelap cursor-pointer disabled:opacity-50"
              />
            </div>
            {loadingUpload && (
              <div className="flex items-center gap-2 text-xs text-utama font-medium mt-1">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Sedang mengunggah foto ke storage...</span>
              </div>
            )}
            {pesanUpload?.error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2 text-xs font-semibold text-red-700 dark:text-red-400 mt-1">
                {pesanUpload.error}
              </p>
            )}
            {pesanUpload?.sukses && (
              <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                {pesanUpload.sukses}
              </p>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-garis/60"></div>
            <span className="flex-shrink mx-2 text-[11px] uppercase tracking-wider text-teks-lembut font-medium">atau</span>
            <div className="flex-grow border-t border-garis/60"></div>
          </div>

          {/* Opsi 2: Tambah dari URL */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-teks flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-utama">
                <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
              </svg>
              Tambah dari URL Foto
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  setErrorUrl(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleTambahUrl();
                  }
                }}
                placeholder="https://images.unsplash.com/... atau /images/..."
                className="flex-1 rounded-lg border border-garis bg-latar px-3 py-1.5 text-xs text-teks placeholder:text-teks-lembut focus:border-utama focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTambahUrl}
                className="rounded-lg bg-utama px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-utama-gelap transition-colors shrink-0"
              >
                + Tambah URL
              </button>
            </div>
            {errorUrl && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {errorUrl}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bagian Deskripsi */}
      <div>
        <Input
          label={
            <span className="flex items-center justify-between">
              <span>Deskripsi</span>
              <button
                type="button"
                onClick={handleBuatDeskripsiAI}
                disabled={loadingAI}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-utama hover:text-utama-gelap disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingAI ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Sedang membuat…</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-utama">
                      <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a8.03 8.03 0 0 1-6.19 6.19l-1.192.24a1 1 0 0 0 0 1.96l1.192.24a8.03 8.03 0 0 1 6.19 6.19l.24 1.192a1 1 0 0 0 1.96 0l.24-1.192a8.03 8.03 0 0 1 6.19-6.19l1.192-.24a1 1 0 0 0 0-1.96l-1.192-.24a8.03 8.03 0 0 1-6.19-6.19l-.24-1.192Z" />
                    </svg>
                    <span>Buat dengan AI</span>
                  </>
                )}
              </button>
            </span>
          }
          name="deskripsi"
          textarea
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          placeholder="Tulis deskripsi atau klik 'Buat dengan AI' di atas"
        />
        {pesanAI?.error && (
          <p className="mt-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-bahaya">
            {pesanAI.error}
          </p>
        )}
        {pesanAI?.sukses && (
          <p className="mt-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-utama">
            {pesanAI.sukses}
          </p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Tombol type="submit" disabled={pending || loadingUpload}>
          {pending ? "Menyimpan…" : labelTombol}
        </Tombol>
        <Tombol href="/admin" varian="garis">
          Batal
        </Tombol>
      </div>
    </form>
  );
}
