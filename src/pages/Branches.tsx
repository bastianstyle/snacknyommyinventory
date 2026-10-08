import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddBranchForm } from "@/components/AddBranchForm";
import { EditBranchForm } from "@/components/EditBranchForm";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export interface Branch {
  id: string;
  name: string;
  location: string;
  address?: string;
  phone?: string;
}

const Branches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const { role } = useAuth();

  useEffect(() => {
    document.title = "Snack Nyommy - Sistem Inventaris - Cabang";
    const q = query(collection(db, "branches"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const branchesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Branch[];
      setBranches(branchesData);
    });

    return () => unsubscribe();
  }, []);

  const handleEditClick = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsEditDialogOpen(true);
  };

  const handleDeleteBranch = async (branchId: string) => {
    try {
      await deleteDoc(doc(db, "branches", branchId));
      toast({
        title: "Berhasil",
        description: "Cabang berhasil dihapus.",
      });
    } catch (error) {
      console.error("Error deleting branch: ", error);
      toast({
        title: "Gagal",
        description: "Gagal menghapus cabang.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-2xl font-bold">Cabang</CardTitle>
          <CardDescription>Kelola cabang perusahaan Anda.</CardDescription>
        </div>
        {role === 'admin' && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">Tambah Cabang Baru</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] text-black">
              <DialogHeader>
                <DialogTitle className="text-black">Tambah Cabang Baru</DialogTitle>
                <DialogDescription className="text-black">
                  Isi detail untuk cabang baru.
                </DialogDescription>
              </DialogHeader>
              <AddBranchForm setDialogOpen={setIsAddDialogOpen} />
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Telepon</TableHead>
              {role === 'admin' && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>{branch.location}</TableCell>
                <TableCell>{branch.address || "-"}</TableCell>
                <TableCell>{branch.phone || "-"}</TableCell>
                {role === 'admin' && (
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(branch)}
                      >
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">Hapus</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="text-black">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-black">Apakah Anda yakin?</AlertDialogTitle>
                            <AlertDialogDescription className="text-black">
                              Tindakan ini tidak dapat dibatalkan. Cabang ini akan dihapus secara
                              permanen beserta datanya dari server kami.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="text-black">Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBranch(branch.id)} className="bg-red-600 hover:bg-red-500 text-white">Lanjutkan</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedBranch && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px] text-black">
              <DialogHeader>
                <DialogTitle className="text-black">Edit Cabang</DialogTitle>
                <DialogDescription className="text-black">
                  Perbarui detail untuk cabang ini.
                </DialogDescription>
              </DialogHeader>
              <EditBranchForm setDialogOpen={setIsEditDialogOpen} branch={selectedBranch} />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

export default Branches;
