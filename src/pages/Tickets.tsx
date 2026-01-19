import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TicketDialog } from "@/components/TicketDialog";
import { TicketList } from "@/components/TicketList";

export default function Tickets() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      setIsAdmin(!!data);
      setLoading(false);
    };

    checkRole();
  }, [user, navigate]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
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
      {/* Header */}
      <div className="gradient-hero p-4 pt-8 pb-6 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
              <span className="text-primary-foreground font-semibold text-lg">
                Tickets
              </span>
            </div>
          </div>
          <TicketDialog onSuccess={handleRefresh} />
        </div>

        <p className="text-primary-foreground/80 text-sm text-center">
          {isAdmin
            ? "Gerencie os tickets dos funcionários"
            : "Envie mensagens para a administração"}
        </p>
      </div>

      {/* Content */}
      <div className="px-4 py-6 -mt-4">
        {isAdmin ? (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="all" className="text-xs sm:text-sm">Todos</TabsTrigger>
              <TabsTrigger value="open" className="text-xs sm:text-sm">Abertos</TabsTrigger>
              <TabsTrigger value="closed" className="text-xs sm:text-sm">Fechados</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <TicketList isAdmin={true} refreshTrigger={refreshTrigger} statusFilter="all" />
            </TabsContent>
            <TabsContent value="open">
              <TicketList isAdmin={true} refreshTrigger={refreshTrigger} statusFilter="open" />
            </TabsContent>
            <TabsContent value="closed">
              <TicketList isAdmin={true} refreshTrigger={refreshTrigger} statusFilter="closed" />
            </TabsContent>
          </Tabs>
        ) : (
          <TicketList refreshTrigger={refreshTrigger} />
        )}
      </div>
    </div>
  );
}