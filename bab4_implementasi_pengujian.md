## 4.1.3 Implementasi Database

Basis data pada sistem Snack Nyommy Inventory diimplementasikan menggunakan **Cloud Firestore**, layanan basis data NoSQL berbasis dokumen (*document-oriented*) milik Google Firebase yang bersifat *real-time*. Berbeda dengan basis data relasional (SQL) yang menyusun data dalam bentuk tabel dan baris yang terikat skema tetap, Cloud Firestore menyusun data dalam bentuk **koleksi (*collection*)** yang berisi **dokumen (*document*)** dengan struktur yang fleksibel. Inisialisasi koneksi ke basis data dilakukan pada `src/lib/firebase.ts` melalui pemanggilan `getFirestore(app)`, yang kemudian diekspor sebagai objek `db` dan digunakan di seluruh komponen aplikasi untuk operasi baca/tulis data.

### 4.1.3.1 Implementasi Struktur Koleksi

Sistem ini mengimplementasikan tujuh koleksi utama pada Cloud Firestore, sebagaimana dirangkum pada Tabel 4.x berikut.

**Tabel 4.x Implementasi Koleksi Cloud Firestore**

| No | Koleksi | Field Utama | Fungsi |
|----|---------|--------------|--------|
| 1 | `users` | `role` (`admin`\|`manager`), `branchId`, `email` | Menyimpan data akun pengguna beserta peran dan cabang yang menjadi tanggung jawabnya (khusus manajer). Dokumen ini di-*key* menggunakan UID dari Firebase Authentication, sehingga `doc(db, "users", uid)` selalu merujuk ke profil pengguna yang sedang login. |
| 2 | `branches` | `name`, `location`, `address`, `phone` | Menyimpan data master cabang (Bandung dan Pontianak). |
| 3 | `items` | `name`, `sku`, `category`, `unit`, `description` | Menyimpan data master produk/snack. Kategori mengacu pada daftar tetap yang didefinisikan di `src/lib/itemCategories.ts`. |
| 4 | `inventory` | `branchId`, `itemId`, `entries: InventoryEntry[]`, `rackLocation` | Menyimpan saldo stok berjalan per kombinasi cabang dan item. Setiap elemen pada array `entries[]` merepresentasikan satu batch pembelian (`quantity`, `purchasePrice`, `supplier`, `purchaseDate`, `totalValue`), sehingga total stok dihitung dengan menjumlahkan seluruh `quantity` pada array tersebut. |
| 5 | `transfers` | `fromBranchId`, `toBranchId`, `itemId`, `quantity`, `status`, `proofPhotoUrl`, `receivedBy` | Menyimpan data permintaan transfer stok antar cabang beserta alur status (`pending` → `approved`/`rejected` → `shipped` → `completed`). |
| 6 | `incoming_items` | `itemId`, `branchId`, `quantity`, `purchasePrice`, `supplier`, `totalValue`, `createdAt` | Mencatat riwayat transaksi barang masuk sebagai *audit trail*, terpisah dari saldo stok pada koleksi `inventory`. |
| 7 | `outgoing_items` | `itemId`, `branchId`, `quantity`, `reason`, `totalValue`, `createdAt` | Mencatat riwayat transaksi barang keluar, dengan struktur serupa `incoming_items`. |

Struktur koleksi ini dapat diverifikasi langsung melalui **Firebase Console** pada menu *Firestore Database*, yang menampilkan pohon koleksi (`branches`, `incoming_items`, `inventory`, `items`, `outgoing_items`, `transfers`, `users`) beserta seluruh dokumen dan *field* di dalamnya sesuai struktur yang telah dirancang pada Bab 3.7.1.

### 4.1.3.2 Implementasi Relasi Antar Koleksi

Karena Cloud Firestore tidak mendukung *foreign key* maupun operasi `JOIN` sebagaimana basis data relasional, relasi antar koleksi diimplementasikan secara manual melalui referensi ID pada level aplikasi. Sebagai contoh, dokumen pada koleksi `inventory` menggunakan pola ID gabungan `{branchId}_{itemId}` sebagai *document ID*, sehingga aplikasi dapat langsung mengambil (`getDoc`) saldo stok suatu item di suatu cabang tanpa perlu melakukan *query* pencarian, sekaligus mencegah duplikasi dokumen inventaris untuk kombinasi cabang-item yang sama.

### 4.1.3.3 Implementasi Sinkronisasi Data Real-time

Keunggulan utama Cloud Firestore yang dimanfaatkan secara ekstensif pada sistem ini adalah kemampuan sinkronisasi data secara *real-time* melalui fungsi `onSnapshot`. Alih-alih mengambil data satu kali (`getDocs`), sebagian besar halaman membuka *listener* yang otomatis memperbarui *state* React setiap kali ada perubahan pada koleksi terkait di sisi server. Sebagai contoh, `DataContext` (`src/contexts/DataContext.tsx`) membuka listener pada koleksi `branches` dan `items` sejak pengguna berhasil login, sehingga seluruh halaman yang bergantung pada data master ini selalu menampilkan data terbaru tanpa perlu memuat ulang halaman:

```ts
// src/contexts/DataContext.tsx
const unsubscribeBranches = onSnapshot(
  collection(db, "branches"),
  (snapshot) => {
    const fetchedBranches = snapshot.docs.map(
      doc => ({ id: doc.id, ...doc.data() })
    ) as Branch[];
    setBranches(fetchedBranches);
  }
);
```

Pola yang sama diterapkan secara mandiri pada halaman-halaman transaksional lain, seperti `Inventory.tsx`, `Transfers.tsx`, `IncomingItems.tsx`, `OutgoingItems.tsx`, dan `CriticalStock.tsx`, sehingga perubahan stok atau status transfer yang dilakukan oleh satu manajer cabang langsung terlihat oleh pengguna lain (termasuk Admin) yang sedang membuka halaman terkait pada saat yang sama.

### 4.1.3.4 Implementasi Konsistensi Data melalui Transaksi Atomik

Untuk operasi yang mengubah lebih dari satu bagian data secara bersamaan — misalnya mencatat transaksi barang masuk/keluar sekaligus memperbarui saldo `entries[]` pada koleksi `inventory` — sistem menggunakan `runTransaction` dari Firestore SDK. Fungsi ini memastikan seluruh operasi baca dan tulis di dalamnya bersifat atomik (semua berhasil atau semua dibatalkan), sehingga tidak terjadi kondisi stok yang tersimpan sebagian apabila terjadi gangguan di tengah proses. Sebagai contoh pada pencatatan barang keluar, pengurangan stok menggunakan metode FIFO (*First In First Out*, mengambil dari `entries[]` yang tercatat paling lama) dijalankan di dalam satu transaksi bersama pencatatan dokumen baru pada koleksi `outgoing_items`:

```ts
// src/components/NewOutgoingItemForm.tsx
await runTransaction(db, async (transaction) => {
  const inventoryDoc = await transaction.get(inventoryRef);
  // ...validasi stok & logika pengurangan FIFO...
  transaction.set(newOutgoingItemRef, { /* data transaksi */ });
  transaction.update(inventoryRef, { entries: updatedEntries });
});
```

### 4.1.3.5 Implementasi Keamanan Data (Firestore Security Rules)

Karena sistem ini bersifat *client-only* tanpa server API perantara, keamanan data ditegakkan sepenuhnya oleh **Firestore Security Rules** (`firestore.rules`) sebagai lapisan pertahanan yang sesungguhnya — bukan sekadar validasi kenyamanan di sisi antarmuka. Aturan ini didefinisikan menggunakan fungsi bantu untuk memeriksa autentikasi dan peran pengguna:

```
// firestore.rules
function isAuthenticated() {
  return request.auth != null;
}
function getUserData() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
function isAdmin() {
  return isAuthenticated() && getUserData().role == 'admin';
}
function isManagerOfBranch(branchId) {
  return isAuthenticated() && getUserData().role == 'manager' && getUserData().branchId == branchId;
}
```

Berdasarkan fungsi tersebut, setiap koleksi memiliki aturan akses yang berbeda sesuai peran pengguna, sebagaimana dirangkum pada Tabel 4.x berikut.

**Tabel 4.x Implementasi Aturan Keamanan per Koleksi**

| Koleksi | Baca (`read`) | Tulis (`create`/`update`) | Hapus (`delete`) |
|---|---|---|---|
| `users` | Pengguna hanya boleh membaca profil miliknya sendiri; Admin boleh membaca (*list*) semua profil | Hanya Admin | Hanya Admin |
| `branches`, `items` | Seluruh pengguna terautentikasi | Hanya Admin | Hanya Admin |
| `inventory` | Seluruh pengguna terautentikasi (untuk keperluan cek stok antar cabang) | Hanya manajer cabang pemilik data (`isManagerOfBranch(branchId)`) | Hanya Admin |
| `incoming_items`, `outgoing_items` | Admin, atau manajer cabang pemilik data | Hanya manajer cabang pemilik data | Hanya Admin |
| `transfers` | Admin, atau manajer cabang asal/tujuan yang terlibat | Manajer cabang tujuan (membuat & menyelesaikan), manajer cabang asal (menyetujui/menolak/mengirim) | Hanya Admin |

Salah satu validasi yang paling penting diterapkan pada koleksi `transfers`, yaitu kewajiban menyertakan `proofPhotoUrl` berupa data URI base64 berukuran kurang dari 900 KB sebelum status transfer dapat diubah menjadi `completed`. Validasi ini sekaligus menjadi bukti bahwa foto bukti serah terima **disimpan langsung di dalam dokumen Firestore** (bukan pada Firebase Storage), sehingga ukurannya harus dibatasi agar tidak melampaui batas maksimum ukuran satu dokumen Firestore, yaitu 1 MB:

```
// firestore.rules — potongan aturan koleksi transfers
allow update: if
  (isManagerOfBranch(resource.data.toBranchId)
    && request.resource.data.status == 'completed'
    && request.resource.data.proofPhotoUrl is string
    && request.resource.data.proofPhotoUrl.size() > 0
    && request.resource.data.proofPhotoUrl.size() < 900000
    && request.resource.data.receivedBy == request.auth.uid);
```

Dengan pendekatan ini, Firestore Security Rules berfungsi sebagai *source of truth* keamanan sistem: meskipun antarmuka pengguna (misalnya `ProtectedRoute`) sudah membatasi akses berdasarkan peran, permintaan baca/tulis yang mencoba melewati pembatasan tersebut — baik secara tidak sengaja maupun sengaja — akan tetap ditolak langsung oleh Firestore pada level basis data.
