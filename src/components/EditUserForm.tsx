import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { UserData } from "@/pages/Users";
import { Branch } from "@/pages/Branches";
import { useState } from "react";

const formSchema = z.object({
  role: z.enum(["admin", "manager"], { required_error: "Pilih peran terlebih dahulu." }),
  branchId: z.string().optional(),
}).refine(data => data.role !== 'manager' || (data.role === 'manager' && !!data.branchId), {
  message: "Cabang wajib dipilih untuk manajer.",
  path: ["branchId"],
});

interface EditUserFormProps {
  setDialogOpen: (open: boolean) => void;
  user: UserData;
  branches: Branch[];
}

export const EditUserForm = ({ setDialogOpen, user, branches }: EditUserFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: user.role,
      branchId: user.branchId || "",
    },
  });

  const selectedRole = form.watch("role");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        role: values.role,
        branchId: values.role === 'manager' ? values.branchId : null,
      });
      toast.success("Pengguna berhasil diperbarui.");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating user: ", error);
      toast.error("Gagal memperbarui pengguna.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm font-medium text-black">Mengedit pengguna: <span className="font-normal text-black">{user.email}</span></p>
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Peran</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className="text-black"><SelectValue placeholder="Pilih peran" className="text-black" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="admin" className="text-black">Admin</SelectItem>
                  <SelectItem value="manager" className="text-black">Manager</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {selectedRole === 'manager' && (
          <FormField
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-black">Cabang</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger className="text-black"><SelectValue placeholder="Pilih cabang" className="text-black" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id} className="text-black">
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</Button>
      </form>
    </Form>
  );
};
