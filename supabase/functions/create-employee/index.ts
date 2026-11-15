import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Não autenticado." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authorization.slice(7);
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return respond({ error: "Sessão inválida." }, 401);
    const admin = createClient(url, serviceKey);
    const { data: role, error: roleError } = await admin.from("user_roles").select("user_id").eq("user_id", user.id).eq("role", "admin").is("environment_id", null).maybeSingle();
    if (roleError || !role) return respond({ error: "Apenas o administrador global pode cadastrar funcionários." }, 403);
    const body = await req.json(), fullName = String(body.fullName || "").trim(), email = String(body.email || "").trim().toLowerCase(), password = String(body.password || "");
    if (fullName.length < 2 || fullName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 72) return respond({ error: "Informe nome, email válido e senha entre 8 e 72 caracteres." }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) return respond({ error: error.message }, 400);
    return respond({ user: { id: data.user.id, email: data.user.email } }, 201);
  } catch (error) { return respond({ error: error instanceof Error ? error.message : "Erro interno." }, 500); }
});
