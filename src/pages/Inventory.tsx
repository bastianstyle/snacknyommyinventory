import { useState, useEffect, useMemo, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, getDoc, deleteDoc, query, orderBy, limit, startAfter, where, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { PlusCircle, Eye, Trash2, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useData } from "@/contexts/DataContext";
import { AddStockForm } from "@/components/AddStockForm";
import { InventoryDetailDialog } from "@/components/InventoryDetailDialog";
import { AddInventoryForm } from "@/components/AddInventoryForm"; // Import the form
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// New Data Structures
export interface InventoryEntry {
  quantity: number;
  purchasePrice: number;
  supplier: string;
  purchaseDate: any; // Firebase Timestamp
  totalValue: number;
}

export interface InventoryDoc {
  id: string;
  branchId: string;
  itemId: string;
  entries: InventoryEntry[];
  rackLocation?: string;
}

export interface ProcessedInventory extends InventoryDoc {
  branchName: string;
  itemName: string;
  itemSku: string;
  totalQuantity: number;
  totalValue: number;
  averagePrice: number;
}

const ITEMS_PER_PAGE = 15;

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryDoc[]>([]);
  const { branches, items, loading: dataLoading } = useData();
  const [loading, setLoading] = useState(true);
  const { role, user, userBranchId } = useAuth();
  
  // State for dialogs
  const [isAddInventoryOpen, setIsAddInventoryOpen] = useState(false); // State for the new form
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<ProcessedInventory | null>(null);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [inventoryToDeleteId, setInventoryToDeleteId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageCursorsRef = useRef<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    document.title = "Snack Nyommy - Inventory System - Inventory Management";
  }, []);

  useEffect(() => {
    if (dataLoading || (role === 'manager' && !userBranchId)) {
      setLoading(true);
      return;
    }

    setLoading(true);
    
    // Build query based on role
    let constraints: any[] = [];
    if (role === 'manager' && userBranchId) {
      constraints.push(where("branchId", "==", userBranchId));
    } else {
      constraints.push(orderBy("branchId"));
    }
    
    // We only use one orderBy to avoid requiring a composite index
    // if we add itemId here, Firestore will require a composite index (branchId + itemId)
    
    const currentCursor = pageCursorsRef.current[currentPage - 1];
    if (currentCursor) {
      constraints.push(startAfter(currentCursor));
    }
    
    constraints.push(limit(ITEMS_PER_PAGE));

    const inventoryQuery = query(collection(db, "inventory"), ...constraints);

    const unsubscribe = onSnapshot(inventoryQuery, (snapshot) => {
      const inventoryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryDoc[];
      setInventory(inventoryData);
      setLoading(false);

      if (snapshot.docs.length > 0) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (pageCursorsRef.current.length <= currentPage) {
          pageCursorsRef.current.push(lastDoc);
        } else {
          pageCursorsRef.current[currentPage] = lastDoc;
        }
        setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    }, (error) => {
      console.error("Error fetching inventory:", error);
      toast.error("Gagal memuat data inventaris. Pastikan index sudah dibuat jika diperlukan.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentPage, dataLoading, role, userBranchId]);

  const processedInventory: ProcessedInventory[] = useMemo(() => {
    const itemsMap = new Map(items.map(item => [item.id, item]));
    const branchesMap = new Map(branches.map(branch => [branch.id, branch.name]));

    let filteredInventory = inventory;
    if (role === 'manager' && userBranchId) {
      filteredInventory = inventory.filter(inv => inv.branchId === userBranchId);
    }

    return filteredInventory.map(inv => {
      const item = itemsMap.get(inv.itemId);
      const entries = inv.entries || [];
      
      const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
      const totalValue = entries.reduce((sum, entry) => sum + entry.totalValue, 0);
      const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

      return {
        ...inv,
        branchName: branchesMap.get(inv.branchId) || "Unknown Branch",
        itemName: item?.name || "Unknown Item",
        itemSku: item?.sku || "N/A",
        totalQuantity,
        totalValue,
        averagePrice,
      };
    }).filter(inv => inv.totalQuantity > 0); // Only show items with stock
  }, [inventory, items, branches, role, userBranchId]);

  const handleAddStockClick = (inv: ProcessedInventory) => {
    setSelectedInventory(inv);
    setIsAddStockOpen(true);
  };

  const handleViewDetailsClick = (inv: ProcessedInventory) => {
    setSelectedInventory(inv);
    setIsDetailOpen(true);
  };

  const handleDeleteClick = (inventoryId: string) => {
    setInventoryToDeleteId(inventoryId);
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteInventory = async () => {
    if (!inventoryToDeleteId) return;
    try {
      await deleteDoc(doc(db, "inventory", inventoryToDeleteId));
      toast.success("Inventory record deleted successfully.");
    } catch (error) {
      console.error("Error deleting inventory record: ", error);
      toast.error("Failed to delete inventory record.");
    } finally {
      setIsDeleteAlertOpen(false);
      setInventoryToDeleteId(null);
    }
  };

  const handleNextPage = () => {
    if (hasMore) setCurrentPage(prev => prev + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handlePrintAll = () => {
    const tableCard = document.querySelector('#inventory-table-card');
    if (tableCard) {
      tableCard.classList.add('printable-area');
      window.print();
      tableCard.classList.remove('printable-area');
    }
  };

  return (
    <>
      <Card id="inventory-table-card">
        <CardHeader className="no-print">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Manajemen Inventaris</CardTitle>
              <CardDescription>Lihat dan kelola tingkat stok di seluruh cabang.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handlePrintAll} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Cetak Semua
              </Button>
              {role === 'manager' && (
                <Dialog open={isAddInventoryOpen} onOpenChange={setIsAddInventoryOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Tambah Stok Awal
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] text-black">
                    <DialogHeader>
                      <DialogTitle className="text-black">Tambah Stok Awal</DialogTitle>
                      <DialogDescription className="text-black">
                        Buat catatan inventaris pertama untuk suatu item di cabang tertentu.
                      </DialogDescription>
                    </DialogHeader>
                    <AddInventoryForm
                      setDialogOpen={setIsAddInventoryOpen}
                      branches={userBranchId ? branches.filter(b => b.id === userBranchId) : branches}
                      items={items}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabang</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Lokasi Rak</TableHead>
                <TableHead className="text-center">Total Kuantitas</TableHead>
                <TableHead className="text-right">Harga Rata-rata</TableHead>
                <TableHead className="text-right">Total Nilai</TableHead>
                <TableHead className="text-right no-print">Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || dataLoading ? (
                Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                  <TableRow key={index}><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell><TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell><TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell><TableCell className="text-right no-print"><Skeleton className="h-8 w-28 ml-auto" /></TableCell></TableRow>
                ))
              ) : processedInventory.length > 0 ? (
                processedInventory.map((inv) => (
                  <TableRow key={inv.id}><TableCell className="font-medium">{inv.branchName}</TableCell><TableCell>{inv.itemName}</TableCell><TableCell>{inv.itemSku}</TableCell><TableCell>{inv.rackLocation || 'N/A'}</TableCell><TableCell className="text-center">{inv.totalQuantity}</TableCell><TableCell className="text-right">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(inv.averagePrice)}
                  </TableCell><TableCell className="text-right">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(inv.totalValue)}
                  </TableCell><TableCell className="text-right no-print">
                    <div className="flex justify-end items-center space-x-1">
                      {role === 'manager' && inv.branchId === userBranchId && (
                        <Button variant="outline" size="sm" onClick={() => handleAddStockClick(inv)}>
                          <PlusCircle className="h-4 w-4 mr-1" /> Tambah
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleViewDetailsClick(inv)}>
                        <Eye className="h-4 w-4 mr-1" /> Lihat
                      </Button>
                      {role === 'admin' && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(inv.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell></TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="text-center h-24">
                  Tidak ada catatan inventaris ditemukan.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-4 no-print">
            <Button onClick={handlePreviousPage} disabled={currentPage === 1 || loading || dataLoading} variant="outline">
              Sebelumnya
            </Button>
            <span className="text-sm">Halaman {currentPage}</span>
            <Button onClick={handleNextPage} disabled={!hasMore || loading || dataLoading} variant="outline">
              Berikutnya
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Stock Dialog */}
      <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
        <DialogContent className="sm:max-w-[425px] text-black">
          <DialogHeader>
            <DialogTitle className="text-black">Tambah Stok untuk {selectedInventory?.itemName}</DialogTitle>
            <DialogDescription className="text-black">
              Masukkan detail stok baru untuk item ini di {selectedInventory?.branchName}.
            </DialogDescription>
          </DialogHeader>
          {selectedInventory && <AddStockForm inventoryItem={selectedInventory} onClose={() => setIsAddStockOpen(false)} />}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <InventoryDetailDialog 
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        inventoryItem={selectedInventory}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="text-black">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">Apakah Anda benar-benar yakin?</AlertDialogTitle>
            <AlertDialogDescription className="text-black">
              Tindakan ini tidak dapat dibatalkan. Ini akan menghapus secara permanen seluruh catatan inventaris ini dan semua entri stoknya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-black">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInventory} className="bg-red-600 hover:bg-red-500 text-white">Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Inventory;