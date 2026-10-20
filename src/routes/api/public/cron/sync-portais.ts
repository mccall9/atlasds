import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Meta Ads daily spend is refreshed on the same schedule, at most every 10 minutes, for the last 40 days.
async function importMetaIfDue(db: any) {
  const { data } = await db.from("meta_conexao").select("last_import_at").eq("id", 1).maybeSingle();
  if (!data) return null;
  if (data.last_import_at && Date.now() - new Date(data.last_import_at).getTime() < 10 * 60_000) return { skipped: true };
  const { importMetaInvestimentos } = await import("@/lib/meta.server");
  const r = await importMetaInvestimentos({ dias: 40 });
  return { ok: r.ok, dias: r.dias };
}

// Scheduled reads only; Drive notifications no longer initiate sync.
export const Route = createFileRoute("/api/public/cron/sync-portais")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const isPublishable = !!token && token === process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!isPublishable) {
          const denied = await authenticateCronRequest(request);
          if (denied) return denied;
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const meta = await importMetaIfDue(supabaseAdmin).catch((e) => {
          console.error("[meta] scheduled import", e instanceof Error ? e.message : e);
          return { ok: false };
        });
        const since = new Date(Date.now() - 15 * 60_000).toISOString();
        const { count, error } = await supabaseAdmin.from("sync_logs").select("id", { count: "exact", head: true }).gte("inicio", since);
        if (error) return Response.json({ error: "Sync status unavailable" }, { status: 503 });
        if ((count ?? 0) > 0) return Response.json({ ok: true, skipped: true, meta });
        const { syncTodos } = await import("@/lib/sync.server");
        const results = await syncTodos();
        return Response.json({ ok: true, total: results.length, erros: results.filter((r) => !r.ok).length, meta });
      },
    },
  },
});
