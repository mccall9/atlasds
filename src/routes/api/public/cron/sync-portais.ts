import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Meta Ads daily spend is refreshed on the same schedule, at most every 10 minutes, for the last 40 days, one company at a time.
async function importMetaIfDue(db: any) {
  const { conexaoId, importMetaInvestimentos } = await import("@/lib/meta.server");
  const out: Record<string, unknown> = {};
  for (const empresa of ["atlas", "barbearias"] as const) {
    const { data } = await db.from("meta_conexao").select("last_import_at").eq("id", conexaoId(empresa)).maybeSingle();
    if (!data) continue;
    if (data.last_import_at && Date.now() - new Date(data.last_import_at).getTime() < 10 * 60_000) { out[empresa] = { skipped: true }; continue; }
    const r = await importMetaInvestimentos({ dias: 40, empresa });
    out[empresa] = { ok: r.ok, dias: r.dias };
  }
  return out;
}

// CRM export sheets follow the same cadence, each read at most every 10 minutes.
async function syncCrmIfDue() {
  const { syncCrmPlanilhas } = await import("@/lib/crm-sync.server");
  const r = await syncCrmPlanilhas({ minIntervalMs: 10 * 60_000 });
  return { total: r.length, erros: r.filter((x) => !x.ok).length };
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
        const crm = await syncCrmIfDue().catch((e) => {
          console.error("[crm] scheduled sheets", e instanceof Error ? e.message : e);
          return { ok: false };
        });
        const since = new Date(Date.now() - 15 * 60_000).toISOString();
        const { count, error } = await supabaseAdmin.from("sync_logs").select("id", { count: "exact", head: true }).gte("inicio", since);
        if (error) return Response.json({ error: "Sync status unavailable" }, { status: 503 });
        if ((count ?? 0) > 0) return Response.json({ ok: true, skipped: true, meta, crm });
        const { syncTodos } = await import("@/lib/sync.server");
        const results = await syncTodos();
        return Response.json({ ok: true, total: results.length, erros: results.filter((r) => !r.ok).length, meta, crm });
      },
    },
  },
});
