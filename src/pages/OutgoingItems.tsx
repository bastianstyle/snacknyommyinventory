import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatDateID, formatCurrencyIDR } from '@/lib/utils';
import { Printer, PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { NewOutgoingItemForm } from '@/components/NewOutgoingItemForm';
import { Skeleton } from '@/components/ui/skeleton';

export interface OutgoingItemDoc {
  id: string;
  branchId: string;
  itemId: string;
  quantity: number;
  reason: string;
  totalValue: number;
  createdAt: Timestamp;
}

const OutgoingItems = () => {
  const { role } = useAuth();
  const { branchesMap, itemsMap } = useData();
  const [outgoingItems, setOutgoingItems] = useState<OutgoingItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OutgoingItemDoc | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const mainPrintableAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, "outgoing_items"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as OutgoingItemDoc));
      setOutgoingItems(itemsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching outgoing items:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const canManage = role === 'admin' || role === 'manager';

  const handleTransactionComplete = () => {
    setIsFormOpen(false);
  };

  const handlePrintAll = () => {
    setIsPrintDialogOpen(false);
    window.print();
  };

  const handlePrintReceipt = () => {
    if (mainPrintableAreaRef.current) {
      mainPrintableAreaRef.current.classList.add('no-print');
    }
    try {
      window.print();
    } finally {
      if (mainPrintableAreaRef.current) {
        mainPrintableAreaRef.current.classList.remove('no-print');
      }
      setIsPrintDialogOpen(false);
    }
  };

  const handleOpenPrintDialog = (item: OutgoingItemDoc) => {
    setSelectedItem(item);
    setIsPrintDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="printable-area" ref={mainPrintableAreaRef}>
        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between no-print">
              <div>
                <CardTitle>Riwayat Barang Keluar</CardTitle>
                <CardDescription>Daftar semua item yang telah dikeluarkan dari inventaris.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Catat Barang Keluar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>Formulir Barang Keluar</DialogTitle>
                      </DialogHeader>
                      <NewOutgoingItemForm onTransactionComplete={handleTransactionComplete} />
                    </DialogContent>
                  </Dialog>
                )}
                <Button variant="outline" onClick={handlePrintAll}>
                  <Printer className="mr-2 h-4 w-4" />
                  Cetak Laporan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead className="text-right">Nilai Keluar</TableHead>
                  <TableHead className="text-center no-print">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : outgoingItems.length > 0 ? (
                  outgoingItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{formatDateID(item.createdAt.toDate())}</TableCell>
                      <TableCell>{itemsMap.get(item.itemId)?.name || 'Item tidak diketahui'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{branchesMap.get(item.branchId) || 'Cabang tidak diketahui'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrencyIDR(item.totalValue)}</TableCell>
                      <TableCell className="text-center no-print">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPrintDialog(item)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      Belum ada data barang keluar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {selectedItem && (
        <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <div className="printable-area print-dialog-content">
              <DialogHeader className="no-print">
                <DialogTitle>Struk Barang Keluar</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 text-black">
                <h3 className="text-lg font-bold text-center">BUKTI BARANG KELUAR</h3>
                <div className="text-sm">
                  <div className="flex justify-between"><span>Tanggal:</span> <span>{selectedItem.createdAt ? formatDateID(selectedItem.createdAt.toDate()) : 'N/A'}</span></div>
                  <div className="flex justify-between"><span>Cabang:</span> <span>{branchesMap.get(selectedItem.branchId) || 'N/A'}</span></div>
                  <div className="flex justify-between"><span>Alasan:</span> <span>{selectedItem.reason}</span></div>
                </div>
                <hr className="border-black" />
                <div className="space-y-2">
                  <div className="font-semibold">{itemsMap.get(selectedItem.itemId)?.name || 'N/A'}</div>
                  <div className="flex justify-between text-sm">
                    <span>Jumlah: {selectedItem.quantity}</span>
                    <span className="font-semibold">{formatCurrencyIDR(selectedItem.totalValue)}</span>
                  </div>
                </div>
                <hr className="border-black" />
                <div className="flex justify-between font-bold">
                  <span>Total Nilai Keluar</span>
                  <span>{formatCurrencyIDR(selectedItem.totalValue)}</span>
                </div>
                <div className="text-xs text-center mt-4">
                  Dicetak pada: {formatDateID(new Date())}
                </div>
              </div>
            </div>
            <DialogFooter className="no-print">
              <Button onClick={handlePrintReceipt}>Cetak Struk</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default OutgoingItems;