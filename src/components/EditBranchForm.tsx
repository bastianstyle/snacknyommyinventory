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
  name: z.string().min(2, { message: "Nama cabang minimal 2 karakter." }),
  location: z.string().min(2, { message: "Lokasi minimal 2 karakter." }),
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
        title: "Berhasil",
        description: "Cabang berhasil diperbarui.",
      });
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating branch: ", error);
      toast({
        title: "Gagal",
        description: "Gagal memperbarui cabang.",
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
              <FormLabel className="text-black">Nama Cabang</FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Cabang Pontianak" {...field} className="text-black placeholder:text-black" />
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
              <FormLabel className="text-black">Lokasi</FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Pontianak" {...field} className="text-black placeholder:text-black" />
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
              <FormLabel className="text-black">Alamat</FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Jl. Merdeka No. 123" {...field} className="text-black placeholder:text-black" />
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
              <FormLabel className="text-black">Nomor Telepon</FormLabel>
              <FormControl>
                <Input placeholder="Contoh: 0812-3456-7890" {...field} className="text-black placeholder:text-black" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">Simpan Perubahan</Button>
      </form>
    </Form>
  );
};
