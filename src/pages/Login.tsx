import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Mengganti useToast dengan sonner
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setMpassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // const { toast } = useToast(); // Dihapus, langsung pakai toast dari sonner
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    document.title = "Snack Nyommy - Inventory System - Login";
    if (!authLoading && user) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Masuk Berhasil", { // Menggunakan toast.success dari sonner
        description: "Selamat datang kembali!",
      });
    } catch (err: any) {
      toast.error("Masuk Gagal", { // Menggunakan toast.error dari sonner
        description: "Email atau kata sandi tidak valid.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-semibold text-white mb-6 text-center">Snack Nyommy Inventory</h1>
      <Card className="w-full max-w-sm bg-black/20 backdrop-blur-lg border border-white/10 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Masuk</CardTitle>
          <CardDescription className="text-slate-300">
            Masukkan email Anda di bawah ini untuk masuk ke akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="bg-black/30 border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-slate-200">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setMpassword(e.target.value)}
                disabled={loading}
                className="bg-black/30 border-white/20 text-white"
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white" disabled={loading}>
              {loading ? "Masuk..." : "Masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;