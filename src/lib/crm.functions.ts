import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admins use any source; gestores only the barbershop sources their RLS lets them read.
async function podeUsarFonte(context: { supabase: any; userId: string }, id?: string) {
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (admin) return;
  const { data: gestor } = await context.supabase.rpc("is_gestor", { _user_id: context.userId });
  if (gestor && id) {
    const { data } = await context.supabase.from("crm_webhooks").select("id").eq("id", id).eq("empresa", "barbearias").maybeSingle();
    if (data) return;
  }
  throw new Error("Sem permissão");
}

export const syncCrmNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await podeUsarFonte(context, data.id);
    const { syncCrmPlanilhas } = await import("./crm-sync.server");
    return syncCrmPlanilhas(data.id ? { id: data.id } : {});
  });

export const importCrmArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    grid: z.array(z.array(z.string().max(2000)).max(100)).min(2).max(20001),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await podeUsarFonte(context, data.id);
    const { importarArquivo } = await import("./crm-sync.server");
    return importarArquivo(data.id, data.grid);
  });
