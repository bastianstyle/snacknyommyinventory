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
    document.title = "Snack Nyommy - Inventory System - Branches";
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
        title: "Success",
        description: "Branch deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting branch: ", error);
      toast({
        title: "Error",
        description: "Failed to delete branch.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Branches</CardTitle>
        <CardDescription className="text-slate-300">Manage your company branches.</CardDescription>
        {role === 'admin' && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white">Add New Branch</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-black/20 backdrop-blur-lg border border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Branch</DialogTitle>
                <DialogDescription className="text-slate-300">
                  Fill in the details for the new branch.
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
            <TableRow className="hover:bg-white/10">
              <TableHead className="text-slate-200">Name</TableHead>
              <TableHead className="text-slate-200">Location</TableHead>
              <TableHead className="text-slate-200">Address</TableHead>
              <TableHead className="text-slate-200">Phone</TableHead>
              {role === 'admin' && <TableHead className="text-slate-200 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id} className="hover:bg-white/10">
                <TableCell className="font-medium text-white">{branch.name}</TableCell>
                <TableCell className="text-slate-200">{branch.location}</TableCell>
                <TableCell className="text-slate-200">{branch.address || "-"}</TableCell>
                <TableCell className="text-slate-200">{branch.phone || "-"}</TableCell>
                {role === 'admin' && (
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(branch)}
                        className="bg-transparent border-white/20 text-white hover:bg-white/10"
                      >
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">Delete</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-black/20 backdrop-blur-lg border border-white/10 text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-300">
                              This action cannot be undone. This will permanently delete the branch
                              and remove its data from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBranch(branch.id)} className="bg-red-600 hover:bg-red-500 text-white">Continue</AlertDialogAction>
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
            <DialogContent className="sm:max-w-[425px] bg-black/20 backdrop-blur-lg border border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Edit Branch</DialogTitle>
                <DialogDescription className="text-slate-300">
                  Update the details for this branch.
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