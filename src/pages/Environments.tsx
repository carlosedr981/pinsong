import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Building2, ArrowLeft, Pencil, Trash2, Users, 
  Loader2, Search, ChevronDown 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Environment {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  employeeCount?: number;
  isOpen?: boolean;
}

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  avatar_url: string | null;
  environment_id: string | null;
}

export default function Environments() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [deletingEnv, setDeletingEnv] = useState<Environment | null>(null);
  const [envName, setEnvName] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedEnvId, setSelectedEnvId] = useState<string>("");
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }
      
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      
      if (!data) {
        navigate("/");
        return;
      }
      
      fetchData();
    };
    
    checkAdmin();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      // Fetch environments
      const { data: envData, error: envError } = await supabase
        .from("environments")
        .select("*")
        .order("name");

      if (envError) throw envError;

      // Fetch all employees
      const { data: empData, error: empError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, cpf, avatar_url, environment_id")
        .order("full_name");

      if (empError) throw empError;

      // Count employees per environment
      const envsWithCounts = (envData || []).map(env => ({
        ...env,
        employeeCount: (empData || []).filter(e => e.environment_id === env.id).length,
        isOpen: false,
      }));

      setEnvironments(envsWithCounts);
      setEmployees(empData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os ambientes.",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleSaveEnvironment = async () => {
    if (!envName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Digite um nome para o ambiente.",
      });
      return;
    }

    setSaving(true);
    
    try {
      const slug = generateSlug(envName);
      
      if (editingEnv) {
        const { error } = await supabase
          .from("environments")
          .update({ name: envName, slug })
          .eq("id", editingEnv.id);
        
        if (error) throw error;
        
        toast({
          title: "Ambiente atualizado!",
          description: "O ambiente foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("environments")
          .insert({ 
            name: envName, 
            slug,
            created_by: user?.id 
          });
        
        if (error) {
          if (error.message.includes("duplicate key")) {
            throw new Error("Já existe um ambiente com este nome.");
          }
          throw error;
        }
        
        toast({
          title: "Ambiente criado!",
          description: `O ambiente "${envName}" foi criado com sucesso.`,
        });
      }
      
      setDialogOpen(false);
      setEditingEnv(null);
      setEnvName("");
      fetchData();
    } catch (error: unknown) {
      console.error("Error saving environment:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar o ambiente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!deletingEnv) return;
    
    setSaving(true);
    
    try {
      // First, unassign all employees from this environment
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ environment_id: null })
        .eq("environment_id", deletingEnv.id);
      
      if (updateError) throw updateError;
      
      // Then delete the environment
      const { error } = await supabase
        .from("environments")
        .delete()
        .eq("id", deletingEnv.id);
      
      if (error) throw error;
      
      toast({
        title: "Ambiente excluído!",
        description: "O ambiente foi removido com sucesso.",
      });
      
      setDeleteDialogOpen(false);
      setDeletingEnv(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting environment:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Não foi possível excluir o ambiente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployee) return;
    
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ environment_id: selectedEnvId || null })
        .eq("id", selectedEmployee.id);
      
      if (error) throw error;
      
      toast({
        title: "Funcionário atualizado!",
        description: selectedEnvId 
          ? "Funcionário vinculado ao ambiente."
          : "Funcionário removido do ambiente.",
      });
      
      setAssignDialogOpen(false);
      setSelectedEmployee(null);
      setSelectedEnvId("");
      fetchData();
    } catch (error) {
      console.error("Error assigning employee:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o funcionário.",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnvironment = (envId: string) => {
    setEnvironments(prev =>
      prev.map(env =>
        env.id === envId ? { ...env, isOpen: !env.isOpen } : env
      )
    );
  };

  const getEnvironmentEmployees = (envId: string) => {
    return employees.filter(emp => emp.environment_id === envId);
  };

  const getUnassignedEmployees = () => {
    return employees.filter(emp => !emp.environment_id);
  };

  const filteredEnvironments = environments.filter(env =>
    env.name.toLowerCase().includes(search.toLowerCase()) ||
    env.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-hero p-4 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary-foreground">
              Gerenciar Ambientes
            </h1>
            <p className="text-primary-foreground/80 text-sm">
              {environments.length} ambiente{environments.length !== 1 ? "s" : ""} cadastrado{environments.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingEnv(null);
              setEnvName("");
              setDialogOpen(true);
            }}
            className="bg-background/20 hover:bg-background/30 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
          <Input
            placeholder="Buscar ambiente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background/20 border-0 text-primary-foreground placeholder:text-primary-foreground/60"
          />
        </div>
      </div>

      {/* Environment List */}
      <div className="px-4 py-6 space-y-3">
        {/* Unassigned employees section */}
        {getUnassignedEmployees().length > 0 && (
          <Card className="border-0 shadow-md overflow-hidden border-l-4 border-l-warning">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <CardHeader className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">Sem Ambiente</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Funcionários não vinculados
                      </p>
                    </div>
                    <span className="text-sm font-medium text-warning">
                      {getUnassignedEmployees().length} funcionário{getUnassignedEmployees().length !== 1 ? "s" : ""}
                    </span>
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0 border-t">
                  <div className="space-y-2">
                    {getUnassignedEmployees().map(emp => {
                      const initials = emp.full_name
                        .split(" ")
                        .map(n => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      
                      return (
                        <div
                          key={emp.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setSelectedEnvId("");
                            setAssignDialogOpen(true);
                          }}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={emp.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {emp.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {emp.email}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            Vincular
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {filteredEnvironments.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum ambiente encontrado</p>
              <p className="text-sm text-muted-foreground/70">
                Clique em "Novo" para criar um ambiente
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredEnvironments.map(env => (
            <Card key={env.id} className="border-0 shadow-md overflow-hidden">
              <Collapsible open={env.isOpen} onOpenChange={() => toggleEnvironment(env.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base truncate">
                            {env.name}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEnv(env);
                              setEnvName(env.name);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingEnv(env);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Código: <span className="font-mono">{env.slug}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">
                          {env.employeeCount} funcionário{env.employeeCount !== 1 ? "s" : ""}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 text-muted-foreground transition-transform",
                            env.isOpen && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 pt-0 border-t">
                    {getEnvironmentEmployees(env.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum funcionário neste ambiente
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {getEnvironmentEmployees(env.id).map(emp => {
                          const initials = emp.full_name
                            .split(" ")
                            .map(n => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();
                          
                          return (
                            <div
                              key={emp.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setSelectedEnvId(emp.environment_id || "");
                                setAssignDialogOpen(true);
                              }}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={emp.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {emp.full_name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {emp.email}
                                </p>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs">
                                Alterar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Environment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingEnv ? "Editar Ambiente" : "Novo Ambiente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="envName">Nome do Ambiente</Label>
              <Input
                id="envName"
                placeholder="Ex: Empresa ABC"
                value={envName}
                onChange={(e) => setEnvName(e.target.value)}
              />
              {envName && (
                <p className="text-xs text-muted-foreground">
                  Código: <span className="font-mono">{generateSlug(envName)}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEnvironment} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingEnv ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Environment Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ambiente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o ambiente "{deletingEnv?.name}"?
              {deletingEnv?.employeeCount ? (
                <span className="block mt-2 text-warning">
                  {deletingEnv.employeeCount} funcionário(s) serão desvinculados deste ambiente.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEnvironment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Employee Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Alterar Ambiente do Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEmployee && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedEmployee.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedEmployee.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedEmployee.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEmployee.email}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={selectedEnvId} onValueChange={setSelectedEnvId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem ambiente</SelectItem>
                  {environments.map(env => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignEmployee} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
