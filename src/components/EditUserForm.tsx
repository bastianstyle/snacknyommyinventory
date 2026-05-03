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
  role: z.enum(["admin", "manager"], { required_error: "Please select a role." }),
  branchId: z.string().optional(),
}).refine(data => data.role !== 'manager' || (data.role === 'manager' && !!data.branchId), {
  message: "A branch must be selected for managers.",
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
      toast.success("User updated successfully.");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating user: ", error);
      toast.error("Failed to update user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm font-medium text-slate-200">Editing user: <span className="font-normal text-slate-400">{user.email}</span></p>
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
        <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">{isSubmitting ? "Saving..." : "Save Changes"}</Button>
      </form>
    </Form>
  );
};