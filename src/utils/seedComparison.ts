
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where, doc, setDoc } from "firebase/firestore";

const itemsData = [
  { name: "Basreng Pedas Daun Jeruk", sku: "BSG-001", category: "Keripik", unit: "Pcs", description: "Bakso goreng renyah dengan bumbu pedas jeruk." },
  { name: "Makaroni Bantet", sku: "MKR-001", category: "Makaroni", unit: "Pcs", description: "Makaroni goreng bumbu pedas gurih." },
  { name: "Kripik Kaca Extra Pedas", sku: "KPK-001", category: "Keripik", unit: "Pcs", description: "Keripik singkong tipis transparan pedas." },
  { name: "Soes Coklat Lumer", sku: "SOE-001", category: "Kue Kering", unit: "Pcs", description: "Kue soes kering isi coklat premium." },
  { name: "Pangsit Goreng Original", sku: "PST-001", category: "Snack Gurih", unit: "Pcs", description: "Pangsit goreng renyah bumbu bawang." },
  { name: "Keripik Tempe Sagu", sku: "KPT-001", category: "Keripik", unit: "Pcs", description: "Keripik tempe tipis renyah." },
  { name: "Stik Bawang", sku: "STK-001", category: "Snack Gurih", unit: "Pcs", description: "Stik renyah rasa bawang gurih." },
  { name: "Kacang Thailand", sku: "KCG-001", category: "Kacang", unit: "Pcs", description: "Kacang tanah bumbu pedas manis daun jeruk." },
  { name: "Usus Goreng Krispi", sku: "USS-001", category: "Snack Gurih", unit: "Pcs", description: "Usus ayam goreng krispi bumbu spesial." },
  { name: "Marning Jagung", sku: "MRN-001", category: "Snack Gurih", unit: "Pcs", description: "Marning jagung renyah rasa original." },
  { name: "Emping Melinjo Pedas", sku: "EMP-001", category: "Kerupuk", unit: "Pcs", description: "Emping melinjo bumbu pedas manis." },
  { name: "Kerupuk Ikan Palembang", sku: "KRP-001", category: "Kerupuk", unit: "Pcs", description: "Kerupuk ikan asli khas Palembang." },
  { name: "Sale Pisang Jari", sku: "SAL-001", category: "Snack Manis", unit: "Pcs", description: "Sale pisang bentuk jari manis legit." },
  { name: "Klanting Kebumen", sku: "KLT-001", category: "Snack Gurih", unit: "Pcs", description: "Klanting singkong khas Kebumen." },
  { name: "Gabus Keju", sku: "GBS-001", category: "Kue Kering", unit: "Pcs", description: "Kue gabus rasa keju yang lumer." }
];

export async function seedComparisonData() {
  console.log("Memulai proses seeding data perbandingan...");
  
  try {
    // 1. Pastikan Cabang Bandung dan Pontianak ada
    const branchesCol = collection(db, "branches");
    const getBranch = async (name: string, location: string) => {
      const q = query(branchesCol, where("name", "==", name));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
      const newDoc = await addDoc(branchesCol, { name, location, address: `Alamat ${name}`, phone: "08123456789" });
      return { id: newDoc.id, name, location };
    };

    const bandung = await getBranch("Bandung", "Jawa Barat");
    const pontianak = await getBranch("Pontianak", "Kalimantan Barat");
    
    console.log(`Cabang siap: ${bandung.name} (${bandung.id}), ${pontianak.name} (${pontianak.id})`);

    // 2. Pastikan Item ada
    const itemsCol = collection(db, "items");
    const existingItemsSnap = await getDocs(itemsCol);
    let items = existingItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (items.length < itemsData.length) {
      console.log("Menambahkan item yang kurang...");
      for (const item of itemsData) {
        const exists = items.some((i: any) => i.sku === item.sku);
        if (!exists) {
          const newDoc = await addDoc(itemsCol, item);
          items.push({ id: newDoc.id, ...item });
        }
      }
    }

    // 3. Tambahkan 5 Data untuk Bandung
    console.log("Menambahkan 5 data inventaris untuk Bandung...");
    for (let i = 0; i < 5; i++) {
      const item = items[i];
      const inventoryId = `${bandung.id}_${item.id}`;
      const inventoryRef = doc(db, "inventory", inventoryId);
      
      const quantity = Math.floor(Math.random() * 100) + 50;
      const purchasePrice = Math.floor(Math.random() * 5000) + 10000;
      
      await setDoc(inventoryRef, {
        branchId: bandung.id,
        itemId: item.id,
        rackLocation: `BND-${i+1}`,
        entries: [{
          quantity,
          purchasePrice,
          supplier: "Supplier Bandung",
          purchaseDate: new Date(),
          totalValue: quantity * purchasePrice
        }]
      });
    }

    // 4. Tambahkan 10 Data untuk Pontianak
    console.log("Menambahkan 10 data inventaris untuk Pontianak...");
    for (let i = 0; i < 10; i++) {
      const item = items[i];
      const inventoryId = `${pontianak.id}_${item.id}`;
      const inventoryRef = doc(db, "inventory", inventoryId);
      
      const quantity = Math.floor(Math.random() * 150) + 100; // Lebih banyak stok di Pontianak
      const purchasePrice = Math.floor(Math.random() * 5000) + 12000;
      
      await setDoc(inventoryRef, {
        branchId: pontianak.id,
        itemId: item.id,
        rackLocation: `PTK-${i+1}`,
        entries: [{
          quantity,
          purchasePrice,
          supplier: "Supplier Pontianak",
          purchaseDate: new Date(),
          totalValue: quantity * purchasePrice
        }]
      });
    }

    console.log("Seeding selesai! Silakan periksa dashboard.");
    alert("Data berhasil ditambahkan! Silakan refresh dashboard.");
  } catch (error) {
    console.error("Gagal melakukan seeding:", error);
    alert("Gagal menambahkan data. Pastikan Anda sudah login sebagai Admin.");
  }
}

// export async function cleanupUnknownInventory() {
//   console.log("Memulai pembersihan inventaris...");
//   try {
//     // 1. Ambil semua ID Cabang yang valid
//     const branchesSnap = await getDocs(collection(db, "branches"));
//     const validBranchIds = new Set(branchesSnap.docs.map(doc => doc.id));
    
//     // 2. Ambil semua data inventaris
//     const inventorySnap = await getDocs(collection(db, "inventory"));
//     let deletedCount = 0;

//     for (const inventoryDoc of inventorySnap.docs) {
//       const data = inventoryDoc.data();
//       if (!validBranchIds.has(data.branchId)) {
//         console.log(`Menghapus inventaris ID: ${inventoryDoc.id}`);
//         await deleteDoc(doc(db, "inventory", inventoryDoc.id));
//         deletedCount++;
//       }
//     }

//     alert(`Pembersihan selesai. Total ${deletedCount} data "Unknown Branch" dihapus.`);
//     window.location.reload();
//   } catch (error) {
//     console.error("Gagal membersihkan inventaris:", error);
//     alert("Gagal menghapus data. Pastikan Anda adalah Admin.");
//   }
// }
