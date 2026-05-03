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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, runTransaction, getDoc, query, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import { NewTransferForm } from "@/components/NewTransferForm";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import { Trash2, Truck, Info, Eye, Printer } from "lucide-react";
import { InventoryDoc, InventoryEntry } from "./Inventory";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface Transfer {
  id: string;
  fromBranchId: string;
  toBranchId: string;
  itemId: string;
  quantity: number;
  status: "pending" | "approved" | "shipped" | "completed" | "rejected";
  createdAt: any; // Firebase Timestamp
  totalValue: number;
  shippingInfo?: {
    courierName?: string;
    trackingNumber?: string;
    shippedAt?: any;
    deliveredAt?: any;
  };
}

const ITEMS_PER_PAGE = 10;

const Transfers = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const { branches, items, loading: dataLoading } = useData();
  const [loading, setLoading] = useState(true);
  const [isAddTransferDialogOpen, setIsAddTransferDialogOpen] = useState(false);
  const [transferToProcess, setTransferToProcess] = useState<Transfer | null>(null);
  const [actionType, setActionType] = useState<"approve" | "ship" | "receive" | "reject" | null>(null);
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const { role, user, userBranchId } = useAuth(); // Ambil userBranchId dari AuthContext
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [transferToDeleteId, setTransferToDeleteId] = useState<string | null>(null);

  const pageCursorsRef = useRef<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    document.title = "Snack Nyommy - Inventory System - Transfer Management";
  }, []);

  useEffect(() => {
    if (dataLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);
    const currentCursor = pageCursorsRef.current[currentPage - 1];
    let transfersQuery = query(
      collection(db, "transfers"),
      orderBy("createdAt", "desc"),
      limit(ITEMS_PER_PAGE)
    );

    if (currentCursor) {
      transfersQuery = query(
        collection(db, "transfers"),
        orderBy("createdAt", "desc"),
        startAfter(currentCursor),
        limit(ITEMS_PER_PAGE)
      );
    }

    const unsubscribe = onSnapshot(transfersQuery, (snapshot) => {
      const transfersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transfer[];
      setTransfers(transfersData);
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
      console.error("Error fetching transfers: ", error);
      toast.error("Failed to fetch transfers data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentPage, dataLoading]);

  const processedTransfers = useMemo(() => {
    const branchesMap = new Map(branches.map(branch => [branch.id, branch.name]));
    const itemsMap = new Map(items.map(item => [item.id, item.name]));

    return transfers.map(transfer => ({
      ...transfer,
      fromBranchName: branchesMap.get(transfer.fromBranchId) || "Unknown Branch",
      toBranchName: branchesMap.get(transfer.toBranchId) || "Unknown Branch",
      itemName: itemsMap.get(transfer.itemId) || "Unknown Item",
    }));
  }, [transfers, branches, items]);

  const handleProcessTransfer = async () => {
    if (!transferToProcess || !actionType) return;

    const { fromBranchId, toBranchId, itemId, quantity, id: transferId } = transferToProcess;

    try {
      if (actionType === "approve") {
        // Step 1: Just approve the request
        await updateDoc(doc(db, "transfers", transferId), { 
          status: "approved" 
        });
        toast.success("Transfer request approved. Ready for shipping.");
      } 
      else if (actionType === "ship") {
        if (!courierName) throw new Error("Nama kurir wajib diisi.");
        
        await runTransaction(db, async (transaction) => {
          const fromInventoryRef = doc(db, "inventory", `${fromBranchId}_${itemId}`);
          const transferRef = doc(db, "transfers", transferId);

          const fromInventorySnap = await transaction.get(fromInventoryRef);
          if (!fromInventorySnap.exists()) throw new Error("Source inventory not found.");

          const fromInventoryData = fromInventorySnap.data() as InventoryDoc;
          let fromEntries = [...(fromInventoryData.entries || [])];
          fromEntries.sort((a, b) => a.purchaseDate.toMillis() - b.purchaseDate.toMillis());

          let quantityToShip = quantity;
          const remainingEntries: InventoryEntry[] = [];
          let totalValueShipped = 0;

          for (const entry of fromEntries) {
            if (quantityToShip <= 0) {
              remainingEntries.push(entry);
              continue;
            }
            if (entry.quantity <= quantityToShip) {
              totalValueShipped += entry.quantity * entry.purchasePrice;
              quantityToShip -= entry.quantity;
            } else {
              totalValueShipped += quantityToShip * entry.purchasePrice;
              remainingEntries.push({ 
                ...entry, 
                quantity: entry.quantity - quantityToShip, 
                totalValue: (entry.quantity - quantityToShip) * entry.purchasePrice 
              });
              quantityToShip = 0;
            }
          }

          if (quantityToShip > 0) throw new Error("Insufficient stock to ship.");

          transaction.update(fromInventoryRef, { entries: remainingEntries });
          transaction.update(transferRef, { 
            status: "shipped",
            totalValue: totalValueShipped,
            "shippingInfo.shippedAt": new Date(),
            "shippingInfo.courierName": courierName,
            "shippingInfo.trackingNumber": trackingNumber,
          });
        });
        setCourierName("");
        setTrackingNumber("");
        toast.success("Items shipped with courier info!");
      }
      else if (actionType === "receive") {
        // Step 3: Add to destination and mark as completed
        await runTransaction(db, async (transaction) => {
          const toInventoryRef = doc(db, "inventory", `${toBranchId}_${itemId}`);
          const transferRef = doc(db, "transfers", transferId);

          const transferSnap = await transaction.get(transferRef);
          const toInventorySnap = await transaction.get(toInventoryRef);
          
          if (!transferSnap.exists()) throw new Error("Transfer record not found.");
          const transferData = transferSnap.data();

          // We need to recreate entries for the destination. 
          // For simplicity, we create one entry with the average price of the transfer
          const newEntry: InventoryEntry = {
            quantity: quantity,
            purchasePrice: transferData.totalValue / quantity,
            totalValue: transferData.totalValue,
            purchaseDate: new Date() as any,
            supplier: `Transfer from ${processedTransfers.find(t => t.id === transferId)?.fromBranchName}`
          };

          if (toInventorySnap.exists()) {
            const toInventoryData = toInventorySnap.data() as InventoryDoc;
            transaction.update(toInventoryRef, { 
              entries: [...(toInventoryData.entries || []), newEntry] 
            });
          } else {
            transaction.set(toInventoryRef, {
              branchId: toBranchId,
              itemId: itemId,
              entries: [newEntry]
            });
          }

          transaction.update(transferRef, { 
            status: "completed",
            "shippingInfo.deliveredAt": new Date()
          });
        });
        toast.success("Items received! Stock added to destination branch.");
      }
      else if (actionType === "reject") {
        await updateDoc(doc(db, "transfers", transferId), { status: "rejected" });
        toast.info("Transfer rejected.");
      }
    } catch (error: any) {
      console.error("Error processing transfer: ", error);
      toast.error(error.message || "Failed to process transfer.");
    } finally {
      setTransferToProcess(null);
      setActionType(null);
    }
  };

  const handleDeleteTransfer = async () => {
    if (!transferToDeleteId) return;
    try {
      await deleteDoc(doc(db, "transfers", transferToDeleteId));
      toast.success("Transfer deleted successfully.");
    } catch (error) {
      console.error("Error deleting transfer: ", error);
      toast.error("Failed to delete transfer.");
    } finally {
      setIsDeleteAlertOpen(false);
      setTransferToDeleteId(null);
    }
  };

  const canProcessTransfer = (transfer: Transfer) => {
    if (role === 'admin') return true;
    if (role === 'manager' && userBranchId) {
      return transfer.fromBranchId === userBranchId || transfer.toBranchId === userBranchId;
    }
    return false;
  };

  const handleNextPage = () => {
    if (hasMore) setCurrentPage(prev => prev + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handlePrintSuratJalan = (transfer: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Surat Jalan - ${transfer.id}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #000; }
            .title { font-size: 20px; font-weight: bold; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-box h3 { font-size: 10px; text-transform: uppercase; color: #666; margin: 0 0 5px 0; }
            .info-box p { font-size: 14px; margin: 0; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 50px; }
            th { background: #f0f0f0; text-align: left; padding: 10px; border: 1px solid #000; font-size: 12px; }
            td { padding: 10px; border: 1px solid #000; font-size: 12px; }
            .footer { display: grid; grid-template-cols: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 50px; }
            .signature-space { height: 60px; }
            .footer-name { font-weight: bold; text-decoration: underline; margin-top: 5px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">SNACK NYOMMY</div>
            <div class="title">Surat Jalan (Delivery Order)</div>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <h3>Dari Cabang (Asal)</h3>
              <p>${transfer.fromBranchName}</p>
            </div>
            <div class="info-box" style="text-align: right;">
              <h3>Ke Cabang (Tujuan)</h3>
              <p>${transfer.toBranchName}</p>
            </div>
            <div class="info-box">
              <h3>ID Transfer / No. Dokumen</h3>
              <p>#${transfer.id.substring(0, 8).toUpperCase()}</p>
            </div>
            <div class="info-box" style="text-align: right;">
              <h3>Tanggal Pengiriman</h3>
              <p>${transfer.shippingInfo?.shippedAt ? transfer.shippingInfo.shippedAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="40" style="text-align: center;">No</th>
                <th>Deskripsi Barang</th>
                <th width="100" style="text-align: center;">Kuantitas</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center;">1</td>
                <td>${transfer.itemName}</td>
                <td style="text-align: center;">${transfer.quantity} Unit</td>
                <td>${transfer.shippingInfo?.notes || 'Kirim stok antar cabang'}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-bottom: 40px;">
            <div class="info-box" style="margin-bottom: 10px;">
              <h3>Logistik Pengiriman</h3>
              <p>Kurir/Driver: ${transfer.shippingInfo?.courierName || '-'}</p>
              <p>No. Kendaraan/Resi: ${transfer.shippingInfo?.trackingNumber || '-'}</p>
            </div>
          </div>

          <div class="footer">
            <div>
              <p>Disiapkan Oleh,</p>
              <div class="signature-space"></div>
              <p class="footer-name">( ____________________ )</p>
              <p style="font-size: 10px;">Cabang Asal</p>
            </div>
            <div>
              <p>Dibawa Oleh,</p>
              <div class="signature-space"></div>
              <p class="footer-name">( ${transfer.shippingInfo?.courierName || '____________________'} )</p>
              <p style="font-size: 10px;">Kurir / Driver</p>
            </div>
            <div>
              <p>Diterima Oleh,</p>
              <div class="signature-space"></div>
              <p class="footer-name">( ____________________ )</p>
              <p style="font-size: 10px;">Cabang Tujuan</p>
            </div>
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Transfer Management</CardTitle>
              <CardDescription>Manage inventory transfers between branches.</CardDescription>
            </div>
            <Dialog open={isAddTransferDialogOpen} onOpenChange={setIsAddTransferDialogOpen}>
              <DialogTrigger asChild>
                <Button>New Transfer</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-black/20 backdrop-blur-lg border border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Transfer Request</DialogTitle>
                  <DialogDescription className="text-slate-300">
                    Fill in the details to request an item transfer.
                  </DialogDescription>
                </DialogHeader>
                <NewTransferForm setDialogOpen={setIsAddTransferDialogOpen} branches={branches} items={items} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From Branch</TableHead>
                <TableHead>To Branch</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || dataLoading ? (
                Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                  <TableRow key={index}><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell><TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell></TableRow>
                ))
              ) : processedTransfers.length > 0 ? (
                processedTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>{transfer.fromBranchName}</TableCell>
                    <TableCell>{transfer.toBranchName}</TableCell>
                    <TableCell>{transfer.itemName}</TableCell>
                    <TableCell className="text-center">{transfer.quantity}</TableCell>
                    <TableCell className="text-right">
                      {transfer.totalValue ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(transfer.totalValue) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        transfer.status === "completed" ? "default" :
                        transfer.status === "rejected" ? "destructive" : 
                        transfer.status === "shipped" ? "outline" : "secondary"
                      } className={
                        transfer.status === "shipped" ? "border-blue-400 text-blue-400" : 
                        transfer.status === "approved" ? "border-green-400 text-green-400" : ""
                      }>
                        {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center space-x-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" /> Kurir
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-900 border-white/10 text-white">
                            <DialogHeader>
                              <div className="flex justify-between items-start">
                                <div>
                                  <DialogTitle>Detail Riwayat Transfer</DialogTitle>
                                  <DialogDescription className="text-slate-400">
                                    Informasi lengkap mengenai pemindahan stok barang.
                                  </DialogDescription>
                                </div>
                                {(transfer.status === 'shipped' || transfer.status === 'completed') && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-white/10 border-white/20 hover:bg-white/20 text-white"
                                    onClick={() => handlePrintSuratJalan(transfer)}
                                  >
                                    <Printer className="h-4 w-4 mr-2" />
                                    Cetak Surat Jalan
                                  </Button>
                                )}
                              </div>
                            </DialogHeader>
                            <div className="space-y-4 py-2 text-sm">
                              <div className="grid grid-cols-2 gap-4 p-3 bg-white/5 rounded-lg border border-white/5">
                                <div>
                                  <p className="text-slate-400 text-xs uppercase font-semibold">Barang</p>
                                  <p className="font-medium">{transfer.itemName}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 text-xs uppercase font-semibold">Jumlah</p>
                                  <p className="font-medium">{transfer.quantity} unit</p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="font-semibold text-blue-400">Logistik & Pengiriman</h4>
                                <div className="space-y-2 border-l-2 border-slate-700 pl-4 ml-1">
                                  <div>
                                    <p className="text-slate-400 text-xs italic">Permintaan Dibuat</p>
                                    <p>{transfer.createdAt?.toDate().toLocaleString('id-ID')}</p>
                                  </div>
                                  {transfer.shippingInfo?.shippedAt && (
                                    <div className="pt-2">
                                      <p className="text-slate-400 text-xs italic text-blue-300">Dikirim Pada</p>
                                      <p>{transfer.shippingInfo.shippedAt.toDate().toLocaleString('id-ID')}</p>
                                      <div className="bg-blue-500/10 p-2 mt-1 rounded border border-blue-500/20">
                                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Informasi Kurir</p>
                                        <p className="text-xs">Kurir: <span className="font-semibold text-white">{transfer.shippingInfo.courierName}</span></p>
                                        {transfer.shippingInfo.trackingNumber && (
                                          <p className="text-xs">Resi: <span className="font-semibold text-white">{transfer.shippingInfo.trackingNumber}</span></p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {transfer.status === "completed" && transfer.shippingInfo?.deliveredAt && (
                                    <div className="pt-2">
                                      <p className="text-slate-400 text-xs italic text-green-300">Diterima Pada</p>
                                      <p>{transfer.shippingInfo.deliveredAt.toDate().toLocaleString('id-ID')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                      {/* Action: Approve / Reject (Only for Source Branch or Admin) */}
                      {transfer.status === "pending" && (role === 'admin' || (role === 'manager' && userBranchId === transfer.fromBranchId)) && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setTransferToProcess(transfer); setActionType("approve"); }}
                              >
                                Approve
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Setujui Permintaan Transfer?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-300">
                                  Dengan menyetujui, Anda menyatakan stok tersedia dan siap untuk disiapkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10" onClick={() => { setTransferToProcess(null); setActionType(null); }}>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleProcessTransfer}>Setujui</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => { setTransferToProcess(transfer); setActionType("reject"); }}
                              >
                                Reject
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Tolak Transfer?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-300">
                                  Permintaan ini akan dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10" onClick={() => { setTransferToProcess(null); setActionType(null); }}>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleProcessTransfer} className="bg-red-600 hover:bg-red-500 text-white">Tolak</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}

                      {/* Action: Ship (Only for Source Branch or Admin) */}
                      {transfer.status === "approved" && (role === 'admin' || (role === 'manager' && userBranchId === transfer.fromBranchId)) && (
                        <Dialog open={actionType === "ship" && transferToProcess?.id === transfer.id} onOpenChange={(open) => { if(!open) { setActionType(null); setTransferToProcess(null); } }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                              onClick={() => { setTransferToProcess(transfer); setActionType("ship"); }}
                            >
                              <Truck className="h-4 w-4 mr-1" />
                              Ship
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-900 border-white/10 text-white">
                            <DialogHeader>
                              <DialogTitle>Detail Pengiriman</DialogTitle>
                              <DialogDescription className="text-slate-400">
                                Masukkan informasi kurir untuk pengiriman {transfer.quantity} unit {transfer.itemName}.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="courier">Nama Kurir / Sopir</Label>
                                <Input 
                                  id="courier" 
                                  placeholder="Contoh: JNE, Budi, atau Plat Nomor" 
                                  value={courierName}
                                  onChange={(e) => setCourierName(e.target.value)}
                                  className="bg-white/5 border-white/10 text-white"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="resi">Nomor Resi / Dokumen (Opsional)</Label>
                                <Input 
                                  id="resi" 
                                  placeholder="Masukkan nomor pelacakan" 
                                  value={trackingNumber}
                                  onChange={(e) => setTrackingNumber(e.target.value)}
                                  className="bg-white/5 border-white/10 text-white"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-3">
                              <Button variant="ghost" onClick={() => { setActionType(null); setTransferToProcess(null); }}>Batal</Button>
                              <Button onClick={handleProcessTransfer} className="bg-blue-600 hover:bg-blue-500 text-white">Konfirmasi Pengiriman</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {/* Action: Receive (Only for Destination Branch or Admin) */}
                      {transfer.status === "shipped" && (role === 'admin' || (role === 'manager' && userBranchId === transfer.toBranchId)) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500 text-green-500 hover:bg-green-500/10"
                              onClick={() => { setTransferToProcess(transfer); setActionType("receive"); }}
                            >
                              Receive Items
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Terima Barang?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-300">
                                Konfirmasi bahwa {transfer.quantity} unit telah sampai di {transfer.toBranchName} dan stok akan ditambahkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10" onClick={() => { setTransferToProcess(null); setActionType(null); }}>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={handleProcessTransfer} className="bg-green-600 hover:bg-green-500">Konfirmasi Terima</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                        {role === 'admin' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setTransferToDeleteId(transfer.id); setIsDeleteAlertOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-300">
                                  This action cannot be undone. This will permanently delete this transfer record.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10" onClick={() => { setTransferToDeleteId(null); setIsDeleteAlertOpen(false); }}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteTransfer} className="bg-red-600 hover:bg-red-500 text-white">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center h-24">
                  No transfer requests found.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || loading || dataLoading}
              variant="outline"
              className="bg-transparent border-white/20 text-white hover:bg-white/10"
            >
              Sebelumnya
            </Button>
            <span className="text-white">Halaman {currentPage}</span>
            <Button
              onClick={handleNextPage}
              disabled={!hasMore || loading || dataLoading}
              variant="outline"
              className="bg-transparent border-white/20 text-white hover:bg-white/10"
            >
              Berikutnya
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default Transfers;