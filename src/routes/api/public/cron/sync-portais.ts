import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

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
        const since = new Date(Date.now() - 15 * 60_000).toISOString();
        const { count, error } = await supabaseAdmin.from("sync_logs").select("id", { count: "exact", head: true }).gte("inicio", since);
        if (error) return Response.json({ error: "Sync status unavailable" }, { status: 503 });
        if ((count ?? 0) > 0) return Response.json({ ok: true, skipped: true });
        const { syncTodos } = await import("@/lib/sync.server");
        const results = await syncTodos();
        return Response.json({ ok: true, total: results.length, erros: results.filter((r) => !r.ok).length });
      },
    },
  },
});
