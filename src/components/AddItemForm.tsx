"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Item name must be at least 2 characters.",
  }),
  sku: z.string().min(1, {
    message: "SKU is required.",
  }),
  category: z.string({
    required_error: "Please select a category.",
  }),
  unit: z.string().min(1, {
    message: "Unit is required.",
  }),
  description: z.string().optional(),
});

const categories = [
  "Network Devices",
  "Cabling & Connectors",
  "Customer Premise Equipment (CPE)",
  "Tools & Equipment",
  "Accessories",
  "Other",
];

interface AddItemFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddItemForm = ({ isOpen, onClose }: AddItemFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sku: "",
      unit: "",
      description: "",
    },
  });

  const itemName = form.watch("name");

  useEffect(() => {
    if (autoGenerateSku && itemName) {
      const skuPrefix = itemName.slice(0, 3).toUpperCase();
      const skuSuffix = Math.floor(100 + Math.random() * 900);
      form.setValue("sku", `${skuPrefix}-${skuSuffix}`, { shouldValidate: true });
    }
  }, [itemName, autoGenerateSku, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "items"), values);
      toast({
        title: "Success",
        description: "Item added successfully.",
      });
      form.reset();
      onClose();
    } catch (error) {
      console.error("Error adding item: ", error);
      toast({
        title: "Error",
        description: "Failed to add item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-black/20 backdrop-blur-lg border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Add New Item</DialogTitle>
          <DialogDescription className="text-slate-300">
            Fill in the details for the new inventory item.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Fiber Optic Router" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel className="text-slate-200">SKU</FormLabel>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-sku-switch"
                    checked={autoGenerateSku}
                    onCheckedChange={setAutoGenerateSku}
                  />
                  <Label htmlFor="auto-sku-switch" className="text-slate-200">Auto-generate</Label>
                </div>
              </div>
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g., FIB-123" {...field} disabled={autoGenerateSku} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-black/30 border-white/20 text-white">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-black border-white/20 text-white">
                      {categories.map((category) => (
                        <SelectItem key={category} value={category} className="hover:bg-white/10 focus:bg-white/10">
                          {category}
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
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Unit</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Pcs" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., High-performance router for fiber optic connections" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="bg-transparent border-white/20 text-white hover:bg-white/10">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {isSubmitting ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemForm;