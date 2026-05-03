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
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { Branch } from "@/pages/Branches";

const formSchema = z.object({
  name: z.string().min(2, { message: "Branch name must be at least 2 characters." }),
  location: z.string().min(2, { message: "Location must be at least 2 characters." }),
  address: z.string().optional(),
  phone: z.string().optional(),
});

interface EditBranchFormProps {
  setDialogOpen: (open: boolean) => void;
  branch: Branch;
}

export const EditBranchForm = ({ setDialogOpen, branch }: EditBranchFormProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: branch.name,
      location: branch.location,
      address: branch.address || "",
      phone: branch.phone || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const branchRef = doc(db, "branches", branch.id);
      await updateDoc(branchRef, values);
      toast({
        title: "Success",
        description: "Branch updated successfully.",
      });
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating branch: ", error);
      toast({
        title: "Error",
        description: "Failed to update branch.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Branch Name</FormLabel>
              <FormControl>
                <Input placeholder="Main Branch" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Location</FormLabel>
              <FormControl>
                <Input placeholder="New York" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="(555) 123-4567" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">Save Changes</Button>
      </form>
    </Form>
  );
};