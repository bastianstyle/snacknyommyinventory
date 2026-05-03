import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useData } from '@/contexts/DataContext';
import { formatCurrencyIDR, formatDateID } from '@/lib/utils';
import { Printer } from 'lucide-react';

import { NewIncomingItemForm } from '@/components/NewIncomingItemForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export interface IncomingItem {
  id: string;
  itemId: string;
  branchId: string;
  quantity: number;
  purchasePrice: number;
  totalValue: number;
  supplier: string;
  createdAt: Timestamp;
}

const IncomingItems = () => {
  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { itemsMap, branchesMap } = useData();
  const [selectedItem, setSelectedItem] = useState<IncomingItem | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const mainPrintableAreaRef = useRef<HTMLDivElement>(null);

  const fetchIncomingItems = useCallback(() => {
    setLoading(true);
    const q = query(collection(db, "incoming_items"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomingItem));
      setIncomingItems(itemsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching incoming items:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = fetchIncomingItems();
    return () => unsubscribe();
  }, [fetchIncomingItems]);

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

  const handleOpenPrintDialog = (item: IncomingItem) => {
    setSelectedItem(item);
    setIsPrintDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="no-print">
        <h1 className="text-2xl md:text-3xl font-bold">Barang Masuk</h1>
        <NewIncomingItemForm onTransactionComplete={fetchIncomingItems} />
      </div>

      <div className="printable-area" ref={mainPrintableAreaRef}>
        <Card>
          <CardHeader className="no-print">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Riwayat Barang Masuk</CardTitle>
                <CardDescription>Daftar semua transaksi barang yang telah dicatat.</CardDescription>
              </div>
              <Button variant="outline" onClick={handlePrintAll}>
                <Printer className="mr-2 h-4 w-4" />
                Cetak Laporan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Pemasok</TableHead>
                  <TableHead className="text-right">Harga Satuan</TableHead>
                  <TableHead className="text-right">Total Nilai</TableHead>
                  <TableHead>Tanggal Masuk</TableHead>
                  <TableHead className="text-center no-print">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : incomingItems.length > 0 ? (
                  incomingItems.map((item) => {
                    const itemData = itemsMap.get(item.itemId);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{itemData?.name || 'N/A'}</TableCell>
                        <TableCell>{branchesMap.get(item.branchId) || 'N/A'}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell>{item.supplier}</TableCell>
                        <TableCell className="text-right">{formatCurrencyIDR(item.purchasePrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyIDR(item.totalValue)}</TableCell>
                        <TableCell>{item.createdAt ? formatDateID(item.createdAt.toDate()) : 'N/A'}</TableCell>
                        <TableCell className="text-center no-print">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenPrintDialog(item)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Belum ada riwayat barang masuk.</TableCell>
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
                <DialogTitle>Struk Barang Masuk</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 text-black">
                <h3 className="text-lg font-bold text-center">BUKTI BARANG MASUK</h3>
                <div className="text-sm">
                  <div className="flex justify-between"><span>Tanggal:</span> <span>{selectedItem.createdAt ? formatDateID(selectedItem.createdAt.toDate()) : 'N/A'}</span></div>
                  <div className="flex justify-between"><span>Pemasok:</span> <span>{selectedItem.supplier}</span></div>
                  <div className="flex justify-between"><span>Cabang:</span> <span>{branchesMap.get(selectedItem.branchId) || 'N/A'}</span></div>
                </div>
                <hr className="border-black" />
                <div className="space-y-2">
                  <div className="font-semibold">{itemsMap.get(selectedItem.itemId)?.name || 'N/A'}</div>
                  <div className="flex justify-between text-sm">
                    <span>{selectedItem.quantity} x {formatCurrencyIDR(selectedItem.purchasePrice)}</span>
                    <span>{formatCurrencyIDR(selectedItem.totalValue)}</span>
                  </div>
                </div>
                <hr className="border-black" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
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

export default IncomingItems;