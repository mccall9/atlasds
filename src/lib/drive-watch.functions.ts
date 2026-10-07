import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const activateDriveDetection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Apenas administradores podem ativar a detecção");
    const { ensureDriveWatches } = await import("./drive-watch.server");
    const results = await ensureDriveWatches();
    return { results };
  });

export const getDriveDetection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error: readError } = await (supabaseAdmin as any).from("portal_drive_watches")
      .select("cliente_id,expires_at,last_error,resource_id").order("created_at", { ascending: false });
    if (readError) throw readError;
    return data as { cliente_id: string; expires_at: string; last_error: string | null; resource_id: string | null }[];
  });