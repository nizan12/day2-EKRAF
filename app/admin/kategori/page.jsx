import NavAdmin from "@/components/NavAdmin";
import Tombol from "@/components/Tombol";
import { buatClientServer } from "@/lib/supabase";
import { ambilPengaturanAdmin } from "@/lib/pengaturanAdmin";
import { tambahKategoriAdmin, hapusKategoriAdmin } from "@/app/admin/actions";

export const metadata = {
  title: "Kelola Kategori - Admin",
};

export default async function HalamanKelolaKategori() {
  const supabase = buatClientServer();
  const { data: produk } = await supabase.from("produk").select("kategori");

  const pengaturan = await ambilPengaturanAdmin();
  const kategoriKustom = pengaturan.kategoriList || [];

  // Hitung jumlah produk per kategori
  const hitungKategori = {};
  (produk || []).forEach((p) => {
    if (p.kategori) {
      hitungKategori[p.kategori] = (hitungKategori[p.kategori] || 0) + 1;
    }
  });

  const semuaKategori = [
    ...new Set([...Object.keys(hitungKategori), ...kategoriKustom]),
  ].sort();

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-teks">Kelola Kategori</h1>
          <p className="mt-1 text-sm text-teks-lembut">
            Tambah dan pantau kategori menu kopi & camilan di tokomu.
          </p>
        </div>
        <Tombol href="/admin" varian="garis">
          ← Kembali ke Produk
        </Tombol>
      </div>

      {/* Form Tambah Kategori */}
      <div className="rounded-2xl border border-garis bg-permukaan p-5">
        <h2 className="text-base font-bold text-teks">Tambah Kategori Baru</h2>
        <form action={tambahKategoriAdmin} className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            name="nama"
            required
            placeholder="Contoh: Kopi Dingin, Pastry, Cold Brew…"
            className="flex-1 min-w-[200px] rounded-lg border border-garis bg-latar px-3.5 py-2 text-sm text-teks placeholder:text-teks-lembut focus:border-utama focus:outline-none"
          />
          <Tombol type="submit" varian="utama">
            + Tambah Kategori
          </Tombol>
        </form>
      </div>

      {/* Tabel Kategori */}
      <div className="overflow-x-auto rounded-2xl border border-garis bg-latar">
        <table className="w-full text-left text-sm">
          <thead className="bg-permukaan text-teks-lembut">
            <tr>
              <th className="px-5 py-3 font-semibold">Nama Kategori</th>
              <th className="px-5 py-3 font-semibold">Jumlah Produk</th>
              <th className="px-5 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {semuaKategori.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-teks-lembut">
                  Belum ada kategori yang terdaftar.
                </td>
              </tr>
            ) : (
              semuaKategori.map((kat) => {
                const totalItem = hitungKategori[kat] || 0;
                return (
                  <tr key={kat} className="border-t border-garis">
                    <td className="px-5 py-3.5 font-bold text-teks">{kat}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-utama/10 px-2.5 py-0.5 text-xs font-semibold text-utama">
                        {totalItem} produk
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {kategoriKustom.includes(kat) && (
                        <form action={hapusKategoriAdmin} className="inline">
                          <input type="hidden" name="nama" value={kat} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                          >
                            Hapus Kategori
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
