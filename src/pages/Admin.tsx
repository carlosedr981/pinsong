import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Users, 
  Calendar, 
  LogOut, 
  Loader2, 
  ChevronDown,
  Clock,
  MapPin,
  Image,
  ImagePlus,
  Plus,
  Shield,
  Search,
  Pencil,
  Building2,
  Trash2,
  ShieldCheck,
  ShieldOff,
  DollarSign,
  CheckCircle2,
  XCircle,
  Download,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PhotoDialog } from "@/components/PhotoDialog";
import { EmployeeEditDialog } from "@/components/EmployeeEditDialog";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PaymentDialog } from "@/components/PaymentDialog";
import { GalleryCapture } from "@/components/GalleryCapture";
import { HourlyRateDialog } from "@/components/HourlyRateDialog";
import { ManualRegistroDialog } from "@/components/ManualRegistroDialog";
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

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  cpf: string | null;
  pix_key: string | null;
  pix_bank: string | null;
  pix_beneficiary_name: string | null;
  pix_beneficiary_cpf: string | null;
  pix_beneficiary_phone: string | null;
  environment_id: string | null;
}

interface Registro {
  id: string;
  timestamp: string;
  photo_url: string;
  latitude: number | null;
  longitude: number | null;
  user_id: string;
  paid: boolean;
  paid_at: string | null;
  receipt_url: string | null;
  value_per_registro: number;
}

interface EmployeeWithRegistros extends Profile {
  registros: Registro[];
  isOpen: boolean;
  isEnvironmentAdmin: boolean;
}

interface AdminRole {
  user_id: string;
  environment_id: string | null;
}

export default function Admin() {
  const [employees, setEmployees] = useState<EmployeeWithRegistros[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all_time");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  
  // Photo dialog state
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  
  // Edit dialog state
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  
  // Delete dialog state
  const [deletingEmployee, setDeletingEmployee] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Payment dialog state
  const [payingEmployee, setPayingEmployee] = useState<EmployeeWithRegistros | null>(null);
  
  // Gallery capture dialog state (for global admin to register point via gallery)
  const [galleryDialogEmployee, setGalleryDialogEmployee] = useState<EmployeeWithRegistros | null>(null);
  
  // Manual registro dialog state
  const [manualRegistroEmployee, setManualRegistroEmployee] = useState<EmployeeWithRegistros | null>(null);
  
  // Delete registro state
  const [deletingRegistro, setDeletingRegistro] = useState<{ id: string; employeeName: string } | null>(null);
  const [isDeletingRegistro, setIsDeletingRegistro] = useState(false);
  
  // Hourly rate dialog state
  const [hourlyRateDialogOpen, setHourlyRateDialogOpen] = useState(false);
  
  // Admin info state
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [currentAdminEnvironmentId, setCurrentAdminEnvironmentId] = useState<string | null>(null);
  const [togglingAdminId, setTogglingAdminId] = useState<string | null>(null);
  
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user is admin and get admin type
  const checkAdminAccess = useCallback(async () => {
    if (!user) {
      navigate("/auth", { replace: true });
      return null;
    }

    // Check if user has admin role
    const { data: hasRole, error: roleError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !hasRole) {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
      });
      navigate("/", { replace: true });
      return null;
    }

    // Get the admin's environment_id to determine if global or environment admin
    const { data: adminRole, error: adminRoleError } = await supabase
      .from("user_roles")
      .select("environment_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (adminRoleError) {
      console.error("Error fetching admin role:", adminRoleError);
      return null;
    }

    const isGlobal = adminRole.environment_id === null;
    setIsGlobalAdmin(isGlobal);
    setCurrentAdminEnvironmentId(adminRole.environment_id);

    return { isGlobal, environmentId: adminRole.environment_id };
  }, [user, navigate, toast]);

  // Fetch all employees and their registros
  const fetchData = useCallback(async () => {
    const adminInfo = await checkAdminAccess();
    if (!adminInfo) return;

    try {
      // Fetch all profiles - RLS will filter based on admin type
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (profilesError) throw profilesError;

      // Fetch all registros - RLS will filter based on admin type
      const { data: registros, error: registrosError } = await supabase
        .from("registros")
        .select("*")
        .order("timestamp", { ascending: false });

      if (registrosError) throw registrosError;

      // Fetch all admin roles to know who is an environment admin
      const { data: adminRoles, error: adminRolesError } = await supabase
        .from("user_roles")
        .select("user_id, environment_id")
        .eq("role", "admin");

      if (adminRolesError) throw adminRolesError;

      // Filter profiles based on admin type
      let filteredProfiles = profiles || [];
      
      if (!adminInfo.isGlobal && adminInfo.environmentId) {
        // Environment admin: only see employees in their environment, excluding global admins
        const globalAdminIds = (adminRoles || [])
          .filter(r => r.environment_id === null)
          .map(r => r.user_id);
        
        filteredProfiles = filteredProfiles.filter(p => 
          p.environment_id === adminInfo.environmentId && 
          !globalAdminIds.includes(p.id)
        );
      }

      // Combine profiles with their registros and admin status
      const employeesWithRegistros: EmployeeWithRegistros[] = filteredProfiles.map(
        (profile) => ({
          ...profile,
          registros: (registros || []).filter((r) => r.user_id === profile.id),
          isOpen: false,
          isEnvironmentAdmin: (adminRoles || []).some(
            r => r.user_id === profile.id && r.environment_id !== null
          ),
        })
      );

      setEmployees(employeesWithRegistros);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados dos funcionários.",
      });
    } finally {
      setLoading(false);
    }
  }, [checkAdminAccess, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleEmployee = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId ? { ...emp, isOpen: !emp.isOpen } : emp
      )
    );
  };

  const getFilteredRegistros = (registros: Registro[]) => {
    // If custom date range is set, use it
    if (startDate || endDate) {
      return registros.filter((r) => {
        const registroDate = new Date(r.timestamp);
        const start = startDate ? startOfDay(startDate) : null;
        const end = endDate ? endOfDay(endDate) : null;
        
        if (start && end) {
          return registroDate >= start && registroDate <= end;
        } else if (start) {
          return registroDate >= start;
        } else if (end) {
          return registroDate <= end;
        }
        return true;
      });
    }

    if (dateFilter === "all_time") return registros;

    const today = new Date();
    const filterDate = new Date();

    switch (dateFilter) {
      case "today":
        return registros.filter(
          (r) => new Date(r.timestamp).toDateString() === today.toDateString()
        );
      case "week":
        filterDate.setDate(today.getDate() - 7);
        return registros.filter((r) => new Date(r.timestamp) >= filterDate);
      case "month":
        filterDate.setMonth(today.getMonth() - 1);
        return registros.filter((r) => new Date(r.timestamp) >= filterDate);
      default:
        return registros;
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.cpf?.includes(searchQuery) ||
    emp.phone?.includes(searchQuery)
  );

  const totalRegistrosHoje = employees.reduce((acc, emp) => {
    const today = new Date();
    return (
      acc +
      emp.registros.filter(
        (r) => new Date(r.timestamp).toDateString() === today.toDateString()
      ).length
    );
  }, 0);

  // Clear date filter when custom range is set
  useEffect(() => {
    if (startDate || endDate) {
      setDateFilter("custom");
    }
  }, [startDate, endDate]);

  // Clear custom range when preset filter is selected
  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    if (value !== "custom") {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  // Delete employee handler
  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    
    setIsDeleting(true);
    try {
      // Delete user roles first
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", deletingEmployee.id);

      if (rolesError) throw rolesError;

      // Delete registros
      const { error: registrosError } = await supabase
        .from("registros")
        .delete()
        .eq("user_id", deletingEmployee.id);

      if (registrosError) throw registrosError;

      // Delete profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", deletingEmployee.id);

      if (profileError) throw profileError;

      toast({
        title: "Funcionário excluído",
        description: `${deletingEmployee.full_name} foi excluído com sucesso.`,
      });

      setDeletingEmployee(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o funcionário.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle environment admin role
  const handleToggleEnvironmentAdmin = async (employee: EmployeeWithRegistros) => {
    if (!isGlobalAdmin || !employee.environment_id) return;
    
    setTogglingAdminId(employee.id);
    try {
      if (employee.isEnvironmentAdmin) {
        // Remove admin role for this environment
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", employee.id)
          .eq("role", "admin")
          .eq("environment_id", employee.environment_id);

        if (error) throw error;

        toast({
          title: "Admin removido",
          description: `${employee.full_name} não é mais admin do ambiente.`,
        });
      } else {
        // Add admin role for this environment
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: employee.id,
            role: "admin",
            environment_id: employee.environment_id,
          });

        if (error) throw error;

        toast({
          title: "Admin adicionado",
          description: `${employee.full_name} agora é admin do ambiente.`,
        });
      }

      fetchData();
    } catch (error: any) {
      console.error("Error toggling admin:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível alterar o status de admin.",
      });
    } finally {
      setTogglingAdminId(null);
    }
  };

  // Delete registro handler
  const handleDeleteRegistro = async () => {
    if (!deletingRegistro) return;
    
    setIsDeletingRegistro(true);
    try {
      const { error } = await supabase
        .from("registros")
        .delete()
        .eq("id", deletingRegistro.id);

      if (error) throw error;

      toast({
        title: "Registro excluído",
        description: `O registro foi excluído com sucesso.`,
      });

      setDeletingRegistro(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting registro:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o registro.",
      });
    } finally {
      setIsDeletingRegistro(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Photo Dialog */}
      <PhotoDialog
        open={!!selectedPhoto}
        onOpenChange={(open) => !open && setSelectedPhoto(null)}
        photoUrl={selectedPhoto || ""}
      />

      {/* Edit Employee Dialog */}
      {editingEmployee && (
        <EmployeeEditDialog
          open={!!editingEmployee}
          onOpenChange={(open) => !open && setEditingEmployee(null)}
          employee={editingEmployee}
          onSave={fetchData}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingEmployee} onOpenChange={(open) => !open && setDeletingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingEmployee?.full_name}</strong>? 
              Esta ação não pode ser desfeita e todos os registros deste funcionário serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmployee}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Registro Confirmation Dialog */}
      <AlertDialog open={!!deletingRegistro} onOpenChange={(open) => !open && setDeletingRegistro(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de <strong>{deletingRegistro?.employeeName}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRegistro}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRegistro}
              disabled={isDeletingRegistro}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingRegistro ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gallery Capture Dialog (Global Admin only) */}
      {galleryDialogEmployee && (
        <GalleryCapture
          open={!!galleryDialogEmployee}
          onOpenChange={(open) => !open && setGalleryDialogEmployee(null)}
          userId={galleryDialogEmployee.id}
          fullName={galleryDialogEmployee.full_name}
          onSuccess={fetchData}
        />
      )}

      {/* Manual Registro Dialog (Global Admin only) */}
      {manualRegistroEmployee && (
        <ManualRegistroDialog
          open={!!manualRegistroEmployee}
          onOpenChange={(open) => !open && setManualRegistroEmployee(null)}
          userId={manualRegistroEmployee.id}
          fullName={manualRegistroEmployee.full_name}
          onSuccess={fetchData}
        />
      )}

      {/* Hourly Rate Dialog (Global Admin only) */}
      <HourlyRateDialog
        open={hourlyRateDialogOpen}
        onOpenChange={setHourlyRateDialogOpen}
        employees={employees}
      />

      {/* Payment Dialog */}
      {payingEmployee && (
        <PaymentDialog
          open={!!payingEmployee}
          onOpenChange={(open) => !open && setPayingEmployee(null)}
          registros={payingEmployee.registros}
          employeeId={payingEmployee.id}
          employeeName={payingEmployee.full_name}
          onSuccess={fetchData}
        />
      )}

      {/* Header */}
      <div className="gradient-hero p-4 pt-6 sm:pt-8 pb-6 rounded-b-[1.5rem] sm:rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-background/20 flex items-center justify-center">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-primary-foreground/80 text-xs sm:text-sm">Painel</p>
              <p className="text-primary-foreground font-semibold text-sm sm:text-base">
                {isGlobalAdmin ? "Admin Global" : "Admin do Ambiente"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {isGlobalAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHourlyRateDialogOpen(true)}
                  className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3"
                >
                  <Settings className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Valores</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/environments")}
                  className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3"
                >
                  <Building2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Ambientes</span>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-primary-foreground/10 px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden text-xs">Home</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 sm:h-9 sm:w-9"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <Card className="bg-background/10 border-0 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground/80" />
                <span className="text-primary-foreground/80 text-xs sm:text-sm">Funcionários</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-primary-foreground mt-1">
                {employees.length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/10 border-0 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground/80" />
                <span className="text-primary-foreground/80 text-xs sm:text-sm">Registros Hoje</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-primary-foreground mt-1">
                {totalRegistrosHoje}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-2 sm:space-y-3">
        <div className="flex gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
          <Select value={dateFilter} onValueChange={handleDateFilterChange}>
            <SelectTrigger className="w-[100px] sm:w-[140px] h-10 text-xs sm:text-sm">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_time">Todos</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Date Range Picker */}
        {(dateFilter === "custom" || startDate || endDate) && (
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        )}
      </div>

      {/* Employee List */}
      <div className="px-3 sm:px-4 pb-8 space-y-2 sm:space-y-3">
        {filteredEmployees.length === 0 ? (
          <Card className="border-0 shadow-card">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum funcionário encontrado</p>
            </CardContent>
          </Card>
        ) : (
          filteredEmployees.map((employee) => {
            const filteredRegistros = getFilteredRegistros(employee.registros);
            const initials = employee.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <Collapsible
                key={employee.id}
                open={employee.isOpen}
                onOpenChange={() => toggleEmployee(employee.id)}
              >
                <Card className="border-0 shadow-card overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                          <AvatarImage src={employee.avatar_url || undefined} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs sm:text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <CardTitle className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
                              {employee.full_name}
                            </CardTitle>
                            {employee.isEnvironmentAdmin && (
                              <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1 sm:px-1.5 py-0.5 rounded-full">
                                Admin
                              </span>
                            )}
                            <div className="hidden sm:flex items-center gap-1">
                              {isGlobalAdmin && employee.environment_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-6 w-6",
                                    employee.isEnvironmentAdmin 
                                      ? "text-primary hover:text-destructive" 
                                      : "text-muted-foreground hover:text-primary"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleEnvironmentAdmin(employee);
                                  }}
                                  disabled={togglingAdminId === employee.id}
                                  title={employee.isEnvironmentAdmin ? "Remover admin" : "Tornar admin"}
                                >
                                  {togglingAdminId === employee.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : employee.isEnvironmentAdmin ? (
                                    <ShieldOff className="h-3 w-3" />
                                  ) : (
                                    <ShieldCheck className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEmployee(employee);
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
                                  setDeletingEmployee(employee);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {employee.email}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                          <span className="text-xs sm:text-sm font-medium text-primary whitespace-nowrap">
                            {filteredRegistros.length} reg.
                          </span>
                          <div className="flex items-center gap-1">
                            {isGlobalAdmin && (
                              <div className="hidden sm:flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManualRegistroEmployee(employee);
                                  }}
                                  title="Adicionar registro manual"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs bg-secondary/50 text-secondary-foreground border-secondary/30 hover:bg-secondary/70"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGalleryDialogEmployee(employee);
                                  }}
                                  title="Registrar via galeria"
                                >
                                  <ImagePlus className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {isGlobalAdmin && filteredRegistros.some(r => !r.paid) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-success/10 text-success border-success/30 hover:bg-success/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPayingEmployee(employee);
                                }}
                              >
                                <DollarSign className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Pagar</span>
                              </Button>
                            )}
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground transition-transform",
                                employee.isOpen && "rotate-180"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Mobile action buttons */}
                      <div className="flex sm:hidden items-center gap-1 mt-2 pt-2 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEmployee(employee);
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        {isGlobalAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setManualRegistroEmployee(employee);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingEmployee(employee);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                    <CardContent className="p-4 pt-0 border-t">
                      {filteredRegistros.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum registro no período selecionado
                        </p>
                      ) : (
                        <div className="space-y-3 mt-4">
                          {filteredRegistros.slice(0, 20).map((registro) => (
                            <div
                              key={registro.id}
                              className="flex gap-3 p-3 rounded-lg bg-muted/50 relative group"
                            >
                              {/* Delete button for Global Admin */}
                              {isGlobalAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeletingRegistro({ id: registro.id, employeeName: employee.full_name })}
                                  title="Excluir registro"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              <div 
                                className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setSelectedPhoto(registro.photo_url)}
                              >
                                <img
                                  src={registro.photo_url}
                                  alt="Registro"
                                  className="w-full h-full object-cover"
                                />
                                <Image className="absolute bottom-1 right-1 h-3 w-3 text-background/80" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-foreground">
                                    {format(new Date(registro.timestamp), "HH:mm:ss")}
                                  </p>
                                  {registro.paid ? (
                                    <Badge className="bg-success/10 text-success border-0 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Pago
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-destructive/10 text-destructive border-0 flex items-center gap-1">
                                      <XCircle className="h-3 w-3" />
                                      Não Pago
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {format(
                                      new Date(registro.timestamp),
                                      "dd/MM/yyyy - EEEE",
                                      { locale: ptBR }
                                    )}
                                  </span>
                                </div>
                                {registro.latitude && registro.longitude && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>
                                      {registro.latitude.toFixed(4)},{" "}
                                      {registro.longitude.toFixed(4)}
                                    </span>
                                  </div>
                                )}
                                {registro.receipt_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 mt-1 text-xs text-primary p-0"
                                    asChild
                                  >
                                    <a href={registro.receipt_url} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-3 w-3 mr-1" />
                                      Comprovante
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                          {filteredRegistros.length > 20 && (
                            <p className="text-sm text-muted-foreground text-center">
                              + {filteredRegistros.length - 20} registros adicionais
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
}
