import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Package, Building2, ArrowRight, Info, Printer, Search, Truck } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { InventoryDoc } from "./Inventory";
import { Button } from "@/components/ui/button";
import { NewTransferForm } from "@/components/NewTransferForm";

interface LowStockItem {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  branchId: string;
  branchName: string;
  totalQuantity: number;
}

interface OtherBranchStock {
  branchId: string;
  branchName: string;
  totalQuantity: number;
  isEligible: boolean;
}

const CRITICAL_STOCK_THRESHOLD = 100;
// Cabang sumber hanya boleh mengirim transfer jika stoknya minimal
// 2x lipat dari jumlah kekurangan stok cabang tujuan, agar cabang
// sumber tidak ikut jatuh ke kondisi stok kritis setelah transfer.
const MIN_STOCK_MULTIPLIER = 2;


const CriticalStock = () => {
  const { branchesMap, itemsMap, branches, items, loading: dataLoading } = useData();
  const { role, userBranchId } = useAuth();
  const [inventory, setInventory] = useState<InventoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<LowStockItem | null>(null);
  const [otherBranchesStock, setOtherBranchesStock] = useState<OtherBranchStock[]>([]);
  const [shortageInfo, setShortageInfo] = useState<{ shortage: number; minRequiredStock: number }>({ shortage: 0, minRequiredStock: 0 });
  const [isCheckBranchesOpen, setIsCheckBranchesOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [prefilledFromBranch, setPrefilledFromBranch] = useState<string>("");

  useEffect(() => {
    document.title = "Snack Nyommy - Monitoring Stok Kritis";
    
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "inventory"), (snapshot) => {
      const inventoryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryDoc[];
      setInventory(inventoryData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching inventory for critical stock:", error);
      toast.error("Gagal memuat data inventaris.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const lowStockItems = useMemo(() => {
    if (dataLoading) return [];

    let filteredInventory = inventory;
    
    // Filter by branch if user is a manager
    if (role === 'manager' && userBranchId) {
      filteredInventory = inventory.filter(inv => inv.branchId === userBranchId);
    }

    const list: LowStockItem[] = [];
    filteredInventory.forEach(inv => {
      const totalQty = (inv.entries || []).reduce((sum, e) => sum + e.quantity, 0);
      if (totalQty < CRITICAL_STOCK_THRESHOLD) {
        list.push({
          id: inv.id,
          itemId: inv.itemId,
          itemName: itemsMap.get(inv.itemId)?.name || "Item Tidak Dikenal",
          itemSku: itemsMap.get(inv.itemId)?.sku || "N/A",
          branchId: inv.branchId,
          branchName: branchesMap.get(inv.branchId) || "Cabang Tidak Dikenal",
          totalQuantity: totalQty,
        });
      }
    });

    return list.sort((a, b) => a.totalQuantity - b.totalQuantity);
  }, [inventory, itemsMap, branchesMap, dataLoading, role, userBranchId]);

  const handleCheckOtherBranches = (item: LowStockItem) => {
    // Jumlah stok yang masih kurang agar cabang tujuan kembali aman.
    const shortage = Math.max(CRITICAL_STOCK_THRESHOLD - item.totalQuantity, 0);
    // Cabang sumber baru dianggap layak mengirim transfer jika stoknya
    // minimal 2x lipat dari kekurangan tersebut.
    const minRequiredStock = shortage * MIN_STOCK_MULTIPLIER;

    const otherStock = inventory
      .filter(inv => inv.itemId === item.itemId && inv.branchId !== item.branchId)
      .map(inv => {
        const totalQuantity = (inv.entries || []).reduce((sum, e) => sum + e.quantity, 0);
        return {
          branchId: inv.branchId,
          branchName: branchesMap.get(inv.branchId) || "Cabang Tidak Dikenal",
          totalQuantity,
          isEligible: totalQuantity >= minRequiredStock,
        };
      })
      .filter(s => s.totalQuantity > 0)
      .sort((a, b) => Number(b.isEligible) - Number(a.isEligible) || b.totalQuantity - a.totalQuantity);

    setShortageInfo({ shortage, minRequiredStock });
    setOtherBranchesStock(otherStock);
    setSelectedItemForTransfer(item);
    setIsCheckBranchesOpen(true);
  };

  const initiateTransfer = (fromBranchId: string) => {
    setPrefilledFromBranch(fromBranchId);
    setIsCheckBranchesOpen(false);
    setIsTransferDialogOpen(true);
  };

  const handlePrint = () => {
    const reportElement = document.getElementById("critical-stock-report");
    if (reportElement) {
      reportElement.classList.add("printable-area");
      window.print();
      reportElement.classList.remove("printable-area");
    }
  };

  const GlassCard = ({ children, className, id }: { children: React.ReactNode, className?: string, id?: string }) => (
    <Card id={id} className={`bg-black/20 backdrop-blur-lg border border-white/10 text-white ${className}`}>
      {children}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Bell className="h-8 w-8 text-red-400" />
            Monitoring Stok Kritis
          </h1>
          <p className="text-slate-300">Daftar item dengan stok di bawah 100 unit yang perlu segera diisi ulang.</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Cetak Laporan
          </Button>
          <Badge variant="destructive" className="text-sm py-1 px-4 bg-red-500/20 text-red-400 border-red-500/50">
            {lowStockItems.length} Produk Kritis
          </Badge>
        </div>
      </div>

      <GlassCard id="critical-stock-report">
        <CardHeader>
          <CardTitle>Daftar Inventaris Terbatas</CardTitle>
          <CardDescription className="text-slate-400">
            Data real-time stok di bawah ambang batas (100 unit). {role === 'manager' && "Menampilkan data untuk cabang Anda."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-400">Cabang</TableHead>
                <TableHead className="text-slate-400">Nama Produk</TableHead>
                <TableHead className="text-slate-400">SKU</TableHead>
                <TableHead className="text-center text-slate-400">Stok Sisa</TableHead>
                <TableHead className="text-center text-slate-400">Status Urgensi</TableHead>
                <TableHead className="text-right text-slate-400 no-print">Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || dataLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index} className="border-white/5">
                    <TableCell><Skeleton className="h-5 w-24 bg-white/10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48 bg-white/10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-white/10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 mx-auto bg-white/10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 mx-auto bg-white/10" /></TableCell>
                    <TableCell className="no-print"><Skeleton className="h-8 w-8 ml-auto bg-white/10" /></TableCell>
                  </TableRow>
                ))
              ) : lowStockItems.length > 0 ? (
                lowStockItems.map((item) => (
                  <TableRow key={item.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {item.branchName}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-200 font-semibold">{item.itemName}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{item.itemSku}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-lg font-bold ${item.totalQuantity <= 15 ? 'text-red-500 animate-pulse' : 'text-orange-400'}`}>
                        {item.totalQuantity}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">pcs</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.totalQuantity <= 15 ? (
                        <Badge className="bg-red-600 text-white border-none">Sangat Kritis</Badge>
                      ) : (
                        <Badge className="bg-orange-600 text-white border-none">Perlu Restock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right no-print">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white/5 border-white/10 text-white hover:bg-blue-500/20 hover:text-blue-400"
                          onClick={() => handleCheckOtherBranches(item)}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Cek Cabang Lain
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/10">
                          <Link to="/inventory">
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Package className="h-8 w-8 mb-2 opacity-20" />
                      <p>Tidak ada stok kritis. Semua aman!</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </GlassCard>

      {/* Dialog for Checking Other Branches */}
      <Dialog open={isCheckBranchesOpen} onOpenChange={setIsCheckBranchesOpen}>
        <DialogContent className="sm:max-w-[500px] text-black">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Ketersediaan di Cabang Lain
            </DialogTitle>
            <DialogDescription className="text-black">
              Menampilkan stok untuk <strong>{selectedItemForTransfer?.itemName}</strong> di cabang-cabang selain {selectedItemForTransfer?.branchName}.
            </DialogDescription>
          </DialogHeader>
          {otherBranchesStock.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Kekurangan stok: <strong>{shortageInfo.shortage} pcs</strong>. Cabang sumber baru dapat mengirim transfer
              jika stoknya minimal <strong>{shortageInfo.minRequiredStock} pcs</strong> (2x lipat kekurangan), agar cabang
              sumber tidak ikut kehabisan stok.
            </div>
          )}
          <div className="py-4">
            {otherBranchesStock.length > 0 ? (
              <div className="space-y-3">
                {otherBranchesStock.map((branch) => (
                  <div
                    key={branch.branchId}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      branch.isEligible ? 'bg-gray-50 border-gray-100' : 'bg-gray-50/50 border-gray-100 opacity-60'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-black">{branch.branchName}</p>
                      <p className="text-xs text-black">Tersedia: {branch.totalQuantity} pcs</p>
                      {!branch.isEligible && (
                        <p className="text-[11px] text-red-600 mt-0.5">
                          Belum cukup — minimal {shortageInfo.minRequiredStock} pcs untuk bisa transfer
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={!branch.isEligible}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                      onClick={() => initiateTransfer(branch.branchId)}
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Minta Transfer
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-black">
                <Info className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>Tidak ada cabang lain yang memiliki stok untuk item ini.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Transfer Form */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-black">
          <DialogHeader>
            <DialogTitle>Buat Permintaan Transfer</DialogTitle>
            <DialogDescription className="text-black">
              Meminta stok dari {branchesMap.get(prefilledFromBranch)} untuk {selectedItemForTransfer?.branchName}.
            </DialogDescription>
          </DialogHeader>
          <NewTransferForm
            setDialogOpen={setIsTransferDialogOpen}
            branches={branches}
            items={items}
            initialValues={{
              itemId: selectedItemForTransfer?.itemId,
              toBranchId: selectedItemForTransfer?.branchId,
              fromBranchId: prefilledFromBranch
            }}
            lockedToBranchId={role === 'manager' ? userBranchId ?? undefined : undefined}
          />
        </DialogContent>
      </Dialog>

      {!loading && lowStockItems.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 no-print">
          <GlassCard className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-1" />
              <div className="space-y-1">
                <h4 className="font-bold text-blue-200">Tips Restock</h4>
                <p className="text-sm text-slate-300">
                  Gunakan tombol <strong>Cek Cabang Lain</strong> untuk melihat ketersediaan stok di cabang lain dan meminta transfer secara instan.
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4 bg-amber-500/10 border-amber-500/20">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-amber-400 mt-1" />
              <div className="space-y-1">
                <h4 className="font-bold text-amber-200">Ambang Batas</h4>
                <p className="text-sm text-slate-300">
                  Item muncul di sini jika stok di bawah 100 unit. Anda dapat mengatur ambang batas ini di pengaturan item (segera hadir).
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};


export default CriticalStock;