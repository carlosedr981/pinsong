import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Check, Loader2, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type Employee = { id: string; full_name: string; email: string | null };
type Environment = { id: string; name: string };

export default function EmployeeEnvironments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: isAdmin } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) { navigate("/", { replace: true }); return; }

      const [{ data: emp }, { data: env }, { data: links }] = await Promise.all([
        db.from("profiles").select("id, full_name, email").order("full_name"),
        db.from("environments").select("id, name").order("name"),
        db.from("employee_environments").select("user_id, environment_id"),
      ]);
      setEmployees(emp || []);
      setEnvironments(env || []);
      const map: Record<string, string[]> = {};
      (links || []).forEach((link: any) => {
        map[link.user_id] = [...(map[link.user_id] || []), link.environment_id];
      });
      setAssignments(map);
      if (emp?.[0]) setSelectedEmployee(emp[0].id);
      setLoading(false);
    };
    load();
  }, [user, navigate]);

  const filteredEmployees = useMemo(() => employees.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase())
  ), [employees, search]);

  const selected = employees.find((e) => e.id === selectedEmployee);
  const selectedAssignments = assignments[selectedEmployee] || [];

  const toggleEnvironment = (environmentId: string) => {
    setAssignments((prev) => {
      const current = prev[selectedEmployee] || [];
      const next = current.includes(environmentId) ? current.filter((id) => id !== environmentId) : [...current, environmentId];
      return { ...prev, [selectedEmployee]: next };
    });
  };

  const save = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      const original = assignments[selectedEmployee] || [];
      const { data: current } = await db.from("employee_environments").select("environment_id").eq("user_id", selectedEmployee);
      const currentIds = (current || []).map((r: any) => r.environment_id);
      const target = [...new Set(original)];
      const add = target.filter((id) => !currentIds.includes(id));
      const remove = currentIds.filter((id: string) => !target.includes(id));
      if (remove.length) await db.from("employee_environments").delete().eq("user_id", selectedEmployee).in("environment_id", remove);
      if (add.length) await db.from("employee_environments").insert(add.map((environment_id) => ({ user_id: selectedEmployee, environment_id })));
      const active = target[0] || null;
      await db.from("profiles").update({ environment_id: active, active_environment_id: active }).eq("id", selectedEmployee);
      toast({ title: "Ambientes atualizados", description: `${selected?.full_name} agora possui ${target.length} ambiente(s) disponível(is).` });
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao salvar", description: error?.message || "Não foi possível atualizar os ambientes." });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero p-4 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-primary-foreground"><ArrowLeft /></Button>
          <div><h1 className="text-xl font-bold text-primary-foreground">Ambientes dos Funcionários</h1><p className="text-sm text-primary-foreground/80">Defina vários ambientes para cada funcionário.</p></div>
        </div>
      </div>
      <div className="p-4 max-w-5xl mx-auto grid md:grid-cols-[280px_1fr] gap-4">
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="text-base">Funcionários</CardTitle><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} /></CardHeader>
          <CardContent className="space-y-1 max-h-[65vh] overflow-y-auto">
            {filteredEmployees.map((employee) => <button key={employee.id} onClick={() => setSelectedEmployee(employee.id)} className={`w-full text-left p-3 rounded-lg transition-colors ${selectedEmployee === employee.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}><div className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="font-medium truncate">{employee.full_name}</span></div><p className="text-xs text-muted-foreground truncate mt-1">{employee.email || "Sem email"}</p><Badge variant="secondary" className="mt-2 text-[10px]">{(assignments[employee.id] || []).length} ambiente(s)</Badge></button>)}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="text-base">{selected?.full_name || "Selecione um funcionário"}</CardTitle><p className="text-sm text-muted-foreground">Marque os ambientes onde ele pode registrar ponto.</p></CardHeader>
          <CardContent className="space-y-2">
            {environments.map((env) => { const checked = selectedAssignments.includes(env.id); return <button type="button" key={env.id} onClick={() => toggleEnvironment(env.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}><span className={`h-6 w-6 rounded-md border flex items-center justify-center ${checked ? "bg-primary text-primary-foreground border-primary" : ""}`}>{checked && <Check className="h-4 w-4" />}</span><Building2 className="h-4 w-4 text-muted-foreground" /><span className="font-medium flex-1">{env.name}</span>{checked && <Badge>Ativo</Badge>}</button>; })}
            <div className="pt-4 flex justify-end"><Button onClick={save} disabled={!selectedEmployee || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar ambientes</Button></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
