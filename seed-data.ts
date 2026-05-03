
import { db } from "./src/lib/firebase";
import { collection, addDoc, getDocs, query, limit } from "firebase/firestore";

const sampleItems = [
  { name: "Basreng Pedas Daun Jeruk", sku: "BSG-001", category: "Keripik", unit: "Pcs", description: "Bakso goreng renyah dengan bumbu pedas jeruk." },
  { name: "Makaroni Bantet", sku: "MKR-001", category: "Makaroni", unit: "Pcs", description: "Makaroni goreng bumbu pedas gurih." },
  { name: "Kripik Kaca Extra Pedas", sku: "KPK-001", category: "Keripik", unit: "Pcs", description: "Keripik singkong tipis transparan pedas." },
  { name: "Soes Coklat Lumer", sku: "SOE-001", category: "Kue Kering", unit: "Pcs", description: "Kue soes kering isi coklat premium." },
  { name: "Pangsit Goreng Original", sku: "PST-001", category: "Snack Gurih", unit: "Pcs", description: "Pangsit goreng renyah bumbu bawang." }
];

async function seedData() {
  console.log("Memulai pengisian data contoh...");
  
  try {
    const itemsCol = collection(db, "items");
    
    // Cek apakah sudah ada data agar tidak duplikat
    const existing = await getDocs(query(itemsCol, limit(1)));
    if (!existing.empty) {
      console.log("Data item sudah ada, melewati pengisian item master.");
    } else {
      for (const item of sampleItems) {
        await addDoc(itemsCol, item);
        console.log(`Menambahkan: ${item.name}`);
      }
    }
    
    console.log("Pengisian data selesai! Silakan refresh dashboard Anda.");
  } catch (error) {
    console.error("Gagal mengisi data:", error);
  }
}

// Karena ini dijalankan di lingkungan browser-like via vite, 
// kita akan mengekspor fungsinya agar bisa dipanggil jika perlu.
// Namun untuk kenyamanan, saya akan menyarankan Anda menjalankan ini sekali saja.
seedData();
