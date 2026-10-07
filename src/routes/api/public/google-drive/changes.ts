import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const eventSchema = z.object({
  id: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/),
  resource: z.string().min(1).max(512), message: z.string().regex(/^\d{1,20}$/),
  state: z.enum(["sync", "update", "add", "remove", "trash", "untrash", "change"]),
});
export const Route = createFileRoute("/api/public/google-drive/changes")({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = eventSchema.safeParse({
      id: request.headers.get("x-goog-channel-id"), token: request.headers.get("x-goog-channel-token"),
      resource: request.headers.get("x-goog-resource-id"), message: request.headers.get("x-goog-message-number"),
      state: request.headers.get("x-goog-resource-state"),
    });
    if (!parsed.success) return new Response("Invalid notification", { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashChannelToken } = await import("@/lib/drive-watch.server");
    const { data: accepted, error } = await (supabaseAdmin as any).rpc("receive_portal_drive_event", {
      _id: parsed.data.id, _hash: hashChannelToken(parsed.data.token), _resource: parsed.data.resource,
      _message: parsed.data.message, _changed: parsed.data.state !== "sync",
    });
    if (error) { console.error(error.message); return new Response("Notification storage failed", { status: 503 }); }
    // Duplicate/expired/wrong-token events never trigger work; no state disclosure.
    return new Response(null, { status: accepted ? 204 : 204 });
  } } },
});