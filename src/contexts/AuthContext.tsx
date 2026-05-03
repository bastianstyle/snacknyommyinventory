import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // Import db
import { doc, getDoc } from 'firebase/firestore'; // Import doc and getDoc
import { Skeleton } from '@/components/ui/skeleton';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: string | null;
  userBranchId: string | null; // Tambahkan userBranchId
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, role: null, userBranchId: null });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userBranchId, setUserBranchId] = useState<string | null>(null); // State untuk branchId

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUser(firebaseUser);
            setRole(userData.role as string || null);
            setUserBranchId(userData.branchId as string || null); // Simpan branchId
          } else {
            setUser(firebaseUser);
            setRole(null);
            setUserBranchId(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUser(firebaseUser);
          setRole(null);
          setUserBranchId(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setUserBranchId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center space-y-4">
                <h1 className="text-2xl font-bold">Loading Application...</h1>
                <div className="space-y-2">
                    <Skeleton className="h-8 w-[300px]" />
                    <Skeleton className="h-8 w-[250px]" />
                </div>
            </div>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading: false, role, userBranchId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);