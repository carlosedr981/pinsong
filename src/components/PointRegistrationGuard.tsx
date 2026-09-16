import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

function toMinutes(value: string | null | undefined) {
  if (!value) return null;
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function PointRegistrationGuard({ userId }: { userId: string }) {
  useEffect(() => {
    let active = true;
    const update = async () => {
      if (!active) return;
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const { data: schedule } = await db.from("work_schedules").select("start_time, end_time").eq("employee_id", userId).eq("date", date).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { count } = await db.from("registros").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("timestamp", `${date}T00:00:00`).lt("timestamp", `${date}T23:59:59.999`);
      const button = Array.from(document.querySelectorAll("button")).find((el) => el.textContent?.replace(/\s+/g, " ").trim().includes("Registrar Ponto")) as HTMLButtonElement | undefined;
      if (!button) return;
      const start = toMinutes(schedule?.start_time);
      const end = toMinutes(schedule?.end_time);
      const current = now.getHours() * 60 + now.getMinutes();
      let allowed = false;
      if (start !== null && end !== null) {
        const adjustedEnd = end < start ? end + 1440 : end;
        const adjustedCurrent = current < start && adjustedEnd > 1440 ? current + 1440 : current;
        allowed = adjustedCurrent >= Math.max(0, start - 10) && adjustedCurrent <= adjustedEnd && (count || 0) < 2;
      }
      button.disabled = !allowed;
      button.setAttribute("aria-disabled", String(!allowed));
      button.title = !schedule ? "Sem escala para hoje" : (count || 0) >= 2 ? "Limite de 2 registros atingido" : start !== null && current < Math.max(0, start - 10) ? "Liberado 10 minutos antes da entrada" : end !== null && current > end ? "Período da escala encerrado" : "Registrar ponto";
    };
    update();
    const timer = window.setInterval(update, 1000);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { active = false; window.clearInterval(timer); observer.disconnect(); };
  }, [userId]);
  return null;
}
