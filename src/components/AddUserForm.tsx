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
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["admin", "manager"], { required_error: "Please select a role." }),
  branchId: z.string().optional(),
}).refine(data => data.role !== 'manager' || (data.role === 'manager' && !!data.branchId), {
  message: "A branch must be selected for managers.",
  path: ["branchId"],
});

interface AddUserFormProps {
  setDialogOpen: (open: boolean) => void;
  branches: Branch[];
}

export const AddUserForm = ({ setDialogOpen, branches }: AddUserFormProps) => {
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

      toast.success("User created successfully.");
      setDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating user: ", error);
      let errorMessage = "Failed to create user.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already in use.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak.";
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
              <FormLabel className="text-slate-200">Email</FormLabel>
              <FormControl><Input type="email" placeholder="user@example.com" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Password</FormLabel>
              <FormControl><Input type="password" placeholder="••••••" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className="bg-black/30 border-white/20 text-white"><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                <SelectContent className="bg-black border-white/20 text-foreground">
                  <SelectItem value="admin" className="hover:bg-white/10 focus:bg-white/10 text-slate-50">Admin</SelectItem>
                  <SelectItem value="manager" className="hover:bg-white/10 focus:bg-white/10 text-slate-50">Manager</SelectItem>
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
                <FormLabel className="text-slate-200">Branch</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger className="bg-black/30 border-white/20 text-white"><SelectValue placeholder="Select a branch" /></SelectTrigger></FormControl>
                  <SelectContent className="bg-black border-white/20 text-foreground">
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id} className="hover:bg-white/10 focus:bg-white/10 text-slate-50">
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
        <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">{isSubmitting ? "Creating..." : "Create User"}</Button>
      </form>
    </Form>
  );
};