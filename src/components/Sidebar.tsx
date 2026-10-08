import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Package, Warehouse, ArrowRightLeft, LogOut, Home, Users, ArrowDownLeft, ArrowUpRight, Bell, Menu, X } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, or, and, onSnapshot } from "firebase/firestore";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navLinks = [
  { to: "/", icon: Home, label: "Dasbor" },
  { to: "/items", icon: Package, label: "Item" },
  { to: "/inventory", icon: Warehouse, label: "Inventaris" },
  { to: "/critical-stock", icon: Bell, label: "Stok Kritis", hasBadge: true },
  { to: "/incoming-items", icon: ArrowDownLeft, label: "Barang Masuk" },
  { to: "/outgoing-items", icon: ArrowUpRight, label: "Barang Keluar" },
  { to: "/transfers", icon: ArrowRightLeft, label: "Transfer", hasBadge: true },
];

const adminLinks = [
  { to: "/branches", icon: Building2, label: "Cabang" },
  { to: "/users", icon: Users, label: "Pengguna" },
]

const SidebarContent = ({ role, badges, handleLogout }: any) => (
  <div className="flex flex-col h-full">
    <div className="p-4 border-b border-white/10">
      <NavLink to="/" className="flex items-center gap-2">
        <Package className="h-6 w-6 text-white" />
        <h1 className="text-base font-semibold text-white">Snack Nyommy Inventory</h1>
      </NavLink>
    </div>
    <nav className="flex-1 p-4 space-y-1">
      {navLinks.map((link) => (
        <NavLink
          key={link.label}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            `flex items-center justify-between rounded-lg px-3 py-2 text-slate-300 transition-all hover:text-white hover:bg-white/10 ${
              isActive ? "bg-white/20 text-white font-semibold" : ""
            }`
          }
        >
          <div className="flex items-center gap-3">
            <link.icon className="h-4 w-4" />
            {link.label}
          </div>
          {link.hasBadge && badges[link.to] > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
              {badges[link.to]}
            </span>
          )}
        </NavLink>
      ))}
      {role === 'admin' && (
        <>
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase mt-4">
            Admin
          </div>
          {adminLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 transition-all hover:text-white hover:bg-white/10 ${
                  isActive ? "bg-white/20 text-white font-semibold" : ""
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </>
      )}
    </nav>
    <div className="p-4 mt-auto border-t border-white/10">
      <Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/10 hover:text-white" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Keluar
      </Button>
    </div>
  </div>
);

const Sidebar = () => {
  const navigate = useNavigate();
  const { role, user, userBranchId } = useAuth();
  const [transferCount, setTransferCount] = useState(0);
  const [criticalStockCount, setCriticalStockCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const transfersRef = collection(db, "transfers");
    let q;

    if (role === 'admin') {
      q = query(transfersRef, where("status", "in", ["pending", "shipped"]));
    } else if (role === 'manager' && userBranchId) {
      // Manager hanya boleh membaca transfer yang melibatkan cabangnya sendiri
      // (sesuai firestore.rules) - query global tanpa filter ini akan ditolak
      // server begitu ada transfer milik cabang lain di dalam koleksi.
      q = query(
        transfersRef,
        and(
          where("status", "in", ["pending", "shipped"]),
          or(where("fromBranchId", "==", userBranchId), where("toBranchId", "==", userBranchId))
        )
      );
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (role === 'admin') {
          count++;
        } else {
          if (data.status === 'pending' && data.fromBranchId === userBranchId) {
            count++;
          } else if (data.status === 'shipped' && data.toBranchId === userBranchId) {
            count++;
          }
        }
      });
      setTransferCount(count);
    }, (error) => {
      console.error("Error fetching transfer notifications: ", error);
    });

    return () => unsubscribe();
  }, [user, role, userBranchId]);

  useEffect(() => {
    if (!user) return;

    const inventoryRef = collection(db, "inventory");
    // Manager hanya menghitung stok kritis di cabangnya sendiri, Admin lintas cabang.
    const q = role === 'manager' && userBranchId
      ? query(inventoryRef, where("branchId", "==", userBranchId))
      : query(inventoryRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const totalQty = (data.entries || []).reduce((sum: number, e: { quantity: number }) => sum + e.quantity, 0);
        if (totalQty < 100) count++;
      });
      setCriticalStockCount(count);
    }, (error) => {
      console.error("Error fetching critical stock notifications: ", error);
    });

    return () => unsubscribe();
  }, [user, role, userBranchId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Berhasil Keluar", {
        description: "Anda telah berhasil keluar.",
      });
      navigate("/login");
    } catch (error) {
      toast.error("Gagal Keluar", {
        description: "Terjadi kesalahan saat keluar.",
      });
    }
  };

  const badges: Record<string, number> = {
    "/critical-stock": criticalStockCount,
    "/transfers": transferCount,
  };

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-white/10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-slate-900 border-r border-white/10 text-white">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigasi Menu</SheetTitle>
            </SheetHeader>
            <SidebarContent role={role} badges={badges} handleLogout={handleLogout} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-black/20 backdrop-blur-lg border-r border-white/10 flex-col hidden md:flex shrink-0">
        <SidebarContent role={role} badges={badges} handleLogout={handleLogout} />
      </aside>
    </>
  );
};

export default Sidebar;