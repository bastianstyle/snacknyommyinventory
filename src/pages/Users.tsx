import { useState, useEffect, useMemo } from "react";
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
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, deleteDoc, doc } from "firebase/firestore";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { EditUserForm } from "@/components/EditUserForm";
import { AddUserForm } from "@/components/AddUserForm";
import { Branch } from "./Branches";
import { Badge } from "@/components/ui/badge";
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

export interface UserData {
  id: string;
  email: string;
  role: "admin" | "manager";
  branchId?: string;
}

const Users = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const { role, user: currentUser } = useAuth();
  const isAdmin = role === 'admin';

  useEffect(() => {
    document.title = "Snack Nyommy - Sistem Inventaris - Pengguna";
    const fetchBranches = async () => {
      try {
        const branchesSnapshot = await getDocs(collection(db, "branches"));
        setBranches(branchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Branch[]);
      } catch (error) {
        console.error("Error fetching branches:", error);
        toast.error("Gagal memuat data cabang.");
      }
    };

    fetchBranches();

    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UserData[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users: ", error);
      toast.error("Gagal memuat data pengguna.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processedUsers = useMemo(() => {
    const branchesMap = new Map(branches.map(branch => [branch.id, branch.name]));
    return users.map(user => ({
      ...user,
      branchName: user.branchId ? branchesMap.get(user.branchId) || "Cabang Tidak Valid" : "N/A",
    }));
  }, [users, branches]);

  const handleEditClick = (user: UserData) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (user: UserData) => {
    setUserToDelete(user);
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, "users", userToDelete.id));
      toast.success("Pengguna berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting user: ", error);
      toast.error("Gagal menghapus pengguna.");
    } finally {
      setIsDeleteAlertOpen(false);
      setUserToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Manajemen Pengguna</CardTitle>
            <CardDescription>Kelola akun pengguna dan hak aksesnya.</CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>Tambah Pengguna</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] text-black">
                <DialogHeader>
                  <DialogTitle className="text-black">Tambah Pengguna Baru</DialogTitle>
                  <DialogDescription className="text-black">
                    Buat akun pengguna baru dan tetapkan perannya.
                  </DialogDescription>
                </DialogHeader>
                <AddUserForm setDialogOpen={setIsAddDialogOpen} branches={branches} existingUsers={users} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Cabang Ditugaskan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : processedUsers.length > 0 ? (
              processedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.branchName}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={user.id === currentUser?.uid}
                          title={user.id === currentUser?.uid ? "Tidak dapat menghapus akun sendiri" : "Hapus pengguna"}
                          onClick={() => handleDeleteClick(user)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Belum ada pengguna.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {editingUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px] text-black">
            <DialogHeader>
              <DialogTitle className="text-black">Edit Pengguna</DialogTitle>
              <DialogDescription className="text-black">
                Perbarui peran dan cabang untuk pengguna ini.
              </DialogDescription>
            </DialogHeader>
            <EditUserForm
              setDialogOpen={setIsEditDialogOpen}
              user={editingUser}
              branches={branches}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="text-black">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">Hapus pengguna ini?</AlertDialogTitle>
            <AlertDialogDescription className="text-black">
              Akun <strong>{userToDelete?.email}</strong> akan kehilangan akses ke sistem secara permanen.
              Tindakan ini hanya menghapus profil & hak akses pengguna pada database aplikasi; kredensial
              login Firebase Authentication miliknya tidak ikut terhapus (memerlukan akses server terpisah),
              namun tanpa profil ini pengguna tidak akan bisa mengakses data apa pun setelah login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-black">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-500 text-white">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default Users;
