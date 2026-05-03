import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Tutorial = () => {
  useEffect(() => {
    document.title = "Snack Nyommy - Inventory System - Tutorial Penggunaan";
  }, []);

  return (
    <Card className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
      <CardHeader>
        <CardTitle>Tutorial Penggunaan Aplikasi</CardTitle>
        <CardDescription className="text-slate-300">Panduan langkah demi langkah untuk menggunakan sistem inventaris Snack Nyommy.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Gambaran Umum</h2>
          <p className="text-slate-200">
            Aplikasi Snack Nyommy Inventory System dirancang untuk membantu Anda mengelola inventaris barang di berbagai cabang.
            Sistem ini memungkinkan Anda untuk melacak item, mengelola stok, melakukan transfer antar cabang, dan mengelola pengguna.
          </p>
        </section>

        <Separator className="bg-white/10" />

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Login</h2>
          <p className="text-slate-200">
            Untuk memulai, Anda perlu login menggunakan kredensial yang telah diberikan.
            Jika Anda belum memiliki akun, silakan hubungi administrator sistem.
          </p>
          <ul className="list-disc list-inside text-slate-200 mt-2">
            <li>Buka halaman <Link to="/login" className="text-blue-400 hover:underline">Login</Link>.</li>
            <li>Masukkan Email dan Kata Sandi Anda.</li>
            <li>Klik tombol "Masuk".</li>
          </ul>
        </section>

        <Separator className="bg-white/10" />

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Navigasi Sidebar</h2>
          <p className="text-slate-200">
            Setelah login, Anda akan melihat sidebar di sisi kiri layar. Sidebar ini berisi tautan ke berbagai fitur utama aplikasi:
          </p>
          <ul className="list-disc list-inside text-slate-200 mt-2 space-y-1">
            <li><strong>Dasbor:</strong> Ringkasan umum inventaris dan aktivitas terbaru.</li>
            <li><strong>Cabang:</strong> Mengelola informasi cabang perusahaan (tambah, edit, hapus).</li>
            <li><strong>Item:</strong> Mengelola daftar master item (tambah, edit, hapus).</li>
            <li><strong>Inventaris:</strong> Melihat dan mengelola stok item di setiap cabang.</li>
            <li><strong>Transfer:</strong> Mengelola permintaan transfer item antar cabang (buat, setujui, tolak).</li>
            <li><strong>Pengguna:</strong> (Hanya untuk Admin) Mengelola akun pengguna dan peran mereka.</li>
          </ul>
        </section>

        <Separator className="bg-white/10" />

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Fitur Utama</h2>
          <h3 className="text-lg font-semibold mt-4 mb-1">4.1. Manajemen Cabang</h3>
          <p className="text-slate-200">
            Di halaman <Link to="/branches" className="text-blue-400 hover:underline">Cabang</Link>, Anda dapat:
          </p>
          <ul className="list-disc list-inside text-slate-200 mt-2 space-y-1">
            <li>Menambahkan cabang baru dengan detail seperti nama, lokasi, alamat, dan telepon.</li>
            <li>Mengedit informasi cabang yang sudah ada.</li>
            <li>Menghapus cabang (hanya Admin).</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4 mb-1">4.2. Manajemen Item</h3>
          <p className="text-slate-200">
            Halaman <Link to="/items" className="text-blue-400 hover:underline">Item</Link> adalah pusat pengelolaan data master untuk semua produk atau barang yang Anda miliki. Di sini, Anda dapat:
          </p>
          <ul className="list-disc list-inside text-slate-200 mt-2 space-y-1">
            <li>Menambahkan item baru dengan detail lengkap seperti SKU unik, kategori, dan unit pengukuran.</li>
            <li>Mengedit detail item yang sudah ada untuk menjaga informasi tetap akurat.</li>
            <li>Menghapus item (hanya Admin) yang sudah tidak relevan.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4 mb-1">4.3. Manajemen Inventaris</h3>
          <p className="text-slate-200">
            Di halaman <Link to="/inventory" className="text-blue-400 hover:underline">Inventaris</Link>, Anda memiliki kontrol penuh atas stok barang di setiap cabang secara real-time. Anda dapat:
          </p>
          <ul className="list-disc list-inside text-slate-200 mt-2 space-y-1">
            <li>Melihat stok item yang tersedia di setiap cabang secara terperinci.</li>
            <li>Mengelola stok dengan mudah, termasuk menambah atau mengurangi kuantitas untuk item tertentu di cabang tertentu, serta melacak riwayat penambahan stok.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4 mb-1">4.4. Manajemen Transfer</h3>
          <p className="text-slate-200">
            Halaman <Link to="/transfers" className="text-blue-400 hover:underline">Transfer</Link> memungkinkan Anda untuk mengelola pergerakan barang antar cabang dengan efisien dan tercatat. Ini digunakan untuk:
          </p>
          <ul className="list-disc list-inside text-slate-200 mt-2 space-y-1">
            <li>Membuat permintaan transfer item dari satu cabang ke cabang lain, memastikan ketersediaan barang di lokasi yang tepat.</li>
            <li>Melihat status setiap transfer (pending, completed, rejected) untuk pemantauan yang jelas.</li>
            <li>Menyetujui atau menolak permintaan transfer (tergantung peran dan cabang) untuk menjaga kontrol penuh atas pergerakan stok.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4 mb-1">4.5. Manajemen Pengguna (Admin Saja)</h3>
          <p className="text-slate-200">
            Halaman <Link to="/users" className="text-blue-400 hover:underline">Pengguna</Link> (hanya terlihat oleh Admin) memungkinkan Anda untuk:
          </p>
          <ul className="list-disc list-inside text-slate-200 mt-2 space-y-1">
            <li>Menambahkan pengguna baru dengan peran (Admin atau Manajer) dan cabang yang ditugaskan.</li>
            <li>Mengedit detail pengguna yang sudah ada.</li>
          </ul>
        </section>

        <Separator className="bg-white/10" />

        <section>
          <h2 className="text-xl font-semibold mb-2">5. Bantuan dan Dukungan</h2>
          <p className="text-slate-200">
            Jika Anda mengalami kesulitan atau memiliki pertanyaan lebih lanjut, silakan hubungi tim dukungan Anda.
          </p>
        </section>

        <div className="flex justify-center mt-8">
          <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white">
            <Link to="/">Kembali ke Dasbor</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Tutorial;