import { buatClientServer, buatClientSesi } from "@/lib/supabase";
import { toko as defaultToko } from "@/lib/toko";

const CONFIG_FILE = "pengaturan.json";

export async function ambilPengaturanAdmin() {
  try {
    const supabase = buatClientServer();
    const { data, error } = await supabase.storage.from("image").download(CONFIG_FILE);
    if (error || !data) {
      return defaultState();
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    return {
      nonaktifIds: Array.isArray(parsed.nonaktifIds) ? parsed.nonaktifIds : [],
      urutanIds: Array.isArray(parsed.urutanIds) ? parsed.urutanIds : [],
      kategoriList: Array.isArray(parsed.kategoriList) ? parsed.kategoriList : [],
      tokoInfo: parsed.tokoInfo || defaultToko,
      analitikKlik: parsed.analitikKlik || {},
      auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
      ulasanList: Array.isArray(parsed.ulasanList) ? parsed.ulasanList : [],
    };
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return {
    nonaktifIds: [],
    urutanIds: [],
    kategoriList: [],
    tokoInfo: defaultToko,
    analitikKlik: {},
    auditLog: [],
    ulasanList: [],
  };
}

export async function simpanPengaturanAdmin(pengaturan) {
  try {
    const supabase = buatClientServer();
    const current = await ambilPengaturanAdmin();
    const merged = { ...current, ...pengaturan };
    const buffer = Buffer.from(JSON.stringify(merged, null, 2));
    await supabase.storage.from("image").upload(CONFIG_FILE, buffer, {
      upsert: true,
      contentType: "application/json",
    });
    return true;
  } catch (err) {
    console.error("Gagal menyimpan pengaturan admin:", err);
    return false;
  }
}

/**
 * US-40: Mencatat analitik klik pemesanan WhatsApp
 */
export async function catatKlikProduk({ produkId, nama, harga = 0, jumlah = 1 }) {
  try {
    const config = await ambilPengaturanAdmin();
    const analitik = config.analitikKlik || {};
    const existing = analitik[produkId] || {
      id: produkId,
      nama: nama || "Produk",
      totalKlik: 0,
      totalJumlah: 0,
      totalNilai: 0,
      terakhirKlik: new Date().toISOString(),
    };

    analitik[produkId] = {
      ...existing,
      nama: nama || existing.nama,
      totalKlik: existing.totalKlik + 1,
      totalJumlah: existing.totalJumlah + Number(jumlah),
      totalNilai: existing.totalNilai + Number(harga) * Number(jumlah),
      terakhirKlik: new Date().toISOString(),
    };

    await simpanPengaturanAdmin({ analitikKlik: analitik });
    return true;
  } catch (err) {
    console.error("Gagal mencatat analitik klik:", err);
    return false;
  }
}

/**
 * US-45: Mencatat audit log aktivitas admin
 */
export async function catatLogAktivitas(aksi, rincian = "") {
  try {
    let emailUser = "Admin";
    try {
      const supabaseSesi = await buatClientSesi();
      const {
        data: { user },
      } = await supabaseSesi.auth.getUser();
      if (user?.email) emailUser = user.email;
    } catch {
      // Abaikan jika tidak ada sesi aktif
    }

    const config = await ambilPengaturanAdmin();
    const logList = Array.isArray(config.auditLog) ? config.auditLog : [];

    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: emailUser,
      aksi,
      rincian,
    };

    // Batasi log hingga 100 entri terbaru
    const updatedLogs = [newEntry, ...logList].slice(0, 100);
    await simpanPengaturanAdmin({ auditLog: updatedLogs });
    return true;
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
    return false;
  }
}

/**
 * US-38 & US-39: Manajemen Ulasan dan Rating Produk
 */
export async function ambilUlasanProduk(produkId) {
  const config = await ambilPengaturanAdmin();
  const list = Array.isArray(config.ulasanList) ? config.ulasanList : [];
  return list.filter((u) => String(u.produkId) === String(produkId) && u.status === "disetujui");
}

export async function tambahUlasanProduk({ produkId, nama, rating, komentar }) {
  const config = await ambilPengaturanAdmin();
  const list = Array.isArray(config.ulasanList) ? config.ulasanList : [];

  const newReview = {
    id: Date.now().toString(),
    produkId: String(produkId),
    nama: nama || "Pelanggan",
    rating: Math.max(1, Math.min(5, Number(rating) || 5)),
    komentar: komentar || "",
    status: "disetujui",
    tanggal: new Date().toISOString(),
  };

  const updated = [newReview, ...list];
  await simpanPengaturanAdmin({ ulasanList: updated });
  return newReview;
}

export async function ubahStatusUlasan(id, statusBaru) {
  const config = await ambilPengaturanAdmin();
  const list = Array.isArray(config.ulasanList) ? config.ulasanList : [];
  const updated = list.map((u) => (u.id === id ? { ...u, status: statusBaru } : u));
  await simpanPengaturanAdmin({ ulasanList: updated });
  return true;
}

export async function hapusUlasanAdmin(id) {
  const config = await ambilPengaturanAdmin();
  const list = Array.isArray(config.ulasanList) ? config.ulasanList : [];
  const updated = list.filter((u) => u.id !== id);
  await simpanPengaturanAdmin({ ulasanList: updated });
  return true;
}
