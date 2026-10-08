import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";
import { toast } from "sonner";
import { ProcessedInventory } from "@/pages/Inventory";

const formSchema = z.object({
  quantityChange: z.coerce.number().int("Quantity must be an integer.").refine(val => val !== 0, "Quantity change cannot be zero."),
});

interface ManageStockFormProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItem: ProcessedInventory;
}

const ManageStockForm = ({ isOpen, onClose, inventoryItem }: ManageStockFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantityChange: 0,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const inventoryRef = doc(db, "inventory", inventoryItem.id);

      await runTransaction(db, async (transaction) => {
        const inventoryDoc = await transaction.get(inventoryRef);
        if (!inventoryDoc.exists()) {
          throw new Error("Inventory item does not exist!");
        }

        // Menggunakan totalQuantity dari ProcessedInventory
        const currentQuantity = inventoryItem.totalQuantity; // Menggunakan totalQuantity
        const newQuantity = currentQuantity + values.quantityChange;

        if (newQuantity < 0) {
          throw new Error("Cannot reduce stock below zero.");
        }

        // Recalculate totalValue
        // Menggunakan averagePrice dari ProcessedInventory
        const price = inventoryItem.averagePrice || 0; // Menggunakan averagePrice
        const newTotalValue = newQuantity * price;

        transaction.update(inventoryRef, { 
          quantity: newQuantity, // Ini mengasumsikan ada field 'quantity' di dokumen Firestore
          totalValue: newTotalValue, // Ini mengasumsikan ada field 'totalValue' di dokumen Firestore
        });
      });

      toast.success("Stock updated successfully.");
      form.reset();
      onClose();
    } catch (error: any) {
      console.error("Error managing stock:", error);
      toast.error(error.message || "An error occurred while updating stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] text-black">
        <DialogHeader>
          <DialogTitle>Manage Stock for {inventoryItem.itemName}</DialogTitle>
          <DialogDescription className="text-black">
            Adjust the quantity for this item at {inventoryItem.branchName}.
            Current stock: {inventoryItem.totalQuantity} {/* Menggunakan totalQuantity */}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantityChange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Change (e.g., 5 for add, -3 for remove)</FormLabel>
                  <FormControl><Input type="number" placeholder="Enter quantity change" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">{isSubmitting ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ManageStockForm;