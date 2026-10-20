import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncCrmNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Sem permissão");
    const { syncCrmPlanilhas } = await import("./crm-sync.server");
    return syncCrmPlanilhas(data.id ? { id: data.id } : {});
  });
