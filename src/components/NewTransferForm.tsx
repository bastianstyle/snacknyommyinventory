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
  fromBranchId: z.string().min(1, { message: "Please select a source branch." }),
  toBranchId: z.string().min(1, { message: "Please select a destination branch." }),
  itemId: z.string().min(1, { message: "Please select an item." }),
  quantity: z.coerce.number().int().positive({ message: "Quantity must be a positive integer." }),
}).refine(data => data.fromBranchId !== data.toBranchId, {
  message: "Source and destination branches cannot be the same.",
  path: ["toBranchId"],
});

interface NewTransferFormProps {
  setDialogOpen: (open: boolean) => void;
  branches: Branch[];
  items: Item[];
}

export const NewTransferForm = ({ setDialogOpen, branches, items }: NewTransferFormProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromBranchId: "",
      toBranchId: "",
      itemId: "",
      quantity: 1,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Fetch source inventory to check stock and get average price
      const inventoryId = `${values.fromBranchId}_${values.itemId}`;
      const inventoryRef = doc(db, "inventory", inventoryId);
      const inventorySnap = await getDoc(inventoryRef);

      if (!inventorySnap.exists()) {
        toast.error("Item does not exist in the source branch's inventory.");
        return;
      }

      const inventoryData = inventorySnap.data() as InventoryDoc;
      const entries = inventoryData.entries || [];
      const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
      const totalValueInStock = entries.reduce((sum, entry) => sum + entry.totalValue, 0);

      if (totalQuantity < values.quantity) {
        toast.error(`Insufficient stock. Only ${totalQuantity} available in source branch.`);
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
      toast.success("Transfer request created successfully.");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error creating transfer: ", error);
      toast.error("Failed to create transfer request.");
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
              <FormLabel className="text-slate-200">From Branch</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className="bg-black/30 border-white/20 text-white"><SelectValue placeholder="Select source branch" /></SelectTrigger></FormControl>
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
          name="toBranchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200">To Branch</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className="bg-black/30 border-white/20 text-white"><SelectValue placeholder="Select destination branch" /></SelectTrigger></FormControl>
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
                <FormControl><SelectTrigger className="bg-black/30 border-white/20 text-white"><SelectValue placeholder="Select item to transfer" /></SelectTrigger></FormControl>
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
              <FormLabel className="text-slate-200">Quantity</FormLabel>
              <FormControl><Input type="number" placeholder="Enter quantity" {...field} className="bg-black/30 border-white/20 text-white placeholder:text-slate-400" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">Submit Transfer Request</Button>
      </form>
    </Form>
  );
};