import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { WorkScheduleCard } from "@/components/WorkScheduleCard";

const db = supabase as any;

export function AdminScheduleExtension() {
  const { user } = useAuth();
  const [environmentId, setEnvironmentId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    db.from("user_roles").select("environment_id").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }: any) => {
      setEnvironmentId(data?.environment_id ?? null);
    });
  }, [user]);

  if (!user || environmentId === undefined) return null;

  return (
    <div className="px-3 sm:px-4 pb-8">
      <div className="max-w-6xl mx-auto">
        <WorkScheduleCard isAdmin userId={user.id} environmentId={environmentId} />
      </div>
    </div>
  );
}
