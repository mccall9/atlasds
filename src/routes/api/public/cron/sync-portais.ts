import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/sync-portais")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { syncTodos } = await import("@/lib/sync.server");
        const results = await syncTodos();
        return Response.json({ ok: true, total: results.length, erros: results.filter((r) => !r.ok).length });
      },
    },
  },
});
