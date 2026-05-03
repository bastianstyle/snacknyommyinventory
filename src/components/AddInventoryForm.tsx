"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"; // serverTimestamp is still imported but not used for purchaseDate in array
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useState } from "react";

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
import { Branch } from "@/pages/Branches";
import { Item } from "@/pages/Items";

const formSchema = z.object({
  branchId: z.string().min(1, { message: "Please select a branch." }),
  itemId: z.string().min(1, { message: "Please select an item." }),
  quantity: z.coerce.number().int().positive({ message: "Quantity must be a positive integer." }),
  purchasePrice: z.coerce.number().min(0, { message: "Purchase price must be a non-negative number." }),
  supplier: z.string().min(1, { message: "Supplier is required." }),
  rackLocation: z.string().optional(),
});

interface AddInventoryFormProps {
  setDialogOpen: (open: boolean) => void;
  branches: Branch[];
  items: Item[];
}

export const AddInventoryForm = ({ setDialogOpen, branches, items }: AddInventoryFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      branchId: "",
      itemId: "",
      quantity: 0,
      purchasePrice: 0,
      supplier: "",
      rackLocation: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Check if an inventory record for this branch and item already exists
      const inventoryId = `${values.branchId}_${values.itemId}`;
      const inventoryRef = doc(db, "inventory", inventoryId);
      const docSnap = await getDoc(inventoryRef);

      if (docSnap.exists()) {
        toast.error("Inventory record for this item and branch already exists. Please use 'Add Stock' from the inventory list to add more quantity.");
        return;
      }

      // Create the first entry for the new inventory record
      const firstEntry = {
        quantity: values.quantity,
        purchasePrice: values.purchasePrice,
        supplier: values.supplier,
        purchaseDate: new Date(), // Changed to new Date()
        totalValue: values.quantity * values.purchasePrice,
      };

      // Add the new inventory record using setDoc with a specific ID
      await setDoc(inventoryRef, {
        branchId: values.branchId,
        itemId: values.itemId,
        rackLocation: values.rackLocation || "",
        entries: [firstEntry],
      });

      toast.success("Initial stock record added successfully.");
      form.reset();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error adding initial stock record: ", error);
      toast.error("Failed to add initial stock. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="branchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Branch</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-black/30 border-white/20 text-white">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                </FormControl>
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
        <FormField
          control={form.control}
          name="itemId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Item</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-black/30 border-white/20 text-white">
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-black border-white/20 text-foreground">
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="hover:bg-white/10 focus:bg-white/10 text-slate-50">
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
              <FormLabel className="text-slate-200">Initial Quantity</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter initial quantity" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="purchasePrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Purchase Price (per unit)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter price per unit" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
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
              <FormLabel className="text-slate-200">Supplier</FormLabel>
              <FormControl>
                <Input placeholder="Enter supplier name" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rackLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">Rack Location (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., A1, Warehouse-Shelf-3" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting} className="bg-transparent border-white/20 text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
            {isSubmitting ? "Adding..." : "Add Initial Stock"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default AddInventoryForm;