import { useState, useEffect } from "react";
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
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import AddItemForm from "@/components/AddItemForm";
import EditItemForm from "@/components/EditItemForm";
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

export interface Item {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  description?: string;
}

const Items = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Snack Nyommy - Sistem Inventaris - Manajemen Item";
    const unsubscribe = onSnapshot(collection(db, "items"), (snapshot) => {
      const itemsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Item[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching items: ", error);
      toast({
        title: "Gagal",
        description: "Gagal memuat data item.",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEditClick = (item: Item) => {
    setSelectedItem(item);
    setIsEditFormOpen(true);
  };

  const handleDeleteClick = (itemId: string) => {
    setItemToDeleteId(itemId);
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDeleteId) return;
    try {
      await deleteDoc(doc(db, "items", itemToDeleteId));
      toast({
        title: "Berhasil",
        description: "Item berhasil dihapus.",
      });
    } catch (error) {
      console.error("Error deleting item: ", error);
      toast({
        title: "Gagal",
        description: "Gagal menghapus item.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteAlertOpen(false);
      setItemToDeleteId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Manajemen Item</CardTitle>
            <CardDescription>
              Kelola daftar item master inventaris di sini.
            </CardDescription>
          </div>
          {isAdmin && (
            <Button className="w-full sm:w-auto" onClick={() => setIsAddFormOpen(true)}>Tambah Item</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Satuan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell></TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.sku}</TableCell><TableCell>{item.category}</TableCell><TableCell>{item.unit}</TableCell><TableCell className="text-right">
                  {isAdmin && (
                    <div className="flex justify-end items-center space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell></TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="text-center">
                Belum ada item. Tambahkan satu untuk memulai.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <AddItemForm
        isOpen={isAddFormOpen}
        onClose={() => setIsAddFormOpen(false)}
        existingItems={items}
      />

      <EditItemForm
        isOpen={isEditFormOpen}
        onClose={() => {
          setIsEditFormOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
      />

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="text-black">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription className="text-black">
              Tindakan ini tidak dapat dibatalkan. Item akan dihapus secara permanen
              dari inventaris Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-black">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-500 text-white">Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default Items;
