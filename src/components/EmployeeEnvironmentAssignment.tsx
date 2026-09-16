import { useEffect, useState } from "react";
import { Building2, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Environment {
  id: string;
  name: string;
}

interface EmployeeEnvironmentAssignmentProps {
  employeeId: string;
}

const db = supabase as any;

export function EmployeeEnvironmentAssignment({ employeeId }: EmployeeEnvironmentAssignmentProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironmentIds, setSelectedEnvironmentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user || !employeeId) {
        setLoading(false);
        return;
      }

      const { data: globalRole, error: roleError } = await db
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .is("environment_id", null)
        .maybeSingle();

      if (roleError || !globalRole) {
        setLoading(false);
        return;
      }

      setIsGlobalAdmin(true);

      const [{ data: environmentData, error: environmentError }, { data: assignments, error: assignmentsError }] = await Promise.all([
        db.from("environments").select("id, name").order("name"),
        db.from("employee_environments").select("environment_id").eq("user_id", employeeId),
      ]);

      if (environmentError || assignmentsError) {
        console.error("Error loading employee environments:", environmentError || assignmentsError);
        toast({
          variant: "destructive",
          title: "Erro ao carregar ambientes",
          description: "Não foi possível carregar os ambientes do funcionário.",
        });
      } else {
        setEnvironments(environmentData || []);
        setSelectedEnvironmentIds((assignments || []).map((assignment: { environment_id: string }) => assignment.environment_id));
      }

      setLoading(false);
    };

    load();
  }, [user, employeeId, toast]);

  const toggleEnvironment = (environmentId: string) => {
    setSelectedEnvironmentIds((current) =>
      current.includes(environmentId)
        ? current.filter((id) => id !== environmentId)
        : [...current, environmentId]
    );
  };

  const save = async () => {
    if (!employeeId || !isGlobalAdmin) return;

    setSaving(true);
    try {
      const targetIds = [...new Set(selectedEnvironmentIds)];
      const { data: currentAssignments, error: currentError } = await db
        .from("employee_environments")
        .select("environment_id")
        .eq("user_id", employeeId);

      if (currentError) throw currentError;

      const currentIds = (currentAssignments || []).map((assignment: { environment_id: string }) => assignment.environment_id);
      const toAdd = targetIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id: string) => !targetIds.includes(id));

      if (toRemove.length > 0) {
        const { error } = await db
          .from("employee_environments")
          .delete()
          .eq("user_id", employeeId)
          .in("environment_id", toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await db
          .from("employee_environments")
          .insert(toAdd.map((environment_id) => ({ user_id: employeeId, environment_id })));
        if (error) throw error;
      }

      const activeEnvironmentId = targetIds[0] || null;
      const { error: profileError } = await db
        .from("profiles")
        .update({ environment_id: activeEnvironmentId, active_environment_id: activeEnvironmentId })
        .eq("id", employeeId);

      if (profileError) throw profileError;

      toast({
        title: "Ambientes atualizados",
        description: `${targetIds.length} ambiente(s) definido(s) para o funcionário.`,
      });
    } catch (error: any) {
      console.error("Error saving employee environments:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar ambientes",
        description: error?.message || "Não foi possível atualizar os ambientes.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !isGlobalAdmin) return null;

  return (
    <div className="border-t pt-4 mt-2 space-y-3">
      <div>
        <p className="text-sm font-medium">Ambientes</p>
        <p className="text-xs text-muted-foreground mt-1">
          O funcionário pode ter acesso a mais de um ambiente para registrar ponto.
        </p>
      </div>

      <div className="space-y-2">
        {environments.map((environment) => {
          const checked = selectedEnvironmentIds.includes(environment.id);
          return (
            <button
              key={environment.id}
              type="button"
              onClick={() => toggleEnvironment(environment.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
              }`}
            >
              <span className={`h-6 w-6 rounded-md border flex items-center justify-center shrink-0 ${checked ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                {checked && <Check className="h-4 w-4" />}
              </span>
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium flex-1 truncate">{environment.name}</span>
              {checked && <Badge variant="secondary">Ativo</Badge>}
            </button>
          );
        })}

        {environments.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">Nenhum ambiente cadastrado.</p>
        )}
      </div>

      <Button type="button" variant="outline" onClick={save} disabled={saving} className="w-full">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar ambientes
      </Button>
    </div>
  );
}
