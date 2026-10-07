import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clienteId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Sem permissão");
    const { syncTodos } = await import("./sync.server");
    return syncTodos(data.clienteId);
  });

export const getSharedPanel = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: cliente } = await db
      .from("clientes")
      .select("id, nome, hunter, performance, meta_mensal_override, last_sync_at, last_sync_error")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!cliente) return null;
    const [v, m, a, i, cfg] = await Promise.all([
      db.from("vendas").select("*").eq("cliente_id", cliente.id),
      db.from("metas").select("*").eq("cliente_id", cliente.id),
      db.from("acompanhamento").select("*").eq("cliente_id", cliente.id).order("ordem"),
      db.from("investimento_anuncios").select("*").eq("cliente_id", cliente.id),
      db.from("configuracoes").select("pct_total, pct_hunter, pct_performance, pct_atlas").eq("id", 1).single(),
    ]);
    return {
      clientes: [cliente],
      vendas: v.data ?? [],
      metas: m.data ?? [],
      acompanhamento: a.data ?? [],
      investimentos: i.data ?? [],
      config: cfg.data,
    };
  });
