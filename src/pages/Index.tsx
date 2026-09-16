import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "./Dashboard";
import { PointRegistrationGuard } from "@/components/PointRegistrationGuard";
import { WorkScheduleCard } from "@/components/WorkScheduleCard";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Dashboard />
      <div className="px-4 pb-8 max-w-5xl mx-auto">
        <WorkScheduleCard isAdmin={false} userId={user.id} />
      </div>
      <PointRegistrationGuard userId={user.id} />
    </>
  );
}
