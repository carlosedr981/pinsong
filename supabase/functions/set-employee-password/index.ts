import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Não autenticado." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return respond({ error: "Configuração da função incompleta no Supabase." }, 500);

    const token = authorization.slice(7);
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return respond({ error: "Sessão inválida. Entre novamente no sistema." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: role, error: roleError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .is("environment_id", null)
      .maybeSingle();

    if (roleError || !role) return respond({ error: "Apenas o administrador global pode alterar senhas." }, 403);

    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const password = String(body.password || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return respond({ error: "Funcionário inválido." }, 400);
    }
    if (password.length < 8 || password.length > 72) {
      return respond({ error: "A senha deve ter entre 8 e 72 caracteres." }, 400);
    }
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    if (targetError || !target.user) return respond({ error: "Conta do funcionário não encontrada." }, 404);

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
    if (updateError) return respond({ error: updateError.message }, 400);

    return respond({ success: true, userId }, 200);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Erro interno ao alterar senha." }, 500);
  }
});
