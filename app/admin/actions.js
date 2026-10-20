"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { buatClientSesi, buatClientServer } from "@/lib/supabase";
import { toko } from "@/lib/toko";
import {
  ambilPengaturanAdmin,
  simpanPengaturanAdmin,
  catatLogAktivitas,
} from "@/lib/pengaturanAdmin";

// Rate limit proteksi brute-force login (K-12)
const rateLimitMap = new Map();

export async function loginAdmin(prevState, formData) {
  const email = formData.get("email")?.toLowerCase()?.trim();
  const password = formData.get("password");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  // Cek rate limiting
  const now = Date.now();
  const attempt = rateLimitMap.get(email) || { count: 0, lockUntil: 0 };

  if (attempt.lockUntil > now) {
    const sisaMenit = Math.ceil((attempt.lockUntil - now) / 60000);
    return {
      error: `Terlalu banyak percobaan gagal. Akun dibatasi sementara, silakan coba ${sisaMenit} menit lagi.`,
    };
  }

  const supabase = await buatClientSesi();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const newCount = attempt.count + 1;
    if (newCount >= 5) {
      // Kunci selama 10 menit
      rateLimitMap.set(email, { count: newCount, lockUntil: now + 10 * 60 * 1000 });
      return {
        error: "Terlalu banyak percobaan gagal. Akun dibatasi sementara selama 10 menit.",
      };
    } else {
      rateLimitMap.set(email, { count: newCount, lockUntil: 0 });
    }
    return { error: `Email atau password salah. (Sisa percobaan: ${5 - newCount})` };
  }

  // Reset percobaan jika login sukses
  rateLimitMap.delete(email);

  await catatLogAktivitas("Login Admin", `Admin ${email} berhasil login.`);
  redirect("/admin");
}

export async function logoutAdmin() {
  const supabase = await buatClientSesi();
  await catatLogAktivitas("Logout Admin", "Admin keluar dari sesi.");
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function gantiPassword(prevState, formData) {
  const passwordBaru = formData.get("password_baru");
  const konfirmasi = formData.get("konfirmasi_password");

  if (!passwordBaru || !konfirmasi) {
    return { error: "Semua field wajib diisi." };
  }

  if (passwordBaru.length < 8) {
    return { error: "Password baru minimal 8 karakter." };
  }

  if (passwordBaru !== konfirmasi) {
    return { error: "Password baru dan konfirmasi tidak sama." };
  }

  const supabase = await buatClientSesi();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const { error } = await supabase.auth.updateUser({
    password: passwordBaru,
  });

  if (error) {
    return { error: "Gagal mengganti password. " + error.message };
  }

  await catatLogAktivitas("Ganti Password", "Admin memperbarui password akun.");
  return { sukses: "Password berhasil diganti." };
}

export async function tambahProduk(prevState, formData) {
  const supabase = await buatClientSesi();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const nama = formData.get("nama")?.trim();
  const harga = parseInt(formData.get("harga"), 10);
  const kategori = formData.get("kategori")?.trim() || null;
  const deskripsi = formData.get("deskripsi")?.trim() || null;

  // Validasi form server ketat (US-34)
  if (!nama || nama.length < 3) {
    return { error: "Nama produk wajib diisi minimal 3 karakter." };
  }
  if (nama.length > 100) {
    return { error: "Nama produk maksimal 100 karakter." };
  }
  if (isNaN(harga) || harga < 100) {
    return { error: "Harga minimal Rp 100." };
  }
  if (harga > 100000000) {
    return { error: "Harga maksimal Rp 100.000.000." };
  }
  if (deskripsi && deskripsi.length > 1000) {
    return { error: "Deskripsi maksimal 1000 karakter." };
  }

  const inputUrl = formData.get("foto_url");
  let daftarUrl = [];
  if (inputUrl && typeof inputUrl === "string") {
    daftarUrl = inputUrl.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // Upload file gambar (US-29)
  const berkasGambar = formData.get("file_gambar");
  if (berkasGambar && typeof berkasGambar === "object" && berkasGambar.size > 0) {
    if (berkasGambar.size > 5 * 1024 * 1024) {
      return { error: "Ukuran foto maksimal 5 MB." };
    }
    const tipeValid = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!tipeValid.includes(berkasGambar.type)) {
      return { error: "Format foto harus JPG, PNG, WEBP, atau GIF." };
    }

    const supabaseServer = buatClientServer();
    const ekstensi = berkasGambar.name.split(".").pop() || "jpg";
    const namaFile = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ekstensi}`;
    const buffer = Buffer.from(await berkasGambar.arrayBuffer());

    const { error: uploadError } = await supabaseServer.storage
      .from("image")
      .upload(namaFile, buffer, {
        contentType: berkasGambar.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { error: "Gagal mengunggah foto ke storage: " + uploadError.message };
    }

    const { data: { publicUrl } } = supabaseServer.storage
      .from("image")
      .getPublicUrl(namaFile);

    daftarUrl.push(publicUrl);
  }

  const imageFinal = daftarUrl.length > 0 ? daftarUrl.join(", ") : "/images/placeholder.svg";

  const supabaseServer = buatClientServer();
  const { error } = await supabaseServer.from("produk").insert({
    nama,
    harga,
    kategori,
    foto_url: imageFinal,
    image: imageFinal,
    deskripsi,
  });

  if (error) {
    return { error: "Gagal menyimpan produk: " + error.message };
  }

  await catatLogAktivitas("Tambah Produk", `Menambahkan "${nama}" (Rp ${harga.toLocaleString("id-ID")})`);
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

export async function ubahProduk(prevState, formData) {
  const supabaseSesi = await buatClientSesi();

  const { data: { user } } = await supabaseSesi.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const id = formData.get("id");
  const nama = formData.get("nama")?.trim();
  const harga = parseInt(formData.get("harga"), 10);
  const kategori = formData.get("kategori")?.trim() || null;
  const deskripsi = formData.get("deskripsi")?.trim() || null;

  if (!id) {
    return { error: "ID produk tidak ditemukan." };
  }

  // Validasi form server ketat (US-34)
  if (!nama || nama.length < 3) {
    return { error: "Nama produk wajib diisi minimal 3 karakter." };
  }
  if (nama.length > 100) {
    return { error: "Nama produk maksimal 100 karakter." };
  }
  if (isNaN(harga) || harga < 100) {
    return { error: "Harga minimal Rp 100." };
  }
  if (harga > 100000000) {
    return { error: "Harga maksimal Rp 100.000.000." };
  }
  if (deskripsi && deskripsi.length > 1000) {
    return { error: "Deskripsi maksimal 1000 karakter." };
  }

  const dataUpdate = {
    nama,
    harga,
    kategori,
    deskripsi,
  };

  const inputUrl = formData.get("foto_url");
  let daftarUrl = [];
  if (inputUrl && typeof inputUrl === "string") {
    daftarUrl = inputUrl.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const berkasGambar = formData.get("file_gambar");
  if (berkasGambar && typeof berkasGambar === "object" && berkasGambar.size > 0) {
    if (berkasGambar.size > 5 * 1024 * 1024) {
      return { error: "Ukuran foto maksimal 5 MB." };
    }
    const tipeValid = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!tipeValid.includes(berkasGambar.type)) {
      return { error: "Format foto harus JPG, PNG, WEBP, atau GIF." };
    }

    const supabaseServer = buatClientServer();
    const ekstensi = berkasGambar.name.split(".").pop() || "jpg";
    const namaFile = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ekstensi}`;
    const buffer = Buffer.from(await berkasGambar.arrayBuffer());

    const { error: uploadError } = await supabaseServer.storage
      .from("image")
      .upload(namaFile, buffer, {
        contentType: berkasGambar.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { error: "Gagal mengunggah foto ke storage: " + uploadError.message };
    }

    const { data: { publicUrl } } = supabaseServer.storage
      .from("image")
      .getPublicUrl(namaFile);

    daftarUrl.push(publicUrl);
  }

  if (formData.has("foto_url") || berkasGambar?.size > 0) {
    const finalFoto = daftarUrl.length > 0 ? daftarUrl.join(", ") : "/images/placeholder.svg";
    dataUpdate.foto_url = finalFoto;
    dataUpdate.image = finalFoto;
  }

  const supabaseServer = buatClientServer();
  const { data, error } = await supabaseServer
    .from("produk")
    .update(dataUpdate)
    .eq("id", Number(id))
    .select();

  if (error) {
    return { error: "Gagal menyimpan perubahan: " + error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Gagal memperbarui data: produk ID #" + id + " tidak ditemukan." };
  }

  await catatLogAktivitas("Ubah Produk", `Memperbarui produk ID #${id} (${nama})`);
  revalidatePath("/admin");
  revalidatePath(`/admin/produk/${id}/ubah`);
  revalidatePath(`/produk/${id}`);
  revalidatePath("/");
  redirect("/admin");
}

export async function hapusProduk(formData) {
  const supabaseSesi = await buatClientSesi();

  const { data: { user } } = await supabaseSesi.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const id = formData.get("id");
  if (!id) {
    return;
  }

  const supabaseServer = buatClientServer();
  await supabaseServer.from("produk").delete().eq("id", Number(id));
  await catatLogAktivitas("Hapus Produk", `Menghapus produk ID #${id}`);

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

export async function unggahFotoLangsung(formData) {
  const supabaseSesi = await buatClientSesi();
  const {
    data: { user },
  } = await supabaseSesi.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const file = formData.get("file");
  if (!file || typeof file !== "object" || file.size === 0) {
    return { error: "File foto tidak ditemukan." };
  }

  if (file.size > 4.5 * 1024 * 1024) {
    return {
      error: `Ukuran foto (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 4.5 MB.`,
    };
  }

  const tipeValid = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!tipeValid.includes(file.type)) {
    return { error: "Format foto harus JPG, PNG, WEBP, atau GIF." };
  }

  const supabaseServer = buatClientServer();
  const ekstensi = file.name.split(".").pop() || "jpg";
  const namaFile = `produk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ekstensi}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseServer.storage
    .from("image")
    .upload(namaFile, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return { error: "Gagal mengunggah foto ke storage: " + uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("image").getPublicUrl(namaFile);

  return { sukses: true, url: publicUrl };
}

export async function buatDeskripsiAI({ nama, kategori }) {
  const supabase = await buatClientSesi();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  if (!nama || !nama.trim()) {
    return { error: "Nama produk harus diisi terlebih dahulu." };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      error:
        "GEMINI_API_KEY belum diisi di file .env.local. Tambahkan variabel GEMINI_API_KEY untuk menggunakan fitur AI ini.",
    };
  }

  const prompt = `Buatkan deskripsi produk yang menarik, singkat (2-3 kalimat), dan menggugah minat pembeli untuk kedai "${toko.nama}".
Nama produk: ${nama.trim()}
${kategori ? `Kategori: ${kategori.trim()}` : ""}
Aturan Penulisan:
1. Tulis dalam bahasa Indonesia yang ramah, sopan, dan menggugah selera pembeli.
2. Jangan gunakan format tebal/markdown (*, #), buat sebagai teks paragraf polos saja.
3. JANGAN PERNAH MENGGUNAKAN EMOJI APAPUN dalam jawabanmu.`;

  const models = [
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
  ];
  let lastError = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        }
      );

      const json = await res.json();
      const hasil = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (hasil) {
        // Bersihkan emoji dan sisa format markdown
        const bersih = hasil
          .replace(/[\p{Extended_Pictographic}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
          .replace(/[*#_~`]/g, "")
          .trim();
        return { deskripsi: bersih };
      }
      if (json?.error?.message) {
        lastError = json.error.message;
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  return {
    error:
      "Gagal menghasilkan deskripsi AI. " +
      (lastError || "Pastikan GEMINI_API_KEY valid."),
  };
}

export async function toggleStatusProduk(formData) {
  const supabase = await buatClientSesi();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const id = formData.get("id");
  if (!id) return;

  const pengaturan = await ambilPengaturanAdmin();
  let nonaktifIds = Array.isArray(pengaturan.nonaktifIds) ? [...pengaturan.nonaktifIds] : [];

  const isSudahNonaktif = nonaktifIds.includes(id);
  if (isSudahNonaktif) {
    nonaktifIds = nonaktifIds.filter((item) => item !== id);
  } else {
    nonaktifIds.push(id);
  }

  await simpanPengaturanAdmin({ ...pengaturan, nonaktifIds });
  await catatLogAktivitas(
    "Ubah Status Tampil",
    `Produk ID #${id} diubah menjadi ${isSudahNonaktif ? "Aktif" : "Nonaktif (Draft)"}`
  );

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function simpanUrutanProduk(urutanIds) {
  const supabase = await buatClientSesi();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesi login telah berakhir." };
  }

  if (!Array.isArray(urutanIds)) {
    return { error: "Format data urutan salah." };
  }

  const pengaturan = await ambilPengaturanAdmin();
  await simpanPengaturanAdmin({ ...pengaturan, urutanIds });
  await catatLogAktivitas("Atur Urutan Produk", "Memperbarui urutan prioritas produk di katalog.");

  revalidatePath("/admin");
  revalidatePath("/");
  return { sukses: true };
}

export async function tambahKategoriAdmin(prevState, formData) {
  const supabase = await buatClientSesi();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const namaKategori = formData.get("nama")?.trim();
  if (!namaKategori || namaKategori.length < 2) {
    return { error: "Nama kategori minimal 2 karakter." };
  }

  const pengaturan = await ambilPengaturanAdmin();
  const kategoriList = Array.isArray(pengaturan.kategoriList) ? [...pengaturan.kategoriList] : [];
  if (!kategoriList.includes(namaKategori)) {
    kategoriList.push(namaKategori);
    await simpanPengaturanAdmin({ ...pengaturan, kategoriList });
    await catatLogAktivitas("Tambah Kategori", `Menambahkan kategori "${namaKategori}"`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/kategori");
  return { sukses: "Kategori baru berhasil ditambahkan." };
}

export async function hapusKategoriAdmin(formData) {
  const supabase = await buatClientSesi();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const namaKategori = formData.get("nama")?.trim();
  if (!namaKategori) return;

  const pengaturan = await ambilPengaturanAdmin();
  const kategoriList = (pengaturan.kategoriList || []).filter((k) => k !== namaKategori);
  await simpanPengaturanAdmin({ ...pengaturan, kategoriList });
  await catatLogAktivitas("Hapus Kategori", `Menghapus kategori "${namaKategori}"`);

  revalidatePath("/admin");
  revalidatePath("/admin/kategori");
}

export async function imporProdukCSV(prevState, formData) {
  const supabase = await buatClientSesi();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const file = formData.get("file_csv");
  if (!file || typeof file !== "object" || file.size === 0) {
    return { error: "Harap pilih file CSV untuk diimpor." };
  }

  try {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      return { error: "File CSV kosong atau hanya berisi baris judul header." };
    }

    const rowsToInsert = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      if (cols.length < 2) continue;

      const nama = cols[1] || cols[0];
      const harga = parseInt(cols[3] || cols[1] || "0", 10);
      const kategori = cols[2] || "Umum";
      const deskripsi = cols[4] || null;
      const foto_url = cols[5] || "/images/placeholder.svg";

      if (nama && !isNaN(harga) && harga >= 0) {
        rowsToInsert.push({
          nama,
          harga,
          kategori,
          deskripsi,
          foto_url,
          image: foto_url,
        });
      }
    }

    if (rowsToInsert.length === 0) {
      return { error: "Tidak ada baris produk valid yang dapat diimpor dari file ini." };
    }

    const { error: insertError } = await supabase.from("produk").insert(rowsToInsert);
    if (insertError) {
      return { error: "Gagal menyimpan produk: " + insertError.message };
    }

    await catatLogAktivitas("Impor Produk CSV", `Berhasil memasukkan ${rowsToInsert.length} produk sekaligus.`);
    revalidatePath("/admin");
    revalidatePath("/");
    return { sukses: `Berhasil mengimpor ${rowsToInsert.length} produk!` };
  } catch (err) {
    return { error: "Gagal memproses file CSV: " + err.message };
  }
}

/**
 * US-43: Pengaturan toko dari admin
 */
export async function simpanPengaturanToko(prevState, formData) {
  const supabase = await buatClientSesi();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const nama = formData.get("nama")?.trim();
  const nomorWhatsApp = formData.get("nomorWhatsApp")?.trim();
  const alamat = formData.get("alamat")?.trim();
  const jamBuka = formData.get("jamBuka")?.trim();
  const tagline = formData.get("tagline")?.trim();

  if (!nama || nama.length < 2) {
    return { error: "Nama toko minimal 2 karakter." };
  }
  if (!nomorWhatsApp || !/^\d{9,16}$/.test(nomorWhatsApp)) {
    return { error: "Nomor WhatsApp harus angka format internasional tanpa + (misal: 6281234567890)." };
  }
  if (!alamat || alamat.length < 5) {
    return { error: "Alamat toko minimal 5 karakter." };
  }
  if (!jamBuka) {
    return { error: "Jam operasional toko harus diisi." };
  }

  const tokoInfo = {
    nama,
    nomorWhatsApp,
    alamat,
    jamBuka,
    tagline: tagline || "",
  };

  const sukses = await simpanPengaturanAdmin({ tokoInfo });
  if (!sukses) {
    return { error: "Gagal menyimpan pengaturan ke database." };
  }

  await catatLogAktivitas("Ubah Pengaturan Toko", `Nama Toko: ${nama}, WA: ${nomorWhatsApp}`);
  revalidatePath("/");
  revalidatePath("/tentang");
  revalidatePath("/admin/pengaturan");
  return { sukses: "Pengaturan profil toko berhasil diperbarui!" };
}

/**
 * US-44: Kelola akun admin (Tambah akun)
 */
export async function tambahAdmin(prevState, formData) {
  const supabaseSesi = await buatClientSesi();
  const {
    data: { user },
  } = await supabaseSesi.auth.getUser();
  if (!user) {
    return { error: "Sesi login sudah berakhir. Silakan login kembali." };
  }

  const email = formData.get("email")?.trim();
  const password = formData.get("password")?.trim();

  if (!email || !email.includes("@")) {
    return { error: "Email admin tidak valid." };
  }
  if (!password || password.length < 8) {
    return { error: "Password akun admin minimal 8 karakter." };
  }

  try {
    const supabaseServer = buatClientServer();
    const { data: newUser, error } = await supabaseServer.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      return { error: "Gagal membuat akun admin: " + error.message };
    }

    await catatLogAktivitas("Tambah Akun Admin", `Akun baru dibuat untuk ${email}`);
    revalidatePath("/admin/pengguna");
    return { sukses: `Akun admin ${email} berhasil dibuat!` };
  } catch (err) {
    return { error: "Terjadi kesalahan: " + err.message };
  }
}

/**
 * US-44: Hapus akun admin
 */
export async function hapusAdmin(formData) {
  const supabaseSesi = await buatClientSesi();
  const {
    data: { user: currentUser },
  } = await supabaseSesi.auth.getUser();
  if (!currentUser) {
    redirect("/admin/login");
  }

  const userId = formData.get("id");
  if (!userId) return;

  if (userId === currentUser.id) {
    // Larang menghapus diri sendiri untuk mencegah lockout
    return;
  }

  try {
    const supabaseServer = buatClientServer();
    await supabaseServer.auth.admin.deleteUser(userId);
    await catatLogAktivitas("Hapus Akun Admin", `Menghapus admin user ID #${userId}`);
    revalidatePath("/admin/pengguna");
  } catch (err) {
    console.error("Gagal menghapus user admin:", err);
  }
}

/**
 * US-45: Kosongkan riwayat log aktivitas
 */
export async function kosongkanLogAktivitas() {
  const supabaseSesi = await buatClientSesi();
  const {
    data: { user },
  } = await supabaseSesi.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  await simpanPengaturanAdmin({ auditLog: [] });
  revalidatePath("/admin/aktivitas");
}

/**
 * US-38: Kirim ulasan dan rating produk dari pengunjung
 */
export async function kirimUlasanAction(prevState, formData) {
  const produkId = formData.get("produkId");
  const nama = formData.get("nama")?.trim();
  const rating = parseInt(formData.get("rating") || "5", 10);
  const komentar = formData.get("komentar")?.trim();

  if (!produkId) {
    return { error: "ID produk tidak valid." };
  }
  if (!nama || nama.length < 2) {
    return { error: "Nama pengulas minimal 2 karakter." };
  }
  if (!komentar || komentar.length < 3) {
    return { error: "Tulis ulasan Anda minimal 3 karakter." };
  }

  const { tambahUlasanProduk } = await import("@/lib/pengaturanAdmin");
  await tambahUlasanProduk({
    produkId,
    nama,
    rating,
    komentar,
  });

  revalidatePath(`/produk/${produkId}`);
  return { sukses: "Terima kasih! Ulasan dan rating Anda berhasil dikirim." };
}

/**
 * US-39: Moderasi ulasan oleh admin (Ubah status atau hapus)
 */
export async function moderasiUlasanAction(formData) {
  const supabaseSesi = await buatClientSesi();
  const {
    data: { user },
  } = await supabaseSesi.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const id = formData.get("id");
  const statusBaru = formData.get("status");
  if (!id || !statusBaru) return;

  const { ubahStatusUlasan, catatLogAktivitas } = await import("@/lib/pengaturanAdmin");
  await ubahStatusUlasan(id, statusBaru);
  await catatLogAktivitas("Moderasi Ulasan", `Ulasan ID #${id} diubah statusnya menjadi ${statusBaru}`);
  revalidatePath("/admin/ulasan");
}

export async function hapusUlasanAction(formData) {
  const supabaseSesi = await buatClientSesi();
  const {
    data: { user },
  } = await supabaseSesi.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const id = formData.get("id");
  if (!id) return;

  const { hapusUlasanAdmin, catatLogAktivitas } = await import("@/lib/pengaturanAdmin");
  await hapusUlasanAdmin(id);
  await catatLogAktivitas("Hapus Ulasan", `Menghapus ulasan ID #${id}`);
  revalidatePath("/admin/ulasan");
}

