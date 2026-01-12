import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Clock, Mail, Lock, User, Loader2, Building2 } from "lucide-react";
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
  environmentSlug: z.string().min(1, "Código do ambiente é obrigatório"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [environmentSlug, setEnvironmentSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const validate = () => {
    try {
      if (isLogin) {
        loginSchema.parse({ email, password, environmentSlug });
      } else {
        signupSchema.parse({ email, password, fullName, environmentSlug });
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            newErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const verifyEnvironment = async (): Promise<string | null> => {
    const slug = environmentSlug.toLowerCase().trim();
    
    if (!slug) {
      setErrors((prev) => ({ ...prev, environmentSlug: "Código do ambiente é obrigatório" }));
      return "not_found";
    }
    
    const { data, error } = await supabase
      .from("environments")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    
    if (error || !data) {
      setErrors((prev) => ({ ...prev, environmentSlug: "Ambiente não encontrado" }));
      toast({
        variant: "destructive",
        title: "Ambiente não encontrado",
        description: "O código do ambiente informado não existe. Verifique com sua empresa.",
      });
      return "not_found";
    }
    
    return data.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    
    try {
      // Verify environment if provided
      const envId = await verifyEnvironment();
      if (envId === "not_found") {
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              variant: "destructive",
              title: "Erro no login",
              description: "Email ou senha incorretos.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Erro no login",
              description: error.message,
            });
          }
        } else if (envId) {
          // Update user's environment after login
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            await supabase
              .from("profiles")
              .update({ environment_id: envId })
              .eq("id", currentUser.id);
          }
        }
      } else {
        const { error, data } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              variant: "destructive",
              title: "Erro no cadastro",
              description: "Este email já está cadastrado.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Erro no cadastro",
              description: error.message,
            });
          }
        } else {
          // If signup successful and environment provided, update profile
          if (envId && data?.user) {
            // Wait a bit for the profile to be created by the trigger
            setTimeout(async () => {
              await supabase
                .from("profiles")
                .update({ environment_id: envId })
                .eq("id", data.user!.id);
            }, 1000);
          }
          
          toast({
            title: "Conta criada!",
            description: "Você já pode fazer login.",
          });
          setIsLogin(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="gradient-hero p-6 pt-12 pb-16 rounded-b-[2rem]">
        <div className="flex items-center gap-3 justify-center">
          <div className="h-12 w-12 rounded-xl bg-background/20 flex items-center justify-center">
            <Clock className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-foreground">Ponto Eletrônico</h1>
            <p className="text-primary-foreground/80 text-sm">Sistema de Registro</p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="flex-1 px-4 -mt-8">
        <Card className="max-w-md mx-auto shadow-xl border-0 animate-slide-up">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isLogin ? "Bem-vindo de volta" : "Criar conta"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Entre com suas credenciais para acessar"
                : "Preencha os dados para criar sua conta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-xs text-destructive">{errors.fullName}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment">Código do Ambiente (Empresa) *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="environment"
                    placeholder="Ex: empresa-abc"
                    value={environmentSlug}
                    onChange={(e) => setEnvironmentSlug(e.target.value.toLowerCase())}
                    className="pl-10"
                    disabled={loading}
                    required
                  />
                </div>
                {errors.environmentSlug && (
                  <p className="text-xs text-destructive">{errors.environmentSlug}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Informe o código fornecido pela sua empresa
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLogin ? (
                  "Entrar"
                ) : (
                  "Criar Conta"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-sm text-primary hover:underline"
                disabled={loading}
              >
                {isLogin
                  ? "Não tem conta? Cadastre-se"
                  : "Já tem conta? Faça login"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
