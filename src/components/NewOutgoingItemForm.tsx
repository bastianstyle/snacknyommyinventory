import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, doc, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InventoryDoc, InventoryEntry } from "@/pages/Inventory";

const formSchema = z.object({
  inventoryId: z.string().min(1, "Inventaris harus dipilih."),
  quantity: z.coerce.number().min(1, "Jumlah harus lebih dari 0."),
  reason: z.string().min(3, "Alasan harus diisi (min. 3 karakter)."),
});

type FormValues = z.infer<typeof formSchema>;

interface InventoryOption {
  value: string;
  label: string;
  currentStock: number;
}

export const NewOutgoingItemForm = ({ onTransactionComplete }: { onTransactionComplete: () => void }) => {
  const { itemsMap, branchesMap } = useData();
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStock, setSelectedStock] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      reason: "",
    },
  });

  useEffect(() => {
    const fetchInventories = async () => {
      // Only fetch inventories if itemsMap and branchesMap are populated
      if (itemsMap.size === 0 || branchesMap.size === 0) {
        setInventoryOptions([]); // Clear options if maps are not ready
        return;
      }

      try {
        const inventorySnapshot = await getDocs(collection(db, "inventory"));
        const options = inventorySnapshot.docs.map(docSnap => {
          const inventory = { id: docSnap.id, ...docSnap.data() } as InventoryDoc;
          const item = itemsMap.get(inventory.itemId);
          const itemName = item?.name || "Item Tidak Dikenal";
          const branchName = branchesMap.get(inventory.branchId) || "Cabang Tidak Dikenal";
          const currentStock = inventory.entries.reduce((acc, entry) => acc + entry.quantity, 0);
          
          return {
            value: inventory.id,
            label: `${itemName} - ${branchName}`,
            currentStock,
          };
        }).filter(opt => opt.currentStock > 0); // Hanya tampilkan item yang memiliki stok
        setInventoryOptions(options);
      } catch (error) {
        console.error("Error fetching inventories for outgoing form:", error);
        toast.error("Gagal memuat daftar inventaris.");
        setInventoryOptions([]);
      }
    };
    fetchInventories();
  }, [itemsMap, branchesMap, onTransactionComplete]); // Dependencies ensure re-fetch when maps are ready

  const handleInventoryChange = (inventoryId: string) => {
    const selectedOption = inventoryOptions.find(opt => opt.value === inventoryId);
    setSelectedStock(selectedOption?.currentStock ?? null);
    form.trigger("quantity"); 
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Memproses barang keluar...");

    try {
      await runTransaction(db, async (transaction) => {
        const inventoryRef = doc(db, "inventory", values.inventoryId);
        const inventoryDoc = await transaction.get(inventoryRef);

        if (!inventoryDoc.exists()) {
          throw new Error("Dokumen inventaris tidak ditemukan.");
        }

        const inventoryData = inventoryDoc.data() as InventoryDoc;
        const currentEntries: InventoryEntry[] = inventoryData.entries || [];
        const currentStock = currentEntries.reduce((sum, entry) => sum + entry.quantity, 0);

        if (values.quantity > currentStock) {
          throw new Error(`Stok tidak mencukupi. Stok tersedia: ${currentStock}.`);
        }

        // Logika FIFO
        let quantityToRemove = values.quantity;
        const updatedEntries: InventoryEntry[] = [];
        let totalValueRemoved = 0;

        for (const entry of currentEntries) {
          if (quantityToRemove <= 0) {
            updatedEntries.push(entry);
            continue;
          }

          const pricePerUnit = entry.purchasePrice;
          if (entry.quantity <= quantityToRemove) {
            quantityToRemove -= entry.quantity;
            totalValueRemoved += entry.quantity * pricePerUnit;
          } else {
            const newQuantity = entry.quantity - quantityToRemove;
            totalValueRemoved += quantityToRemove * pricePerUnit;
            quantityToRemove = 0;
            updatedEntries.push({ ...entry, quantity: newQuantity });
          }
        }

        const newOutgoingItemRef = doc(collection(db, "outgoing_items"));
        transaction.set(newOutgoingItemRef, {
          inventoryId: values.inventoryId, // Keep this as the reference to the inventory document
          itemId: inventoryData.itemId, // Correctly get itemId from inventoryData
          branchId: inventoryData.branchId, // Correctly get branchId from inventoryData
          quantity: values.quantity,
          reason: values.reason,
          totalValue: totalValueRemoved,
          createdAt: serverTimestamp(),
        });

        transaction.update(inventoryRef, { entries: updatedEntries });
      });

      toast.success("Berhasil!", { id: toastId, description: "Barang keluar telah dicatat dan stok diperbarui." });
      form.reset({ inventoryId: '', quantity: 1, reason: "" });
      setSelectedStock(null);
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="inventoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Pilih Inventaris Barang</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  handleInventoryChange(value);
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="text-gray-900">
                    <SelectValue placeholder="Pilih item dari cabang..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {inventoryOptions.length > 0 ? (
                    inventoryOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} (Stok: {opt.currentStock})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-items" disabled>
                      Tidak ada item inventaris dengan stok tersedia.
                    </SelectItem>
                  )}
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
              <FormLabel className="text-black">Jumlah Keluar</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 5" {...field} className="text-gray-900" />
              </FormControl>
              {selectedStock !== null && <p className="text-sm text-muted-foreground">Stok tersedia: {selectedStock}</p>}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Alasan Barang Keluar</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Penjualan, Rusak, Kadaluarsa..." {...field} className="text-gray-900" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Simpan Catatan"}
        </Button>
      </form>
    </Form>
  );
};