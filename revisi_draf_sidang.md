# Revisi Draf Sidang — Siap Tempel

Dokumen ini berisi teks pengganti untuk tiap poin temuan review, disusun sesuai urutan prioritas. Tempel langsung ke bagian yang sesuai di draf Word Anda, sesuaikan halaman/nomor gambar-tabel bila berubah akibat penyisipan/penghapusan.

---

## 1. Kontradiksi "Firebase Storage" — PRIORITAS TERTINGGI

Sistem **tidak** memakai Firebase Storage. Bukti dari kode asli (`firestore.rules`):
> "...disimpan sebagai data URI base64 karena tidak memakai Firebase Storage" — dan validasi `proofPhotoUrl.size() < 900000` (900 KB) justru ada **karena** foto disimpan langsung di dalam dokumen Firestore (limit dokumen 1 MB), bukan di Storage terpisah.

### 1.1 Abstrak & Abstract
**Cari & ganti** kalimat:
> "...menggunakan React, TypeScript, Firebase Authentication, Firebase Storage, dan Cloud Firestore..."

**Ganti menjadi:**
> "...menggunakan React, TypeScript, Firebase Authentication, dan Cloud Firestore sebagai basis data NoSQL yang mendukung sinkronisasi data secara real-time serta penyimpanan foto bukti serah terima langsung di dalam dokumen transaksi."

**Versi Inggris (Abstract):**
> "...developed using React, TypeScript, Firebase Authentication, and Cloud Firestore as a NoSQL database that supports real-time data synchronization, with handover proof photographs stored directly within transaction documents as base64-encoded data."

### 1.2 Bab 2.2.3 Firebase
Pada paragraf yang menyebut tiga layanan inti Firebase, ganti:
> "Firebase Authentication digunakan untuk mengelola proses login dan hak akses pengguna, Cloud Firestore digunakan untuk menyimpan dan menyinkronkan seluruh data inventori secara real-time, serta Firebase Hosting digunakan sebagai platform deployment aplikasi web."

**Menjadi:**
> "Firebase Authentication digunakan untuk mengelola proses login dan hak akses pengguna, sedangkan Cloud Firestore digunakan untuk menyimpan dan menyinkronkan seluruh data inventori secara real-time, termasuk foto bukti serah terima transfer yang disimpan sebagai data URI base64 langsung di dalam dokumen transaksi — bukan melalui Firebase Storage — agar sistem tetap sepenuhnya berjalan di atas satu layanan basis data tanpa komponen backend tambahan."

*(Hapus juga referensi "Firebase Hosting" bila aplikasi belum benar-benar di-deploy ke sana — sesuaikan dengan kondisi nyata saat sidang.)*

### 1.3 Bab 3.2 Analisis Arsitektur Sistem — teks
Ganti kalimat:
> "Data utama sistem disimpan pada Cloud Firestore, sedangkan Firebase Storage digunakan untuk menyimpan foto bukti penerimaan barang."

**Menjadi:**
> "Seluruh data utama sistem — termasuk foto bukti penerimaan barang pada proses transfer — disimpan pada Cloud Firestore. Foto bukti dikonversi menjadi data URI base64 dan disisipkan langsung ke dalam dokumen transfer, dibatasi berukuran kurang dari 900 KB agar tidak melampaui batas ukuran dokumen Firestore (1 MB). Pendekatan ini dipilih agar sistem tidak memerlukan layanan penyimpanan berkas terpisah (Firebase Storage) maupun server API tambahan."

Hapus juga poin "5. Unggah Foto Bukti Penerimaan" versi lama yang menyebut Firebase Storage, ganti dengan:
> "5. Unggah Foto Bukti Penerimaan
> Pada proses transfer stok antar-cabang, Manager Cabang tujuan mengunggah foto sebagai bukti bahwa barang telah diterima. Foto tersebut dikompresi dan dikonversi menjadi data URI base64 di sisi klien, kemudian disimpan langsung sebagai bagian dari dokumen transaksi transfer pada Cloud Firestore, tanpa melalui layanan penyimpanan berkas terpisah."

### 1.4 Tabel 3.4 Spesifikasi Server (Backend)
Baris "Media Storage — Firebase Storage (penyimpanan berkas foto bukti penerimaan)" → **hapus baris ini seluruhnya** (tidak relevan, tidak dipakai).

### 1.5 Tabel 3.55 Struktur Koleksi transfers — kolom `proofPhotoUrl`
Ganti keterangan:
> "URL foto bukti penerimaan barang (proof of delivery) yang disimpan pada Firebase Storage; bernilai null selama status masih 'dikirim' dan terisi setelah Manager Cabang tujuan mengunggah foto saat konfirmasi penerimaan"

**Menjadi:**
> "Data URI base64 dari foto bukti penerimaan barang (proof of delivery), disimpan langsung di dalam dokumen (bukan Firebase Storage) dan dibatasi < 900 KB agar tidak melampaui batas ukuran dokumen Firestore (1 MB); bernilai null selama status masih 'dikirim' dan terisi setelah Manager Cabang tujuan mengunggah foto saat konfirmasi penerimaan"

---

## 2. Gambar 3.3 — Arsitektur Sistem yang salah

Diagram lama menampilkan "Web Server (Aplikasi Inventori)" terpisah dari Database, plus Firebase Storage & FCM sebagai bagian aktif arsitektur — ini **tidak sesuai** sistem client-only yang sebenarnya kita bangun.

**Tindakan:** ganti Gambar 3.3 dengan diagram yang sudah dibuat di artifact sebelumnya (versi ikon: User → Internet → Firebase Authentication + Cloud Firestore langsung, tanpa Web Server, tanpa Firebase Storage). Screenshot artifact tersebut dan tempel sebagai Gambar 3.3 yang baru.

**Ganti seluruh narasi "Penjelasan setiap alur pada gambar" (poin 1–7)** dengan versi berikut (5 poin, bukan 7 — poin Web Server dan Firebase Storage dihapus):

> 1. **Permintaan Akses Aplikasi** — Pengguna (Administrator, Manager Cabang Bandung, Manager Cabang Pontianak) mengakses aplikasi React melalui web browser. Aplikasi dimuat sepenuhnya di sisi klien (Single Page Application).
> 2. **Kirim Request melalui Firebase SDK** — Setelah pengguna melakukan aktivitas pada aplikasi, React berkomunikasi **langsung** dengan layanan Firebase (Authentication dan Cloud Firestore) melalui Firebase Client SDK via internet, tanpa melalui server API atau backend perantara milik sendiri.
> 3. **Autentikasi via Firebase Authentication** — Permintaan login diverifikasi oleh Firebase Authentication; sesi pengguna beserta perannya (admin/manager) diperoleh dari dokumen pada koleksi `users` di Firestore.
> 4. **Simpan dan Ambil Data pada Cloud Firestore** — Seluruh data operasional (cabang, item, inventori, transaksi, transfer, termasuk foto bukti sebagai base64) disimpan dan diambil langsung dari Cloud Firestore. Firestore Security Rules memvalidasi setiap permintaan baca/tulis berdasarkan peran dan kepemilikan cabang pengguna sebelum data diizinkan tersimpan.
> 5. **Sinkronisasi Real-time** — Perubahan data yang tersimpan di Firestore secara otomatis didorong (push) kembali ke seluruh klien yang sedang membuka koleksi terkait melalui mekanisme `onSnapshot`, sehingga tampilan aplikasi selalu menampilkan data terbaru tanpa perlu memuat ulang halaman.

*(Firebase Cloud Messaging boleh tetap disebut di Batasan Masalah sebagai fitur yang **direncanakan namun belum diimplementasikan** — jangan digambarkan sebagai bagian aktif dari arsitektur di Gambar 3.3.)*

---

## 3. Class Diagram BCE — tambahkan disclaimer

Tambahkan paragraf berikut **tepat sebelum Tabel 3.24** di Bab 3.6.3, agar dosen tidak mengira nama kelas ini adalah nama literal file di kode:

> "Perlu dicatat bahwa Class Diagram ini merepresentasikan **struktur logis** sistem menggunakan pola Boundary-Control-Entity (BCE), bukan struktur kelas literal pada kode program. Implementasi aktual dibangun dengan React (functional component) tanpa pola Model-View-Controller konvensional; kelas *Boundary* pada diagram merepresentasikan komponen halaman React (mis. `TransferPage` → `src/pages/Transfers.tsx`), kelas *Control* merepresentasikan kumpulan fungsi penangan (handler) dan pemanggilan Firestore SDK pada komponen/hook terkait (mis. `TransferController.createTransfer()` → fungsi `onSubmit` pada `NewTransferForm.tsx`), dan kelas *Entity* merepresentasikan struktur dokumen Firestore yang didefinisikan melalui `interface` TypeScript (mis. `Transfer` → `interface Transfer` pada `src/pages/Transfers.tsx`)."

**Perbaikan konsistensi penamaan** (samakan SD dengan CD, pilih salah satu konvensi — disarankan pakai suffix `Page` karena sudah dipakai di CD dan di SD-13):
- Semua `...Boundary` di SD → ganti jadi `...Page` (`LoginBoundary`→`LoginPage`, `TransferBoundary`→`TransferPage`, `InventoryBoundary`→`InventoryPage`, `IncomingItemsBoundary`→`IncomingPage`, `OutgoingItemsBoundary`→`OutgoingPage`, `UserManagementBoundary`→`UserManagementPage`, `BranchBoundary`→`BranchManagementPage`, `ItemBoundary`→`ItemManagementPage`, `DashboardBoundary`→`DashboardPage`).
- `StockTransaction` → `Transaction`; `InventoryRecord` → `Inventory` (samakan dengan nama Entity di CD).
- `PhotoUploadController` (SD-04) → gabungkan ke `TransferController` (hapus sebagai kelas terpisah; tambahkan method `uploadProofPhoto()` ke `TransferController` di Tabel 3.42 jika perlu).
- `DashboardController` (SD-05) → ganti jadi `InventoryController` (karena dashboard hanya membaca data inventori/transaksi, tidak ada logika baru).
- `MasterDataController` (SD-07, SD-08) → ganti jadi `BranchController` (SD-07) dan `ItemController` (SD-08), sesuai kelas yang sudah ada.

---

## 4. Ambang Batas Stok Kritis — inkonsisten

**Gambar 3.9** (Activity Diagram Monitoring Stok): ganti teks langkah "Hitung statistik... Stok Kritis (qty < 50)" → **"Stok Kritis (qty < 100)"** agar konsisten dengan kode asli (`CRITICAL_STOCK_THRESHOLD = 100`), SKPL-F-07, dan seluruh bagian lain dokumen.

**Tabel 3.46/3.52 (`Item.minStock`)** — rancangan menyiratkan ambang per-item yang bisa diatur, padahal implementasi nyata memakai satu angka global (100) untuk semua item (halaman Stok Kritis sendiri menulis "segera hadir" untuk fitur per-item). Tambahkan catatan di Bab 3.7.1.3 setelah Tabel 3.52:

> "Pada versi sistem yang diimplementasikan, ambang batas stok kritis untuk seluruh item masih menggunakan nilai global sebesar 100 unit (lihat sub-bab 4.1.4 dan Bab 4.3.4 poin 1), sedangkan atribut `minStock` pada koleksi `items` disediakan sebagai skema basis data untuk pengembangan fitur ambang batas per-item pada tahap selanjutnya."

Lalu tambahkan satu poin baru di **Bab 4.3.4 Keterbatasan Sistem**:
> "5. Ambang batas stok kritis saat ini masih bersifat global (100 unit untuk seluruh item), belum dapat dikustomisasi per item meskipun skema data (`minStock`) sudah disiapkan pada koleksi `items`."

Dan tambahkan saran terkait di **Bab 5.2** (setelah poin 5 yang sudah ada):
> "8. Mengaktifkan penggunaan atribut `minStock` pada koleksi `items` agar ambang batas stok kritis dapat dikonfigurasi per item, menggantikan ambang batas global yang saat ini digunakan."

---

## 5. Konsistensi nama pemilik

Tiga ejaan berbeda ditemukan: "Endy Nurzaman" (Kata Pengantar) vs "Endi Nurjama" (Bab 1.5.1, Bab 2.1.1). **Cek dulu ejaan yang benar ke narasumber**, lalu Find & Replace satu ejaan yang konsisten di seluruh dokumen (Kata Pengantar, Bab 1.5.1, Bab 2.1.1, dan bagian mana pun nama ini muncul kembali seperti keterangan gambar/lampiran).

---

## 6. Pengujian Beta — hasil belum dilaporkan

Rencana pengujian Beta (wawancara Admin + kuesioner Manager) sudah disusun di 4.2.1.2, tapi hasilnya tidak pernah muncul di 4.2.2/4.2.3. **Tambahkan sub-bab baru "4.2.2.1 Hasil Pengujian Beta"** setelah Tabel 4.18, dengan struktur berikut (isi kolom jawaban dengan hasil wawancara/kuesioner yang **benar-benar dilakukan** — jangan diisi asumsi):

```
4.2.2.1 Hasil Pengujian Beta

Wawancara dengan Admin/Pemilik menghasilkan jawaban sebagai berikut:
a. [Tulis ringkasan jawaban pertanyaan 1 tentang monitoring real-time]
b. [Tulis ringkasan jawaban pertanyaan 2 tentang pengelolaan data master]

Kuesioner kepada 2 Manajer Cabang (Bandung dan Pontianak) menghasilkan rekap
jawaban sebagai berikut:

Tabel 4.20 Rekap Hasil Pengujian Beta
No | Pertanyaan                                    | SS | S | RR | TS | STS
1  | Mempermudah pencatatan barang masuk/keluar    |    |   |    |    |
2  | Mempermudah pemantauan stok real-time         |    |   |    |    |
3  | Mempermudah proses transfer antar cabang      |    |   |    |    |
4  | Mempermudah mengetahui stok kritis            |    |   |    |    |

Berdasarkan hasil pengujian beta di atas, dapat disimpulkan bahwa [X]% responden
menyatakan Setuju/Sangat Setuju terhadap seluruh pernyataan, sehingga sistem
dinilai [membantu/sangat membantu] operasional pengelolaan inventaris pada
Toko Snack Nyommy dari sudut pandang pengguna langsung.
```

*(Ini WAJIB diisi dengan data asli sebelum sidang — kalau belum sempat wawancara langsung, minimal kirim kuesioner via chat/form ke 2 manajer cabang dan pemilik, screenshot hasilnya untuk lampiran.)*

Tabel 4.18 (Hasil Pengujian Alpha) juga **wajib** diisi ulang berdasarkan pengujian sungguhan terhadap aplikasi yang berjalan (jalankan aplikasi, coba tiap skenario satu-satu, catat hasil aktual + screenshot untuk Lampiran) — jangan dibiarkan sebagai kerangka "Sesuai" semua tanpa dijalankan.

---

## 7. Minor / kerapian

**Tabel 2.3 yang hilang** — daripada menghapus dari Daftar Tabel (yang berarti harus renumber semua tabel sesudahnya), lebih mudah **isi tabelnya**. Draf isi Tabel 2.3:

| Aspek | Basis Data Relasional (SQL) | Basis Data NoSQL (Cloud Firestore) |
|---|---|---|
| Struktur data | Tabel dengan baris & kolom, skema tetap | Koleksi berisi dokumen, skema fleksibel |
| Relasi antar data | Foreign key & JOIN | Referensi ID manual antar dokumen |
| Sinkronisasi real-time | Tidak tersedia secara bawaan | Tersedia bawaan melalui `onSnapshot` listener |
| Skalabilitas | Vertikal (perlu upgrade server) | Horizontal, dikelola otomatis oleh penyedia cloud |
| Kebutuhan server | Wajib ada server basis data terpisah | Dapat diakses langsung dari klien (serverless) |
| Kesesuaian dengan sistem ini | Kurang sesuai untuk kebutuhan sinkronisasi stok real-time antar cabang | Sesuai — dipilih sebagai basis data utama sistem |

**Kata Pengantar:**
- Ganti "**Trasnfer**" → "**Transfer**" di judul skripsi pada paragraf pertama.
- Lengkapi item nomor 7 (jangan biarkan "7. ..." kosong) — isi dengan pihak lain yang relevan (teman satu bimbingan, pihak kampus, dsb.) atau hapus nomor itu dan renumber.

**Bab 3.6.2 poin 13** — kalimat rusak "*Activity Diagram ini dapatactivityMefungs dilihat pada Gambar 3.15*" → ganti jadi:
> "Activity Diagram ini dapat dilihat pada Gambar 3.17."
*(catatan: cek juga apakah nomor gambar yang dimaksud benar 3.17, bukan 3.15 — sesuai urutan Activity Diagram terakhir yaitu Generate Surat Jalan)*

**Tabel 4.18 — tambahkan kasus data tidak valid** (sesuai janji metodologi *equivalence partitioning* di 1.5.5), minimal untuk:
- Tambah item dengan nama/SKU kosong → sistem menolak, `FormMessage` validasi Zod muncul.
- Tambah cabang dengan field alamat kosong → ditolak validasi form.
- Input barang keluar dengan jumlah melebihi stok tersedia → sistem menolak dengan pesan "Stok tidak mencukupi" (skenario ini sudah ada di kode, `NewOutgoingItemForm.tsx:110-112`, tinggal ditambahkan sebagai baris uji).
- Transfer dengan cabang asal = cabang tujuan → ditolak oleh validasi `refine()` di `NewTransferForm.tsx` (sudah ada di kode, `data.fromBranchId !== data.toBranchId`).

---

## Checklist final sebelum kumpul

- [ ] Ganti semua penyebutan Firebase Storage (Abstrak, Bab 2.2.3, Bab 3.2, Tabel 3.4, Tabel 3.55)
- [ ] Ganti Gambar 3.3 dengan diagram client-only yang sudah dibuat di artifact
- [ ] Tambahkan disclaimer BCE di Bab 3.6.3 + samakan nama kelas SD ↔ CD
- [ ] Perbaiki "qty < 50" → "qty < 100" di Gambar 3.9 + tambahkan catatan minStock
- [ ] Samakan ejaan nama pemilik di seluruh dokumen
- [ ] Isi Tabel 4.18 dengan hasil pengujian sungguhan + screenshot
- [ ] Tambahkan sub-bab 4.2.2.1 Hasil Pengujian Beta dengan data wawancara/kuesioner asli
- [ ] Isi Tabel 2.3 yang hilang
- [ ] Perbaiki typo Kata Pengantar & kalimat rusak Bab 3.6.2
- [ ] Tambahkan minimal 4 baris kasus uji "data tidak valid" di Tabel 4.18
