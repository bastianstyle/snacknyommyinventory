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
} from 'recharts';
import { IncomingItem } from "./IncomingItems";
import { OutgoingItemDoc } from "./OutgoingItems";

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
  branchId: string;
  quantity: number;
}

interface RecentInventoryItem {
  id: string;
  itemName: string;
  branchName: string;
  totalQuantity: number;
}

interface LowStockItem extends RecentInventoryItem {
  sku: string;
}

const Index = () => {
  const { user, role, userBranchId } = useAuth();
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

  const dashboardTitle = useMemo(() => {
    if (role === 'admin') {
      return "Dasbor admin - Toko Snack Nyommy";
    }
    if (role === 'manager' && userBranchId) {
      const branchName = branchesMap.get(userBranchId) || "";
      return `Dasbor Manager - Toko Snack Nyommy ${branchName}`;
    }
    return "Dasbor Manager - Toko Snack Nyommy";
  }, [role, userBranchId, branchesMap]);

  // Identify Branch IDs for Bandung and Pontianak
  const bandungBranch = useMemo(() => branches.find(b => b.name.toLowerCase().includes('bandung')), [branches]);
  const pontianakBranch = useMemo(() => branches.find(b => b.name.toLowerCase().includes('pontianak')), [branches]);

  useEffect(() => {
    document.title = `Snack Nyommy - Inventory System - ${dashboardTitle}`;
    if (dataLoading) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const isBranchScoped = role === 'manager' && !!userBranchId;

        // Total Produk (katalog varian) selalu global - katalog item bersifat sama di semua cabang.
        const itemsCountQuery = getCountFromServer(collection(db, "items"));

        // Barang Masuk/Keluar: Admin melihat total seluruh cabang, Manager hanya cabangnya sendiri.
        const incomingCountQuery = isBranchScoped
          ? getCountFromServer(query(collection(db, "incoming_items"), where("branchId", "==", userBranchId)))
          : getCountFromServer(collection(db, "incoming_items"));
        const outgoingCountQuery = isBranchScoped
          ? getCountFromServer(query(collection(db, "outgoing_items"), where("branchId", "==", userBranchId)))
          : getCountFromServer(collection(db, "outgoing_items"));

        const incomingQuery = isBranchScoped
          ? query(collection(db, "incoming_items"), where("branchId", "==", userBranchId), orderBy("createdAt", "desc"), limit(50))
          : query(collection(db, "incoming_items"), orderBy("createdAt", "desc"), limit(50));
        const outgoingQuery = isBranchScoped
          ? query(collection(db, "outgoing_items"), where("branchId", "==", userBranchId), orderBy("createdAt", "desc"), limit(50))
          : query(collection(db, "outgoing_items"), orderBy("createdAt", "desc"), limit(50));

        // Inventaris tetap diambil global (dibutuhkan untuk grafik perbandingan Admin serta
        // fitur "Cek Cabang Lain"); Manager tetap hanya melihat bagian cabangnya lewat filter di bawah.
        const inventoryQuery = query(collection(db, "inventory"));

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
          getDocs(incomingQuery),
          getDocs(outgoingQuery),
          getDocs(inventoryQuery),
        ]);

        // Store all inventory for chart processing
        const inventoryData = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryDoc[];
        setAllInventory(inventoryData);

        // Calculate low stock manually
        const lowStockList: LowStockItem[] = [];
        inventoryData.forEach(inv => {
          if (role === 'manager' && userBranchId && inv.branchId !== userBranchId) return;
          
          const totalQty = (inv.entries || []).reduce((sum, e) => sum + e.quantity, 0);
          if (totalQty < 100) {
            lowStockList.push({
              id: inv.id,
              itemName: itemsMap.get(inv.itemId)?.name || "Item Tidak Dikenal",
              branchName: branchesMap.get(inv.branchId) || "Cabang Tidak Dikenal",
              totalQuantity: totalQty,
              sku: itemsMap.get(inv.itemId)?.sku || "N/A"
            });
          }
        });

        setStats({
          totalItems: itemsCountSnap.data().count,
          lowStockAlerts: lowStockList.length,
          totalIncoming: incomingCountSnap.data().count,
          totalOutgoing: outgoingCountSnap.data().count,
        });

        // Process Recent Activities
        const processActivities = (snapshot: any, type: 'in' | 'out') => 
          snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              type,
              date: data.createdAt.toDate(),
              itemName: itemsMap.get(data.itemId)?.name || "Item Tidak Dikenal",
              branchName: branchesMap.get(data.branchId) || "Tidak Dikenal",
              branchId: data.branchId,
              quantity: data.quantity,
            };
          });

        const combinedActivities = [...processActivities(incomingSnapshot, 'in'), ...processActivities(outgoingSnapshot, 'out')]
          .filter(act => role === 'admin' || (role === 'manager' && act.branchId === userBranchId))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 5);
        
        setRecentActivities(combinedActivities);

        // Process Recent Inventory
        const processedInventory = inventoryData
          .filter(data => role === 'admin' || (role === 'manager' && data.branchId === userBranchId))
          .slice(0, 5)
          .map(data => {
            const totalQuantity = (data.entries || []).reduce((sum, entry) => sum + entry.quantity, 0);
            return {
              id: data.id,
              itemName: itemsMap.get(data.itemId)?.name || "Item Tidak Dikenal",
              branchName: branchesMap.get(data.branchId) || "Cabang Tidak Dikenal",
              totalQuantity: totalQuantity,
            };
          });
        setRecentInventory(processedInventory);

      } catch (error: any) {
        console.error("CRITICAL: Error fetching dashboard data:", error);
        if (error.message && error.message.includes("index")) {
          toast.error("Database membutuhkan index baru. Silakan cek konsol browser untuk link aktivasi.");
        } else {
          toast.error(`Gagal memuat data: ${error.message || "Unknown error"}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [dataLoading, branchesMap, itemsMap, role, userBranchId, dashboardTitle]);

  // Process data for charts
  // Manager: hanya stok cabangnya sendiri (satu seri). Admin: perbandingan Bandung vs Pontianak.
  const chartData = useMemo(() => {
    if (allInventory.length === 0) return [];

    if (role === 'manager' && userBranchId) {
      const itemTotals = new Map<string, number>();

      allInventory
        .filter(inv => inv.branchId === userBranchId)
        .forEach(inv => {
          const itemName = itemsMap.get(inv.itemId)?.name || "Tidak Diketahui";
          const totalQty = (inv.entries || []).reduce((sum, e) => sum + e.quantity, 0);
          itemTotals.set(itemName, (itemTotals.get(itemName) || 0) + totalQty);
        });

      return Array.from(itemTotals.entries())
        .map(([name, qty]) => ({
          name: name.length > 15 ? name.substring(0, 12) + '...' : name,
          stok: qty,
        }))
        .filter(d => d.stok > 0)
        .sort((a, b) => b.stok - a.stok)
        .slice(0, 5);
    }

    const itemTotals = new Map<string, { bandung: number, pontianak: number }>();

    allInventory.forEach(inv => {
      const itemName = itemsMap.get(inv.itemId)?.name || "Tidak Diketahui";
      const totalQty = (inv.entries || []).reduce((sum, e) => sum + e.quantity, 0);

      const current = itemTotals.get(itemName) || { bandung: 0, pontianak: 0 };
      if (bandungBranch && inv.branchId === bandungBranch.id) current.bandung += totalQty;
      if (pontianakBranch && inv.branchId === pontianakBranch.id) current.pontianak += totalQty;

      itemTotals.set(itemName, current);
    });

    return Array.from(itemTotals.entries())
      .map(([name, totals]) => ({
        name: name.length > 15 ? name.substring(0, 12) + '...' : name,
        Bandung: totals.bandung,
        Pontianak: totals.pontianak
      }))
      .filter(d => d.Bandung > 0 || d.Pontianak > 0)
      .sort((a, b) => (b.Bandung + b.Pontianak) - (a.Bandung + a.Pontianak))
      .slice(0, 5);
  }, [allInventory, bandungBranch, pontianakBranch, itemsMap, role, userBranchId]);

  const renderStat = (value: number) => {
    if (loading || dataLoading) return <Skeleton className="h-8 w-12 bg-white/20" />;
    return <div className="text-2xl font-bold">{value}</div>;
  };
  
  const GlassCard = ({ children, className, ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
    <Card className={`bg-black/20 backdrop-blur-lg border border-white/10 text-white ${className}`} {...props}>
      {children}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{dashboardTitle}</h1>
          <p className="text-slate-300">
            {role === 'admin' 
              ? "Monitoring real-time stok Bandung & Pontianak" 
              : `Monitoring real-time stok ${branchesMap.get(userBranchId || "") || ""}`}
          </p>
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
        <GlassCard asChild className="cursor-pointer hover:bg-white/5 transition-colors group">
          <Link to="/critical-stock">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">Stok Kritis</CardTitle>
              <Bell className="h-4 w-4 text-red-400 animate-pulse" />
            </CardHeader>
            <CardContent>
              {renderStat(stats.lowStockAlerts)}
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Perlu segera diisi ulang</p>
            </CardContent>
          </Link>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>
                  {role === 'manager'
                    ? `Stok Tertinggi: ${branchesMap.get(userBranchId || "") || "Cabang Anda"}`
                    : "Perbandingan Stok: Bandung & Pontianak"}
                </CardTitle>
                <CardDescription className="text-slate-300">
                  {role === 'manager'
                    ? "Visualisasi 5 snack dengan stok tertinggi di cabang Anda."
                    : "Visualisasi 5 snack dengan pergerakan stok tertinggi antar cabang."}
                </CardDescription>
              </div>
              <div className="flex space-x-2 text-xs">
                {role === 'manager' ? (
                  <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded-sm mr-1"></div> {branchesMap.get(userBranchId || "") || "Cabang Anda"}</div>
                ) : (
                  <>
                    <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded-sm mr-1"></div> Bandung</div>
                    <div className="flex items-center"><div className="w-3 h-3 bg-emerald-500 rounded-sm mr-1"></div> Pontianak</div>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] w-full mt-4">
            {loading ? (
              <Skeleton className="h-full w-full bg-white/5" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  {role === 'manager' ? (
                    <Bar dataKey="stok" name={branchesMap.get(userBranchId || "") || "Cabang Anda"} fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25} />
                  ) : (
                    <>
                      <Bar dataKey="Bandung" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25} />
                      <Bar dataKey="Pontianak" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Building2 className="h-10 w-10 mb-2 opacity-20" />
                <p>Data tidak tersedia.</p>
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
            {stats.lowStockAlerts > 0 && (
              <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm">
                <div className="flex items-center font-bold mb-1">
                  <Bell className="h-4 w-4 mr-2" />
                  Peringatan Stok {role === 'admin' ? 'Global' : (branchesMap.get(userBranchId || "") || "Cabang")}
                </div>
                Terdapat {stats.lowStockAlerts} produk dengan stok di bawah 100 unit yang perlu perhatian Anda.
              </div>
            )}
            <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-200 text-sm">
              <div className="flex items-center font-bold mb-1">
                <TrendingUp className="h-4 w-4 mr-2" />
                Info Sistem
              </div>
              Seluruh data tersinkronisasi otomatis menggunakan Firestore Real-time untuk {role === 'admin' ? 'seluruh cabang' : 'cabang Anda'}.
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </div>
  );
};

export default Index;
