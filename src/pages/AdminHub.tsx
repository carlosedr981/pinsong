import { useEffect, useState } from "react";
import { Building2, CalendarDays, DollarSign, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Admin from "./Admin";
import { MonthlyScheduleCard } from "@/components/MonthlyScheduleCard";

const db = supabase as any;

export default function AdminHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [global, setGlobal] = useState(false);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await db.from("user_roles").select("environment_id").eq("user_id", user.id).eq("role", "admin").limit(1).maybeSingle();
      setGlobal(data?.environment_id === null);
      setEnvironmentId(data?.environment_id || null);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b p-3"><div className="max-w-6xl mx-auto flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => navigate("/environments")}><Building2 className="h-4 w-4 mr-1" />Ambientes</Button><Button variant="outline" size="sm" onClick={() => navigate("/employee-environments")}><Users className="h-4 w-4 mr-1" />Ambientes dos funcionários</Button>{global && <Button variant="outline" size="sm" onClick={() => navigate("/financial")}><DollarSign className="h-4 w-4 mr-1" />Financeiro</Button>}<Button variant="outline" size="sm" onClick={() => document.getElementById("monthly-schedule")?.scrollIntoView({ behavior: "smooth" })}><CalendarDays className="h-4 w-4 mr-1" />Escala mensal</Button></div></div>
    <Admin />
    <div id="monthly-schedule" className="max-w-6xl mx-auto px-3 sm:px-4 pb-8"><Card className="border-0 shadow-card"><CardContent className="p-0"><MonthlyScheduleCard isAdmin userId={user?.id || ""} environmentId={global ? null : environmentId} /></CardContent></Card></div>
  </div>;
}
