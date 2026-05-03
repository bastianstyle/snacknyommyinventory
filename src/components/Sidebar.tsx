import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Package, Warehouse, ArrowRightLeft, LogOut, Home, Users, BookOpenText, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const navLinks = [
  { to: "/", icon: Home, label: "Dasbor" },
  { to: "/branches", icon: Building2, label: "Cabang" },
  { to: "/items", icon: Package, label: "Item" },
  { to: "/inventory", icon: Warehouse, label: "Inventaris" },
  { to: "/incoming-items", icon: ArrowDownLeft, label: "Barang Masuk" },
  { to: "/outgoing-items", icon: ArrowUpRight, label: "Barang Keluar" },
  { to: "/transfers", icon: ArrowRightLeft, label: "Transfer", hasBadge: true },
  { to: "/tutorial", icon: BookOpenText, label: "Tutorial" },
];

const adminLinks = [
  { to: "/users", icon: Users, label: "Pengguna" },
]

const Sidebar = () => {
  const navigate = useNavigate();
  const { role, user, userBranchId } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Listener untuk notifikasi transfer
    const transfersRef = collection(db, "transfers");
    let q;

    if (role === 'admin') {
      // Admin melihat semua yang pending atau shipped
      q = query(transfersRef, where("status", "in", ["pending", "shipped"]));
    } else if (role === 'manager' && userBranchId) {
      // Manager melihat:
      // 1. Pending dari cabangnya (perlu approve)
      // 2. Shipped ke cabangnya (perlu receive)
      q = query(transfersRef, where("status", "in", ["pending", "shipped"]));
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
          // Filter logic for manager
          if (data.status === 'pending' && data.fromBranchId === userBranchId) {
            count++;
          } else if (data.status === 'shipped' && data.toBranchId === userBranchId) {
            count++;
          }
        }
      });
      setNotificationCount(count);
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

  return (
    <aside className="w-64 bg-black/20 backdrop-blur-lg border-r border-white/10 flex-col hidden md:flex">
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
            {link.hasBadge && notificationCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                {notificationCount}
              </span>
            )}
          </NavLink>
        ))}
        {role === 'admin' && (
          <>
            <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase">
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
    </aside>
  );
};

export default Sidebar;