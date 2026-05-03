import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Bell, ArrowRight, ArrowDownCircle, ArrowUpCircle, Building2, TrendingUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit, getCountFromServer } from "firebase/firestore";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { InventoryDoc } from "./Inventory";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { IncomingItem } from "./IncomingItems";
import { OutgoingItemDoc } from "./OutgoingItems";
import { addDoc } from "firebase/firestore";

// --- SEED DATA FUNCTION (TEMPORARY) ---
const seedInitialData = async () => {
  try {
    // 1. Seed Items
    const itemsRef = collection(db, "items");
    const itemsSnap = await getDocs(query(itemsRef, limit(1)));
    if (itemsSnap.empty) {
      const sampleItems = [
        { name: "Basreng Pedas Daun Jeruk", sku: "BSG-001", category: "Keripik", unit: "Pcs" },
        { name: "Makaroni Bantet", sku: "MKR-001", category: "Makaroni", unit: "Pcs" },
        { name: "Kripik Kaca Extra Pedas", sku: "KPK-001", category: "Keripik", unit: "Pcs" },
        { name: "Soes Coklat Lumer", sku: "SOE-001", category: "Kue Kering", unit: "Pcs" },
        { name: "Pangsit Goreng Original", sku: "PST-001", category: "Snack Gurih", unit: "Pcs" }
      ];
      for (const item of sampleItems) {
        await addDoc(itemsRef, item);
      }
      console.log("Sample items seeded!");
    }

    // 2. Seed Branches
    const branchesRef = collection(db, "branches");
    const branchesSnap = await getDocs(query(branchesRef, limit(1)));
    if (branchesSnap.empty) {
      const sampleBranches = [
        { name: "Bandung", location: "Jawa Barat", contact: "08123456789" },
        { name: "Pontianak", location: "Kalimantan Barat", contact: "08987654321" }
      ];
      for (const branch of sampleBranches) {
        await addDoc(branchesRef, branch);
      }
      console.log("Sample branches seeded!");
      window.location.reload(); // Reload to refresh DataContext
    }
  } catch (e) {
    console.error("Seeding failed:", e);
  }
};
// ---------------------------------------

interface DashboardStats {
  totalItems: number;
  lowStockAlerts: number;
  totalIncoming: number;
  totalOutgoing: number;
}

interface RecentActivity {
  id: string;
  type: 'in' | 'out';
  date: Date;
  itemName: string;
  branchName: string;
  quantity: number;
}

interface RecentInventoryItem {
  id: string;
  itemName: string;
  branchName: string;
  totalQuantity: number;
}

interface ChartData {
  name: string;
  Bandung: number;
  Pontianak: number;
}

const Index = () => {
  const { user } = useAuth();
  const { branches, branchesMap, itemsMap, loading: dataLoading } = useData();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockAlerts: 0,
    totalIncoming: 0,
    totalOutgoing: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [recentInventory, setRecentInventory] = useState<RecentInventoryItem[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Identify Branch IDs for Bandung and Pontianak
  const bandungBranch = useMemo(() => branches.find(b => b.name.toLowerCase().includes('bandung')), [branches]);
  const pontianakBranch = useMemo(() => branches.find(b => b.name.toLowerCase().includes('pontianak')), [branches]);

  useEffect(() => {
    document.title = "Snack Nyommy - Inventory System - Dasbor Owner";
    seedInitialData();
    if (dataLoading) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Stats Queries
        const itemsCountQuery = getCountFromServer(collection(db, "items"));
        const incomingCountQuery = getCountFromServer(collection(db, "incoming_items"));
        const outgoingCountQuery = getCountFromServer(collection(db, "outgoing_items"));

        // Data for cards and charts
        const incomingQuery = getDocs(query(collection(db, "incoming_items"), orderBy("createdAt", "desc"), limit(5)));
        const outgoingQuery = getDocs(query(collection(db, "outgoing_items"), orderBy("createdAt", "desc"), limit(5)));
        const inventoryQuery = getDocs(collection(db, "inventory"));

        const [
          itemsCountSnap,
          incomingCountSnap,
          outgoingCountSnap,
          incomingSnapshot,
          outgoingSnapshot,
          inventorySnapshot,
        ] = await Promise.all([
          itemsCountQuery,
          incomingCountQuery,
          outgoingCountQuery,
          incomingQuery,
          outgoingQuery,
          inventoryQuery,
        ]);

        // Store all inventory for chart processing
        const inventoryData = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryDoc[];
        setAllInventory(inventoryData);

        // Calculate low stock manually since it's nested in entries
        const lowStockCount = inventoryData.filter(inv => {
          const totalQty = (inv.entries || []).reduce((sum, e) => sum + e.quantity, 0);
          return totalQty < 10;
        }).length;

        setStats({
          totalItems: itemsCountSnap.data().count,
          lowStockAlerts: lowStockCount,
          totalIncoming: incomingCountSnap.data().count,
          totalOutgoing: outgoingCountSnap.data().count,
        });

        // Process Recent Activities
        const incomingActivities: RecentActivity[] = incomingSnapshot.docs.map(doc => {
          const data = doc.data() as IncomingItem;
          return {
            id: doc.id,
            type: 'in',
            date: data.createdAt.toDate(),
            itemName: itemsMap.get(data.itemId)?.name || "Item Tidak Dikenal",
            branchName: branchesMap.get(data.branchId) || "Tidak Dikenal",
            quantity: data.quantity,
          };
        });

        const outgoingActivities: RecentActivity[] = outgoingSnapshot.docs.map(doc => {
          const data = doc.data() as OutgoingItemDoc;
          return {
            id: doc.id,
            type: 'out',
            date: data.createdAt.toDate(),
            itemName: itemsMap.get(data.itemId)?.name || "Item Tidak Dikenal",
            branchName: branchesMap.get(data.branchId) || "Tidak Dikenal",
            quantity: data.quantity,
          };
        });

        const combinedActivities = [...incomingActivities, ...outgoingActivities]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 5);
        
        setRecentActivities(combinedActivities);

        // Process Recent Inventory
        const processedInventory = inventoryData.slice(0, 5).map(data => {
          const totalQuantity = (data.entries || []).reduce((sum, entry) => sum + entry.quantity, 0);
          return {
            id: data.id,
            itemName: itemsMap.get(data.itemId)?.name || "Item Tidak Dikenal",
            branchName: branchesMap.get(data.branchId) || "Cabang Tidak Dikenal",
            totalQuantity: totalQuantity,
          };
        });
        setRecentInventory(processedInventory);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Tidak dapat memuat data dasbor.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [dataLoading, branchesMap, itemsMap]);

  // Process data for Branch Comparison Chart
  const comparisonChartData = useMemo(() => {
    if (!bandungBranch || !pontianakBranch || allInventory.length === 0) return [];

    const itemTotals = new Map<string, { bandung: number, pontianak: number }>();

    allInventory.forEach(inv => {
      const itemName = itemsMap.get(inv.itemId)?.name || "Unknown";
      const totalQty = (inv.entries || []).reduce((sum, e) => sum + e.quantity, 0);
      
      const current = itemTotals.get(itemName) || { bandung: 0, pontianak: 0 };
      if (inv.branchId === bandungBranch.id) current.bandung += totalQty;
      if (inv.branchId === pontianakBranch.id) current.pontianak += totalQty;
      
      itemTotals.set(itemName, current);
    });

    // Take top 5 items for visual clarity
    return Array.from(itemTotals.entries())
      .map(([name, totals]) => ({
        name: name.length > 15 ? name.substring(0, 12) + '...' : name,
        Bandung: totals.bandung,
        Pontianak: totals.pontianak
      }))
      .filter(d => d.Bandung > 0 || d.Pontianak > 0)
      .slice(0, 5);
  }, [allInventory, bandungBranch, pontianakBranch, itemsMap]);

  const renderStat = (value: number) => {
    if (loading || dataLoading) return <Skeleton className="h-8 w-12 bg-white/20" />;
    return <div className="text-2xl font-bold">{value}</div>;
  };
  
  const GlassCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <Card className={`bg-black/20 backdrop-blur-lg border border-white/10 text-white ${className}`}>
      {children}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Dasbor Owner - Toko Snack Nyommy</h1>
          <p className="text-slate-300">Monitoring real-time stok Bandung & Pontianak</p>
        </div>
        <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/10">
          <TrendingUp className="text-green-400 h-5 w-5" />
          <span className="text-sm font-medium text-white">Status Sistem: Sinkron Terpusat</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-slate-300" />
          </CardHeader>
          <CardContent>
            {renderStat(stats.totalItems)}
            <p className="text-xs text-slate-400">Varian snack tersedia</p>
          </CardContent>
        </GlassCard>
        <GlassCard>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Barang Masuk</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            {renderStat(stats.totalIncoming)}
            <p className="text-xs text-slate-400">Restock periode ini</p>
          </CardContent>
        </GlassCard>
        <GlassCard>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Barang Keluar</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            {renderStat(stats.totalOutgoing)}
            <p className="text-xs text-slate-400">Total item terjual/keluar</p>
          </CardContent>
        </GlassCard>
        <GlassCard>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Stok Kritis</CardTitle>
            <Bell className="h-4 w-4 text-red-400 animate-pulse" />
          </CardHeader>
          <CardContent>
            {renderStat(stats.lowStockAlerts)}
            <p className="text-xs text-slate-400">Perlu segera diisi ulang</p>
          </CardContent>
        </GlassCard>
      </div>

      {/* Branch Comparison Visual */}
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Perbandingan Stok: Bandung vs Pontianak</CardTitle>
                <CardDescription className="text-slate-300">Visualisasi 5 snack dengan pergerakan stok tertinggi.</CardDescription>
              </div>
              <div className="flex space-x-2 text-xs">
                <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded-sm mr-1"></div> Bandung</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-emerald-500 rounded-sm mr-1"></div> Pontianak</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] w-full mt-4">
            {loading ? (
              <Skeleton className="h-full w-full bg-white/5" />
            ) : comparisonChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="Bandung" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25} />
                  <Bar dataKey="Pontianak" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Building2 className="h-10 w-10 mb-2 opacity-20" />
                <p>Data perbandingan tidak tersedia.</p>
              </div>
            )}
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader>
            <CardTitle>Aktivitas Inventaris</CardTitle>
            <CardDescription className="text-slate-300">Log masuk/keluar terbaru.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full bg-white/5" />
                <Skeleton className="h-12 w-full bg-white/5" />
                <Skeleton className="h-12 w-full bg-white/5" />
              </div>
            ) : recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${act.type === 'in' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {act.type === 'in' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{act.itemName}</p>
                        <p className="text-xs text-slate-400">{act.branchName} • {act.quantity} pcs</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-slate-300">
                      {act.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Tidak ada aktivitas.</p>
            )}
          </CardContent>
        </GlassCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <GlassCard>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Stok Terkini</CardTitle>
              <CardDescription className="text-slate-300">Ringkasan cepat inventaris cabang.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-white/5">
              <Link to="/inventory">
                Detail <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full bg-white/5" />
            ) : recentInventory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-400">Item</TableHead>
                    <TableHead className="text-slate-400">Cabang</TableHead>
                    <TableHead className="text-right text-slate-400">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInventory.map((item) => (
                    <TableRow key={item.id} className="border-white/5">
                      <TableCell className="font-medium text-slate-200 py-3">{item.itemName}</TableCell>
                      <TableCell className="text-slate-400 py-3">{item.branchName}</TableCell>
                      <TableCell className="text-right font-bold text-white py-3">{item.totalQuantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Data tidak ditemukan.</p>
            )}
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader>
            <CardTitle>Notifikasi Penting</CardTitle>
            <CardDescription className="text-slate-300">Pemberitahuan sistem & operasional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm">
              <div className="flex items-center font-bold mb-1">
                <Bell className="h-4 w-4 mr-2" />
                Peringatan Stok Bandung
              </div>
              Terdapat {stats.lowStockAlerts} produk dengan stok di bawah 10 unit di cabang Bandung.
            </div>
            <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-200 text-sm">
              <div className="flex items-center font-bold mb-1">
                <TrendingUp className="h-4 w-4 mr-2" />
                Info Sistem
              </div>
              Seluruh data tersinkronisasi otomatis menggunakan Firestore Real-time.
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </div>
  );
};

export default Index;