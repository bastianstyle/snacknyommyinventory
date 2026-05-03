# Snack Nyommy Inventory System

Selamat datang di Snack Nyommy Inventory System! Aplikasi ini adalah solusi manajemen inventaris berbasis web yang dirancang untuk membantu bisnis melacak dan mengelola stok barang di berbagai cabang dengan efisien.

## Fitur Utama

*   **Manajemen Cabang:** Tambah, edit, dan hapus informasi cabang perusahaan.
*   **Manajemen Item:** Kelola daftar master item dengan detail lengkap seperti SKU, kategori, dan unit. Ini adalah fondasi untuk semua pencatatan inventaris Anda.
*   **Manajemen Inventaris:** Pantau stok item secara real-time di setiap cabang, lakukan penyesuaian stok, dan lacak riwayat penambahan stok untuk visibilitas penuh.
*   **Manajemen Transfer:** Buat, setujui, atau tolak permintaan transfer item antar cabang dengan proses yang terstruktur, memastikan pergerakan stok yang akurat dan tercatat.
*   **Manajemen Pengguna:** (Hanya Admin) Kelola akun pengguna dengan peran berbeda (Admin, Manajer) dan penugasan cabang.
*   **Dasbor Interaktif:** Dapatkan ringkasan cepat tentang status inventaris, transfer tertunda, dan peringatan stok rendah.
*   **Sistem Peran:** Akses fitur disesuaikan berdasarkan peran pengguna (Admin memiliki akses penuh, Manajer terbatas pada cabang yang ditugaskan).

## Teknologi yang Digunakan

*   **Frontend:** React.js (dengan TypeScript)
*   **Styling:** Tailwind CSS
*   **Komponen UI:** Shadcn/ui
*   **Routing:** React Router DOM
*   **State Management:** React Context API (untuk autentikasi)
*   **Database & Autentikasi:** Firebase (Firestore & Authentication)
*   **Build Tool:** Vite

## Instalasi (Pengembangan Lokal)

Untuk menjalankan aplikasi ini di lingkungan pengembangan lokal Anda:

1.  **Clone repositori:**
    ```bash
    git clone <URL_REPOSITORI_ANDA>
    cd eka-net-home-inventory
    ```

2.  **Instal dependensi:**
    ```bash
    npm install
    ```

3.  **Konfigurasi Firebase:**
    *   Buat proyek baru di Firebase Console.
    *   Aktifkan Firestore Database dan Firebase Authentication (Email/Password).
    *   Dapatkan konfigurasi Firebase Anda (API Key, Auth Domain, Project ID, dll.).
    *   Buat file `.env.local` di root proyek dan tambahkan variabel lingkungan berikut:
        ```
        VITE_FIREBASE_API_KEY=your_api_key
        VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
        VITE_FIREBASE_PROJECT_ID=your_project_id
        VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
        VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
        VITE_FIREBASE_APP_ID=your_app_id
        VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
        ```
    *   Pastikan aturan keamanan Firestore Anda mengizinkan baca/tulis yang sesuai untuk koleksi `users`, `branches`, `items`, `inventory`, dan `transfers`.

4.  **Jalankan aplikasi:**
    ```bash
    npm run dev
    ```
    Aplikasi akan berjalan di `http://localhost:5173` (atau port lain yang tersedia).

## Penggunaan

1.  **Login:** Gunakan kredensial yang telah terdaftar di Firebase Authentication. Jika Anda adalah administrator, Anda dapat membuat pengguna baru melalui konsol Firebase atau fitur manajemen pengguna di aplikasi setelah login.
2.  **Navigasi:** Gunakan sidebar di sisi kiri untuk berpindah antar halaman (Dasbor, Cabang, Item, Inventaris, Transfer, Pengguna, Tutorial).
3.  **Manajemen Data:** Gunakan tombol "Tambah", "Edit", dan "Hapus" di setiap halaman untuk mengelola data inventaris Anda.

## Deployment

Aplikasi ini dibangun dengan Vite, yang menghasilkan aset statis yang dapat di-deploy ke berbagai platform hosting statis (misalnya, Netlify, Vercel, Firebase Hosting, GitHub Pages).

1.  **Build aplikasi untuk produksi:**
    ```bash
    npm run build
    ```
    Ini akan membuat folder `dist` yang berisi semua file yang diperlukan untuk deployment.

2.  **Deploy folder `dist`:**
    *   **Netlify/Vercel:** Cukup hubungkan repositori GitHub Anda dan atur folder build ke `dist`.
    *   **Firebase Hosting:**
        ```bash
        firebase init hosting
        firebase deploy --only hosting
        ```
        Pastikan Anda telah menginstal Firebase CLI dan login.
    *   **Nginx/Apache:** Salin konten folder `dist` ke direktori root server web Anda.

## Kontribusi

Jika Anda ingin berkontribusi pada proyek ini, silakan fork repositori, buat branch baru, lakukan perubahan Anda, dan ajukan pull request.

## Lisensi

[Opsional: Tambahkan informasi lisensi di sini, misalnya MIT License]