import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Branch } from '@/pages/Branches';
import { Item } from '@/pages/Items';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface DataContextValue {
  branches: Branch[];
  items: Item[];
  branchesMap: Map<string, string>;
  itemsMap: Map<string, Item>;
  loading: boolean;
  error: Error | null;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setBranches([]);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log("Setting up real-time data listeners...");

    // Listen to branches
    const unsubscribeBranches = onSnapshot(
      collection(db, "branches"),
      (snapshot) => {
        const fetchedBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Branch[];
        setBranches(fetchedBranches);
        if (loading) setLoading(false);
      },
      (err) => {
        console.error("Failed to fetch branches:", err);
        setError(err as Error);
        toast.error("Gagal memuat data cabang.");
      }
    );

    // Listen to items
    const unsubscribeItems = onSnapshot(
      collection(db, "items"),
      (snapshot) => {
        const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Item[];
        setItems(fetchedItems);
        if (loading) setLoading(false);
      },
      (err) => {
        console.error("Failed to fetch items:", err);
        setError(err as Error);
        toast.error("Gagal memuat data item.");
      }
    );

    return () => {
      unsubscribeBranches();
      unsubscribeItems();
    };
  }, [user]);

  const branchesMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
  const itemsMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const value = { branches, items, branchesMap, itemsMap, loading, error };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};