import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, doc, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyIDR } from "@/lib/utils";
import { InventoryDoc } from "@/pages/Inventory";
import { Item } from "@/pages/Items";

const formSchema = z.object({
  inventoryId: z.string().min(1, "Inventaris harus dipilih."),
  quantity: z.coerce.number().min(1, "Jumlah harus lebih dari 0."),
  supplier: z.string().min(1, "Nama pemasok harus diisi."),
  purchasePrice: z.coerce.number().min(0, "Harga satuan tidak boleh negatif."),
});

type FormValues = z.infer<typeof formSchema>;

interface InventoryOption {
  value: string;
  label: string;
  supplier: string;
}

export const NewIncomingItemForm = ({ onTransactionComplete }: { onTransactionComplete: () => void }) => {
  const { itemsMap, branchesMap } = useData();
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      supplier: "",
      purchasePrice: 0,
    },
  });

  const watchedQuantity = form.watch("quantity", 1);
  const watchedPrice = form.watch("purchasePrice", 0);
  const totalValue = watchedQuantity * watchedPrice;

  useEffect(() => {
    const fetchInventories = async () => {
      if (itemsMap.size === 0 || branchesMap.size === 0) return;

      const inventorySnapshot = await getDocs(collection(db, "inventory"));
      const options = inventorySnapshot.docs.map(docSnap => {
        const inventory = { id: docSnap.id, ...docSnap.data() } as InventoryDoc;
        const item = itemsMap.get(inventory.itemId);
        const itemName = item?.name || "Item Tidak Dikenal";
        const branchName = branchesMap.get(inventory.branchId) || "Cabang Tidak Dikenal";
        const lastSupplier = inventory.entries.length > 0 ? inventory.entries[inventory.entries.length - 1].supplier : "";
        return {
          value: inventory.id,
          label: `${itemName} - ${branchName}`,
          supplier: lastSupplier,
        };
      });
      setInventoryOptions(options);
    };
    fetchInventories();
  }, [itemsMap, branchesMap]);

  const handleInventoryChange = (inventoryId: string) => {
    const selectedOption = inventoryOptions.find(opt => opt.value === inventoryId);
    if (selectedOption && selectedOption.supplier) {
      form.setValue("supplier", selectedOption.supplier);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Mencatat barang masuk...");

    try {
      const [branchId, itemId] = values.inventoryId.split('_');
      
      await runTransaction(db, async (transaction) => {
        const inventoryRef = doc(db, "inventory", values.inventoryId);
        const inventoryDoc = await transaction.get(inventoryRef);

        if (!inventoryDoc.exists()) {
          throw new Error("Dokumen inventaris tidak ditemukan. Tidak dapat melanjutkan.");
        }

        const newIncomingItemRef = doc(collection(db, "incoming_items"));
        transaction.set(newIncomingItemRef, {
          inventoryId: values.inventoryId,
          itemId,
          branchId,
          quantity: values.quantity,
          purchasePrice: values.purchasePrice,
          supplier: values.supplier,
          totalValue: values.quantity * values.purchasePrice,
          createdAt: serverTimestamp(),
        });

        const newEntry = {
          quantity: values.quantity,
          purchasePrice: values.purchasePrice,
          supplier: values.supplier,
          totalValue: values.quantity * values.purchasePrice,
          purchaseDate: new Date(),
        };
        
        const currentEntries = inventoryDoc.data().entries || [];
        transaction.update(inventoryRef, {
          entries: [...currentEntries, newEntry]
        });
      });

      toast.success("Berhasil!", { id: toastId, description: "Barang masuk telah dicatat dan inventaris diperbarui." });
      form.reset({ quantity: 1, purchasePrice: 0, supplier: "" });
      onTransactionComplete();
    } catch (error) {
      console.error("Transaction failed: ", error);
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
      toast.error("Gagal Mencatat", { id: toastId, description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catat Barang Masuk Baru</CardTitle>
        <CardDescription>Isi formulir untuk menambahkan catatan barang masuk dan memperbarui stok inventaris.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="inventoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pilih Inventaris Barang</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleInventoryChange(value);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih item dan cabang..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inventoryOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Pemasok</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., PT Pemasok Jaya" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Satuan (Beli)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 150000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Total Nilai Aset</FormLabel>
                <FormControl>
                  <Input readOnly disabled value={formatCurrencyIDR(totalValue)} />
                </FormControl>
              </FormItem>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan Catatan"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};