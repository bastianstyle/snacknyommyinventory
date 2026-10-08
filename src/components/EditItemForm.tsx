"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { doc, updateDoc } from "firebase/firestore";
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
import { Item } from "@/pages/Items";
import { categories } from "@/lib/itemCategories";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Nama item minimal 2 karakter.",
  }),
  sku: z.string().min(1, {
    message: "SKU wajib diisi.",
  }),
  category: z.string({
    required_error: "Pilih kategori terlebih dahulu.",
  }),
  unit: z.string().min(1, {
    message: "Satuan wajib diisi.",
  }),
  description: z.string().optional(),
});

interface EditItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
}

const EditItemForm = ({ isOpen, onClose, item }: EditItemFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        sku: item.sku,
        category: item.category,
        unit: item.unit,
        description: item.description || "",
      });
    }
  }, [item, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) return;
    setIsSubmitting(true);
    try {
      const itemRef = doc(db, "items", item.id);
      await updateDoc(itemRef, values);
      toast({
        title: "Berhasil",
        description: "Item berhasil diperbarui.",
      });
      onClose();
    } catch (error) {
      console.error("Error updating item: ", error);
      toast({
        title: "Gagal",
        description: "Gagal memperbarui item. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] text-black">
        <DialogHeader>
          <DialogTitle className="text-black">Edit Item</DialogTitle>
          <DialogDescription className="text-black">
            Perbarui detail produk ini di katalog inventaris.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-black">Nama Item</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Keripik Singkong Pedas" {...field} className="text-black placeholder:text-black" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-black">SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: KRP-001" {...field} disabled className="text-black placeholder:text-black disabled:text-black" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-black">Kategori</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="text-black">
                        <SelectValue placeholder="Pilih kategori" className="text-black" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category} className="text-black">
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
                  <FormLabel className="text-black">Satuan</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Pcs, Bungkus, Dus" {...field} className="text-black placeholder:text-black" />
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
                  <FormLabel className="text-black">Deskripsi (Opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Contoh: Keripik singkong pedas level 3, cocok untuk camilan sehari-hari" {...field} className="text-black placeholder:text-black" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="text-black">
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditItemForm;
