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

interface AddItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  existingItems?: { name: string }[];
}

// Menormalisasi nama item (trim + lowercase + rapikan spasi ganda) agar
// perbandingan duplikasi tidak lolos hanya karena beda kapitalisasi/spasi.
const normalizeItemName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

const AddItemForm = ({ isOpen, onClose, existingItems = [] }: AddItemFormProps) => {
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
    const isDuplicate = existingItems.some(
      (item) => normalizeItemName(item.name) === normalizeItemName(values.name)
    );
    if (isDuplicate) {
      form.setError("name", {
        type: "manual",
        message: "Item dengan nama ini sudah terdaftar. Gunakan nama lain atau edit item yang sudah ada.",
      });
      toast({
        title: "Item Duplikat",
        description: `"${values.name}" sudah ada di katalog. Setiap jenis item hanya boleh didaftarkan sekali.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "items"), values);
      toast({
        title: "Berhasil",
        description: "Item baru berhasil ditambahkan ke katalog.",
      });
      form.reset();
      onClose();
    } catch (error) {
      console.error("Error adding item: ", error);
      toast({
        title: "Gagal",
        description: "Gagal menambahkan item. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] text-black">
        <DialogHeader>
          <DialogTitle className="text-black">Tambah Item Baru</DialogTitle>
          <DialogDescription className="text-black">
            Isi detail produk baru untuk katalog inventaris UMKM Snack Nyommy.
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel className="text-black">SKU</FormLabel>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-sku-switch"
                    checked={autoGenerateSku}
                    onCheckedChange={setAutoGenerateSku}
                  />
                  <Label htmlFor="auto-sku-switch" className="text-black">Buat Otomatis</Label>
                </div>
              </div>
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Contoh: KRP-001" {...field} disabled={autoGenerateSku} className="text-black placeholder:text-black disabled:text-black" />
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
                {isSubmitting ? "Menambahkan..." : "Tambah Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemForm;
