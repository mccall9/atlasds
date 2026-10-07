import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/drive-changes")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    const { processDriveChanges } = await import("@/lib/drive-watch.server");
    const processed = await processDriveChanges();
    return Response.json({ processed: processed.length, errors: processed.filter((r) => !r.ok).length });
  } } },
});