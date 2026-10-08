import { useEffect } from "react";
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
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Branch } from "@/pages/Branches";
import { Item } from "@/pages/Items";
import { InventoryDoc } from "@/pages/Inventory";

const formSchema = z.object({
  fromBranchId: z.string().min(1, { message: "Pilih cabang asal terlebih dahulu." }),
  toBranchId: z.string().min(1, { message: "Pilih cabang tujuan terlebih dahulu." }),
  itemId: z.string().min(1, { message: "Pilih barang yang akan ditransfer." }),
  quantity: z.coerce.number().int().positive({ message: "Jumlah harus berupa angka positif." }),
}).superRefine((data, ctx) => {
  if (data.fromBranchId && data.toBranchId && data.fromBranchId === data.toBranchId) {
    const message = "Cabang asal dan cabang tujuan tidak boleh sama.";
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["fromBranchId"] });
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["toBranchId"] });
  }
});

interface NewTransferFormProps {
  setDialogOpen: (open: boolean) => void;
  branches: Branch[];
  items: Item[];
  initialValues?: {
    toBranchId?: string;
    itemId?: string;
    fromBranchId?: string;
  };
  /**
   * Kalau diisi, field "Cabang Tujuan" dikunci ke cabang ini dan tidak bisa diubah.
   * Sesuai firestore.rules (transfers.create hanya boleh oleh manajer cabang tujuan),
   * seorang Manager hanya boleh mengajukan permintaan transfer UNTUK cabangnya sendiri —
   * jadi manajer Bandung tidak mungkin membuat permintaan dengan cabang tujuan Pontianak.
   */
  lockedToBranchId?: string;
}

export const NewTransferForm = ({ setDialogOpen, branches, items, initialValues, lockedToBranchId }: NewTransferFormProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromBranchId: initialValues?.fromBranchId || "",
      toBranchId: lockedToBranchId || initialValues?.toBranchId || "",
      itemId: initialValues?.itemId || "",
      quantity: 1,
    },
  });

  const watchedFromBranch = form.watch("fromBranchId");
  const watchedToBranch = form.watch("toBranchId");

  useEffect(() => {
    if (initialValues || lockedToBranchId) {
      form.reset({
        fromBranchId: initialValues?.fromBranchId || "",
        toBranchId: lockedToBranchId || initialValues?.toBranchId || "",
        itemId: initialValues?.itemId || "",
        quantity: 1,
      });
    }
  }, [initialValues, lockedToBranchId, form.reset]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.fromBranchId === values.toBranchId) {
      toast.error("Transfer Tidak Valid", {
        description: "Cabang asal dan cabang tujuan tidak boleh sama.",
      });
      return;
    }

    try {
      // Fetch source inventory to check stock and get average price
      const inventoryId = `${values.fromBranchId}_${values.itemId}`;
      const inventoryRef = doc(db, "inventory", inventoryId);
      const inventorySnap = await getDoc(inventoryRef);

      if (!inventorySnap.exists()) {
        toast.error("Barang ini tidak terdaftar di inventaris cabang asal.");
        return;
      }

      const inventoryData = inventorySnap.data() as InventoryDoc;
      const entries = inventoryData.entries || [];
      const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
      const totalValueInStock = entries.reduce((sum, entry) => sum + entry.totalValue, 0);

      if (totalQuantity < values.quantity) {
        toast.error(`Stok tidak mencukupi. Tersedia ${totalQuantity} di cabang asal.`);
        return;
      }

      const averagePrice = totalQuantity > 0 ? totalValueInStock / totalQuantity : 0;
      const transferTotalValue = values.quantity * averagePrice;

      await addDoc(collection(db, "transfers"), {
        ...values,
        status: "pending",
        createdAt: serverTimestamp(),
        totalValue: transferTotalValue,
      });
      toast.success("Permintaan transfer berhasil dibuat.");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error creating transfer: ", error);
      toast.error("Gagal membuat permintaan transfer.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fromBranchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cabang Asal</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Pilih cabang asal" /></SelectTrigger></FormControl>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id} disabled={branch.id === watchedToBranch}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="toBranchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cabang Tujuan</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!!lockedToBranchId}>
                <FormControl><SelectTrigger><SelectValue placeholder="Pilih cabang tujuan" /></SelectTrigger></FormControl>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id} disabled={branch.id === watchedFromBranch}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockedToBranchId && (
                <p className="text-xs text-muted-foreground">
                  Anda hanya dapat mengajukan permintaan transfer untuk cabang Anda sendiri.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="itemId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Barang</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Pilih barang yang akan ditransfer" /></SelectTrigger></FormControl>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Jumlah</FormLabel>
              <FormControl><Input type="number" placeholder="Masukkan jumlah" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">Ajukan Permintaan Transfer</Button>
      </form>
    </Form>
  );
};