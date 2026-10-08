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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase"; // Hapus 'auth' dari import ini
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth"; // Tambahkan 'getAuth'
import { doc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Branch } from "@/pages/Branches";
import { useState } from "react";
import { initializeApp, deleteApp } from "firebase/app"; // Import baru
import { firebaseConfig } from "@/lib/firebase"; // Import baru

const formSchema = z.object({
  email: z.string().email({ message: "Alamat email tidak valid." }),
  password: z.string().min(6, { message: "Password minimal 6 karakter." }),
  role: z.enum(["admin", "manager"], { required_error: "Pilih peran terlebih dahulu." }),
  branchId: z.string().optional(),
}).refine(data => data.role !== 'manager' || (data.role === 'manager' && !!data.branchId), {
  message: "Cabang wajib dipilih untuk manajer.",
  path: ["branchId"],
});

interface AddUserFormProps {
  setDialogOpen: (open: boolean) => void;
  branches: Branch[];
  existingUsers?: { email: string }[];
}

// Trim + lowercase agar perbandingan email tidak lolos hanya karena beda kapitalisasi/spasi.
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const AddUserForm = ({ setDialogOpen, branches, existingUsers = [] }: AddUserFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "manager",
      branchId: "",
    },
  });

  const selectedRole = form.watch("role");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const isDuplicate = existingUsers.some(
      (user) => normalizeEmail(user.email) === normalizeEmail(values.email)
    );
    if (isDuplicate) {
      form.setError("email", {
        type: "manual",
        message: "Pengguna dengan email ini sudah terdaftar.",
      });
      toast.error("Pengguna Duplikat", {
        description: `Email "${values.email}" sudah digunakan oleh akun lain.`,
      });
      return;
    }

    setIsSubmitting(true);
    const tempAppName = `user-creation-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email: values.email,
        role: values.role,
        branchId: values.role === 'manager' ? values.branchId : null,
      });

      toast.success("Pengguna berhasil dibuat.");
      setDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating user: ", error);
      let errorMessage = "Gagal membuat pengguna.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Alamat email ini sudah digunakan.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password terlalu lemah.";
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      await deleteApp(tempApp);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Email</FormLabel>
              <FormControl><Input type="email" placeholder="pengguna@contoh.com" {...field} className="text-black placeholder:text-black" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Password</FormLabel>
              <FormControl><Input type="password" placeholder="••••••" {...field} className="text-black placeholder:text-black" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">{isSubmitting ? "Membuat..." : "Buat Pengguna"}</Button>
      </form>
    </Form>
  );
};
