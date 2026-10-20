import { createFileRoute } from "@tanstack/react-router";
import { parseCrmLead } from "@/lib/crm";

// Inbound CRM webhook. Public by necessity: trust comes only from the per-webhook secret token in the URL.
const MAX_BYTES = 256 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function readBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > MAX_BYTES) throw new Error("grande");
  if (!raw.trim()) return {};
  if ((request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return JSON.parse(raw);
}

async function findWebhook(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("crm_webhooks").select("id, cliente_id, ativo, spreadsheet_id").eq("token", token).maybeSingle();
  // Sheet sources are mirrored by the scheduled sync and never accept pushed leads.
  return data?.ativo && !data.spreadsheet_id ? { db: supabaseAdmin, hook: data } : null;
}

export const Route = createFileRoute("/api/public/webhooks/crm/$token")({
  server: {
    handlers: {
      // Lets the CRM's "test URL" button confirm the address without storing anything.
      GET: async ({ params }) => ((await findWebhook(params.token)) ? json({ ok: true }) : json({ error: "Webhook não encontrado" }, 404)),
      POST: async ({ request, params }) => {
        const found = await findWebhook(params.token);
        if (!found) return json({ error: "Webhook não encontrado" }, 404);
        let payload: unknown;
        try {
          payload = await readBody(request);
        } catch (e) {
          return json({ error: e instanceof Error && e.message === "grande" ? "Payload muito grande" : "JSON inválido" }, 400);
        }
        const { db, hook } = found;
        const now = new Date().toISOString();
        const lead = parseCrmLead(payload);
        const row = { ...lead, webhook_id: hook.id, cliente_id: hook.cliente_id, payload: payload as never, atualizado_em: now };
        const { error } = lead.external_id
          ? await db.from("crm_leads").upsert(row, { onConflict: "webhook_id,external_id" })
          : await db.from("crm_leads").insert(row);
        if (error) {
          console.error("[crm] webhook insert", error.message);
          return json({ error: "Não foi possível salvar o lead" }, 500);
        }
        await db.from("crm_webhooks").update({ ultimo_recebimento: now }).eq("id", hook.id);
        return json({ ok: true });
      },
    },
  },
});
