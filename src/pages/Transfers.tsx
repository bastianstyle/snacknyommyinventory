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
import { collection, onSnapshot, doc, updateDoc, runTransaction, getDoc, query, where, or, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import { NewTransferForm } from "@/components/NewTransferForm";
import { PhotoUploadProof } from "@/components/PhotoUploadProof";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import { Trash2, Truck, Info, Eye, Printer, Copy, Check, ExternalLink } from "lucide-react";
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
  proofPhotoUrl?: string; // data URI base64 (bukan Firebase Storage URL)
  receivedBy?: string;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(null);

  const handleCopyResi = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Nomor resi berhasil disalin!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pageCursorsRef = useRef<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    document.title = "Snack Nyommy - Sistem Inventaris - Manajemen Transfer";
  }, []);

  useEffect(() => {
    if (dataLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);
    const currentCursor = pageCursorsRef.current[currentPage - 1];

    // Manager hanya boleh membaca transfer yang melibatkan cabangnya sendiri
    // (sesuai firestore.rules) - tanpa filter ini, query global akan ditolak
    // server begitu ada transfer milik cabang lain di dalam koleksi.
    const branchConstraint = role === 'manager' && userBranchId
      ? [or(where("fromBranchId", "==", userBranchId), where("toBranchId", "==", userBranchId))]
      : [];

    const constraints = [
      ...branchConstraint,
      orderBy("createdAt", "desc"),
      ...(currentCursor ? [startAfter(currentCursor)] : []),
      limit(ITEMS_PER_PAGE),
    ];

    const transfersQuery = query(collection(db, "transfers"), ...constraints);

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
      toast.error("Gagal memuat data transfer.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentPage, dataLoading, role, userBranchId]);

  const processedTransfers = useMemo(() => {
    const branchesMap = new Map(branches.map(branch => [branch.id, branch.name]));
    const itemsMap = new Map(items.map(item => [item.id, item.name]));

    return transfers.map(transfer => ({
      ...transfer,
      fromBranchName: branchesMap.get(transfer.fromBranchId) || "Cabang Tidak Diketahui",
      toBranchName: branchesMap.get(transfer.toBranchId) || "Cabang Tidak Diketahui",
      itemName: itemsMap.get(transfer.itemId) || "Barang Tidak Diketahui",
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
        toast.success("Permintaan transfer disetujui. Siap untuk dikirim.");
      }
      else if (actionType === "ship") {
        if (!courierName) throw new Error("Nama kurir wajib diisi.");
        
        await runTransaction(db, async (transaction) => {
          const fromInventoryRef = doc(db, "inventory", `${fromBranchId}_${itemId}`);
          const transferRef = doc(db, "transfers", transferId);

          const fromInventorySnap = await transaction.get(fromInventoryRef);
          if (!fromInventorySnap.exists()) throw new Error("Inventaris sumber tidak ditemukan.");

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

          if (quantityToShip > 0) throw new Error("Stok tidak mencukupi untuk dikirim.");

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
        toast.success("Barang telah dikirim beserta info kurir!");
      }
      else if (actionType === "receive") {
        if (!proofPhotoUrl) throw new Error("Foto bukti penerimaan wajib diunggah.");

        // Step 3: Add to destination and mark as completed
        await runTransaction(db, async (transaction) => {
          const toInventoryRef = doc(db, "inventory", `${toBranchId}_${itemId}`);
          const transferRef = doc(db, "transfers", transferId);

          const transferSnap = await transaction.get(transferRef);
          const toInventorySnap = await transaction.get(toInventoryRef);
          
          if (!transferSnap.exists()) throw new Error("Catatan transfer tidak ditemukan.");
          const transferData = transferSnap.data();

          // We need to recreate entries for the destination. 
          // For simplicity, we create one entry with the average price of the transfer
          const branchName = processedTransfers.find(t => t.id === transferId)?.fromBranchName || "Cabang Asal";
          const newEntry: InventoryEntry = {
            quantity: quantity,
            purchasePrice: transferData.totalValue / quantity,
            totalValue: transferData.totalValue,
            purchaseDate: new Date() as any,
            supplier: `Transfer dari ${branchName}`
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
            proofPhotoUrl,
            receivedBy: user?.uid,
            "shippingInfo.deliveredAt": new Date()
          });
        });
        toast.success("Barang diterima! Stok telah ditambahkan ke cabang tujuan.");
        setProofPhotoUrl(null);
        setIsReceiveDialogOpen(false);
      }
      else if (actionType === "reject") {
        await updateDoc(doc(db, "transfers", transferId), { status: "rejected" });
        toast.info("Transfer ditolak.");
      }
    } catch (error: any) {
      console.error("Error processing transfer: ", error);
      toast.error(error.message || "Gagal memproses transfer.");
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
            <div class="title">Surat Jalan</div>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Manajemen Transfer</CardTitle>
              <CardDescription>Kelola transfer inventaris antar cabang.</CardDescription>
            </div>
            {role === 'manager' && (
              <Dialog open={isAddTransferDialogOpen} onOpenChange={setIsAddTransferDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Transfer Baru</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] text-black">
                  <DialogHeader>
                    <DialogTitle>Buat Permintaan Transfer Baru</DialogTitle>
                    <DialogDescription className="text-black">
                      Isi detail untuk meminta transfer barang.
                    </DialogDescription>
                  </DialogHeader>
                  <NewTransferForm
                    setDialogOpen={setIsAddTransferDialogOpen}
                    branches={branches}
                    items={items}
                    lockedToBranchId={role === 'manager' ? userBranchId ?? undefined : undefined}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabang Asal</TableHead>
                <TableHead>Cabang Tujuan</TableHead>
                <TableHead>Barang</TableHead>
                <TableHead className="text-center">Jumlah</TableHead>
                <TableHead className="text-right">Total Nilai</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
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
                          <DialogContent className="text-black">
                            <DialogHeader>
                              <div className="flex justify-between items-start">
                                <div>
                                  <DialogTitle>Detail Riwayat Transfer</DialogTitle>
                                  <DialogDescription className="text-black">
                                    Informasi lengkap mengenai pemindahan stok barang.
                                  </DialogDescription>
                                </div>
                                {(transfer.status === 'shipped' || transfer.status === 'completed') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePrintSuratJalan(transfer)}
                                  >
                                    <Printer className="h-4 w-4 mr-2" />
                                    Cetak Surat Jalan
                                  </Button>
                                )}
                              </div>
                            </DialogHeader>
                            <div className="space-y-4 py-2 text-sm">
                              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                  <p className="text-black text-xs uppercase font-semibold">Barang</p>
                                  <p className="font-medium">{transfer.itemName}</p>
                                </div>
                                <div>
                                  <p className="text-black text-xs uppercase font-semibold">Jumlah</p>
                                  <p className="font-medium">{transfer.quantity} unit</p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="font-semibold text-black">Logistik & Pengiriman</h4>
                                <div className="space-y-2 border-l-2 border-gray-200 pl-4 ml-1">
                                  <div>
                                    <p className="text-black text-xs italic">Permintaan Dibuat</p>
                                    <p>{transfer.createdAt?.toDate().toLocaleString('id-ID')}</p>
                                  </div>
                                  {transfer.shippingInfo?.shippedAt && (
                                    <div className="pt-2">
                                      <p className="text-black text-xs italic text-black">Dikirim Pada</p>
                                      <p>{transfer.shippingInfo.shippedAt.toDate().toLocaleString('id-ID')}</p>
                                      <div className="bg-blue-50 p-2 mt-1 rounded border border-blue-100">
                                        <p className="text-[10px] text-black font-bold uppercase tracking-wider">Informasi Kurir</p>
                                        <p className="text-xs">Kurir: <span className="font-semibold text-black">{transfer.shippingInfo.courierName}</span></p>
                                        {transfer.shippingInfo.trackingNumber && (
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <p className="text-xs">Resi: <span className="font-semibold text-black">{transfer.shippingInfo.trackingNumber}</span></p>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                                onClick={() => handleCopyResi(transfer.shippingInfo.trackingNumber!, transfer.id)}
                                              >
                                                {copiedId === transfer.id ? (
                                                  <Check className="h-3 w-3 text-black" />
                                                ) : (
                                                  <Copy className="h-3 w-3" />
                                                )}
                                              </Button>
                                            </div>
                                            <a
                                              href="https://jne.co.id/"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[10px] text-black hover:text-black flex items-center gap-1 mt-1 underline decoration-dotted underline-offset-2"
                                            >
                                              <ExternalLink className="h-2 w-2" />
                                              Cek Resi (JNE)
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {transfer.status === "completed" && transfer.shippingInfo?.deliveredAt && (
                                    <div className="pt-2">
                                      <p className="text-black text-xs italic text-black">Diterima Pada</p>
                                      <p>{transfer.shippingInfo.deliveredAt.toDate().toLocaleString('id-ID')}</p>
                                    </div>
                                  )}
                                  {transfer.status === "completed" && transfer.proofPhotoUrl && (
                                    <div className="pt-2">
                                      <p className="text-black text-xs uppercase text-black font-semibold">Bukti Penerimaan</p>
                                      <img
                                        src={transfer.proofPhotoUrl}
                                        alt="Bukti penerimaan"
                                        className="rounded-lg mt-2 max-h-48 object-cover border border-gray-200"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                      {/* Action: Approve / Reject (Hanya Manager cabang asal - Admin murni pengawas) */}
                      {transfer.status === "pending" && (role === 'manager' && userBranchId === transfer.fromBranchId) && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setTransferToProcess(transfer); setActionType("approve"); }}
                              >
                                Setujui
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="text-black">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Setujui Permintaan Transfer?</AlertDialogTitle>
                                <AlertDialogDescription className="text-black">
                                  Dengan menyetujui, Anda menyatakan stok tersedia dan siap untuk disiapkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => { setTransferToProcess(null); setActionType(null); }}>Batal</AlertDialogCancel>
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
                                Tolak
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="text-black">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Tolak Transfer?</AlertDialogTitle>
                                <AlertDialogDescription className="text-black">
                                  Permintaan ini akan dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => { setTransferToProcess(null); setActionType(null); }}>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleProcessTransfer} className="bg-red-600 hover:bg-red-500 text-white">Tolak</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}

                      {/* Action: Ship (Only for Source Branch Manager) */}
                      {transfer.status === "approved" && (role === 'manager' && userBranchId === transfer.fromBranchId) && (
                        <Dialog open={actionType === "ship" && transferToProcess?.id === transfer.id} onOpenChange={(open) => { if(!open) { setActionType(null); setTransferToProcess(null); } }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                              onClick={() => { setTransferToProcess(transfer); setActionType("ship"); }}
                            >
                              <Truck className="h-4 w-4 mr-1" />
                              Kirim
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="text-black">
                            <DialogHeader>
                              <DialogTitle>Detail Pengiriman</DialogTitle>
                              <DialogDescription className="text-black">
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
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="resi">Nomor Resi / Dokumen (Opsional)</Label>
                                <Input
                                  id="resi"
                                  placeholder="Masukkan nomor pelacakan"
                                  value={trackingNumber}
                                  onChange={(e) => setTrackingNumber(e.target.value)}
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

                      {/* Action: Receive (Only for Destination Branch Manager) */}
                      {transfer.status === "shipped" && (role === 'manager' && userBranchId === transfer.toBranchId) && (
                        <Dialog
                          open={isReceiveDialogOpen && transferToProcess?.id === transfer.id}
                          onOpenChange={(open) => {
                            setIsReceiveDialogOpen(open);
                            if (!open) {
                              setTransferToProcess(null);
                              setActionType(null);
                              setProofPhotoUrl(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500 text-green-500 hover:bg-green-500/10"
                              onClick={() => { setTransferToProcess(transfer); setActionType("receive"); setProofPhotoUrl(null); setIsReceiveDialogOpen(true); }}
                            >
                              Terima Barang
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="text-black">
                            <DialogHeader>
                              <DialogTitle>Terima Barang</DialogTitle>
                              <DialogDescription className="text-black">
                                Konfirmasi bahwa {transfer.quantity} unit {transfer.itemName} telah sampai di {transfer.toBranchName}. Unggah foto bukti penerimaan sebelum konfirmasi.
                              </DialogDescription>
                            </DialogHeader>
                            <PhotoUploadProof
                              onPhotoReady={(base64) => setProofPhotoUrl(base64)}
                              onError={() => setProofPhotoUrl(null)}
                            />
                            <div className="flex justify-end gap-3">
                              <Button
                                variant="ghost"
                                onClick={() => { setIsReceiveDialogOpen(false); setTransferToProcess(null); setActionType(null); setProofPhotoUrl(null); }}
                              >
                                Batal
                              </Button>
                              <Button
                                onClick={handleProcessTransfer}
                                disabled={!proofPhotoUrl}
                                className="bg-green-600 hover:bg-green-500"
                              >
                                Konfirmasi Terima
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
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
                            <AlertDialogContent className="text-black">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                                <AlertDialogDescription className="text-black">
                                  Tindakan ini tidak dapat dibatalkan. Catatan transfer ini akan dihapus secara permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => { setTransferToDeleteId(null); setIsDeleteAlertOpen(false); }}>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteTransfer} className="bg-red-600 hover:bg-red-500 text-white">Hapus</AlertDialogAction>
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
                  Belum ada permintaan transfer.
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