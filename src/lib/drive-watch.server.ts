import { createHash, randomBytes, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncCliente } from "./sync.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const CALLBACK = "https://project--a701e888-1015-4fea-a124-2511a1e7386a.lovable.app/api/public/google-drive/changes";
const db = supabaseAdmin as any;

async function drive(path: string, body?: Record<string, unknown>) {
  const lov = process.env["LOVABLE_API_KEY"];
  const key = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lov || !key) throw new Error("Conexão com Google Drive não configurada");
  const response = await fetch(`${GATEWAY}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Google Drive [${response.status}]: ${text}`);
    throw new Error(`Google Drive [${response.status}]: ${text}`);
  }
  return response.json();
}

export const hashChannelToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function ensureDriveWatches() {
  const { data: clients, error } = await db.from("clientes").select("id,nome,spreadsheet_id").eq("ativo", true).eq("empresa", "atlas").not("spreadsheet_id", "is", null);
  if (error) throw error;
  const { data: watches, error: readError } = await db.from("portal_drive_watches").select("cliente_id,spreadsheet_id,expires_at,resource_id,callback_url");
  if (readError) throw readError;
  const results: { nome: string; ok: boolean; erro?: string }[] = [];
  for (const client of clients) {
    if (watches?.some((w: any) => w.cliente_id === client.id && w.spreadsheet_id === client.spreadsheet_id && w.callback_url === CALLBACK && w.resource_id && Date.parse(w.expires_at) > Date.now() + 2 * 3600_000)) {
      results.push({ nome: client.nome, ok: true });
      continue;
    }
    const id = randomUUID();
    const token = randomBytes(32).toString("hex");
    try {
      const metadata = await drive(`/files/${client.spreadsheet_id}?fields=version`);
      const expiration = Date.now() + 24 * 3600_000;
      // Persist before registering: Google's initial notification can arrive first.
      const { error: insertError } = await db.from("portal_drive_watches").insert({
        id, cliente_id: client.id, spreadsheet_id: client.spreadsheet_id, callback_url: CALLBACK,
        token_hash: hashChannelToken(token), expires_at: new Date(expiration).toISOString(), last_version: metadata.version,
      });
      if (insertError) throw insertError;
      const channel = await drive(`/files/${client.spreadsheet_id}/watch`, { id, type: "web_hook", address: CALLBACK, token, expiration: String(expiration) });
      const { error: updateError } = await db.from("portal_drive_watches").update({ resource_id: channel.resourceId, expires_at: new Date(Number(channel.expiration ?? expiration)).toISOString() }).eq("id", id);
      if (updateError) throw updateError;
      results.push({ nome: client.nome, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.from("portal_drive_watches").update({ last_error: message, expires_at: new Date().toISOString() }).eq("id", id);
      results.push({ nome: client.nome, ok: false, erro: message });
      // Stop on permanent authorization and quota errors; don't amplify failures.
      if (/Google Drive \[(400|401|403|429)\]/.test(message)) break;
    }
  }
  return results;
}

export async function processDriveChanges() {
  const { data: rows, error } = await db.from("portal_drive_watches").select("id,cliente_id,spreadsheet_id,last_version,pending_at")
    .not("pending_at", "is", null).order("pending_at").limit(20);
  if (error) throw error;
  const results: { ok: boolean; clienteId: string }[] = [];
  for (const row of rows) {
    const { data: client, error: clientError } = await db.from("clientes").select("id,nome,spreadsheet_id,layout").eq("id", row.cliente_id).eq("ativo", true).maybeSingle();
    if (clientError) throw clientError;
    if (!client || client.spreadsheet_id !== row.spreadsheet_id) {
      await db.from("portal_drive_watches").update({ pending_at: null }).eq("id", row.id).eq("pending_at", row.pending_at);
      continue;
    }
    try {
      const metadata = await drive(`/files/${client.spreadsheet_id}?fields=version`);
      const result = metadata.version === row.last_version ? { ok: true } : await syncCliente(client);
      if ("skipped" in result && result.skipped) continue;
      if (result.ok) {
        // Never clear an edit that arrived while the sync was running.
        const { error: updateError } = await db.from("portal_drive_watches").update({ pending_at: null, last_version: metadata.version, last_error: null }).eq("id", row.id).eq("pending_at", row.pending_at);
        if (updateError) throw updateError;
      } else if ("erro" in result && result.erro) {
        const transient = /Google Sheets \[(429|5\d\d)\]|fetch failed|network/i.test(result.erro);
        await db.from("portal_drive_watches").update({ ...(transient ? {} : { pending_at: null }), last_error: result.erro }).eq("id", row.id).eq("pending_at", row.pending_at);
      }
      results.push({ ok: result.ok, clienteId: client.id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const transient = /Google (?:Drive|Sheets) \[(429|5\d\d)\]|fetch failed|network/i.test(message);
      await db.from("portal_drive_watches").update({ ...(transient ? {} : { pending_at: null }), last_error: message }).eq("id", row.id).eq("pending_at", row.pending_at);
      console.error(message);
      results.push({ ok: false, clienteId: client.id });
    }
  }
  return results;
}