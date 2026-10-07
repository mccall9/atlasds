import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Called every 15 min by the database scheduler. The work is an idempotent,
// read-only mirror of the Portais, throttled to once per 10 min, so a replayed
// call cannot do harm beyond refreshing the same data.
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
        const { ensureDriveWatches, processDriveChanges } = await import("@/lib/drive-watch.server");
        await processDriveChanges();
        await ensureDriveWatches();
        const since = new Date(Date.now() - 10 * 60_000).toISOString();
        const { count } = await (supabaseAdmin as any).from("sync_logs").select("id", { count: "exact", head: true }).gte("inicio", since);
        if ((count ?? 0) > 0) return Response.json({ ok: true, skipped: true });
        const { syncTodos } = await import("@/lib/sync.server");
        const results = await syncTodos();
        return Response.json({ ok: true, total: results.length, erros: results.filter((r) => !r.ok).length });
      },
    },
  },
});
