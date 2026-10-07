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
    // Acknowledge old channels without storing or dispatching events.
    return new Response(null, { status: 204 });
  } } },
});