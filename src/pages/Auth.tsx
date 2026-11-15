import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Clock, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      loginSchema.parse({ email, password });
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const next: Record<string, string> = {};
        error.errors.forEach((item) => { if (item.path[0]) next[item.path[0] as string] = item.message; });
        setErrors(next);
      }
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ variant: "destructive", title: "Erro no login", description: error.message.includes("Invalid login credentials") ? "Email ou senha incorretos." : error.message });
        return;
      }
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: profile } = await supabase.from("profiles").select("blocked").eq("id", currentUser.id).single();
        if (profile?.blocked) {
          toast({ variant: "destructive", title: "Acesso bloqueado", description: "Seu acesso foi bloqueado. Entre em contato com o administrador." });
          await supabase.auth.signOut();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="gradient-hero p-6 pt-12 pb-16 rounded-b-[2rem]">
        <div className="flex items-center gap-3 justify-center">
          <div className="h-12 w-12 rounded-xl bg-background/20 flex items-center justify-center"><Clock className="h-7 w-7 text-primary-foreground" /></div>
          <div><h1 className="text-2xl font-bold text-primary-foreground">Ponto Eletrônico</h1><p className="text-primary-foreground/80 text-sm">Sistema de Registro</p></div>
        </div>
      </div>
      <div className="flex-1 px-4 -mt-8">
        <Card className="max-w-md mx-auto shadow-xl border-0 animate-slide-up">
          <CardHeader className="text-center"><CardTitle className="text-xl">Bem-vindo de volta</CardTitle><CardDescription>Entre com suas credenciais para acessar</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" disabled={loading} /></div>{errors.email && <p className="text-xs text-destructive">{errors.email}</p>}</div>
              <div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="password" type="password" placeholder="••••••" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" disabled={loading} /></div>{errors.password && <p className="text-xs text-destructive">{errors.password}</p>}</div>
              <Button type="submit" className="w-full gradient-primary" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}</Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">Novos funcionários recebem acesso diretamente do administrador global.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
