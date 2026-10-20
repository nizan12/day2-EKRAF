import { notFound } from "next/navigation";
import NavAdmin from "@/components/NavAdmin";
import FormProduk from "@/components/FormProduk";
import { buatClientServer } from "@/lib/supabase";
import { ubahProduk } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HalamanUbahProduk({ params }) {
  const { id } = await params;

  const supabase = buatClientServer();
  const { data: produk, error } = await supabase
    .from("produk")
    .select("id, nama, harga, deskripsi, foto_url, kategori, image")
    .eq("id", id)
    .single();

  if (error || !produk) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <h1 className="text-2xl font-extrabold">Ubah produk</h1>
      <FormProduk produk={produk} labelTombol="Simpan perubahan" action={ubahProduk} />
    </div>
  );
}
