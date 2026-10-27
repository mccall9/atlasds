import { META_GRAPH_VERSION } from "./meta-config";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export function metaCreds() {
  const appId = process.env["META_APP_ID"]?.trim() || null;
  const appSecret = process.env["META_APP_SECRET"]?.trim() || null;
  return { appId, appSecret };
}

async function appSecretProof(token: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(token));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class MetaApiError extends Error {}

async function graphGet<T>(path: string, params: Record<string, string>, token?: string): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (token) {
    const { appSecret } = metaCreds();
    url.searchParams.set("access_token", token);
    if (appSecret) url.searchParams.set("appsecret_proof", await appSecretProof(token, appSecret));
  }
  const res = await fetch(url.toString());
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || body?.error) {
    console.error("[meta] graph error", res.status, body?.error?.type, body?.error?.code, body?.error?.message);
    throw new MetaApiError(body?.error?.code === 190 ? "token" : "graph");
  }
  return body as T;
}

export async function exchangeCodeAndSave(code: string, redirectUri: string, userId: string) {
  const { appId, appSecret } = metaCreds();
  if (!appId || !appSecret) throw new MetaApiError("config");
  const short = await graphGet<{ access_token: string }>("/oauth/access_token", {
    client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
  });
  const long = await graphGet<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token,
  });
  const token = long.access_token;
  const me = await graphGet<{ id: string; name?: string }>("/me", { fields: "id,name" }, token);
  const perms = await graphGet<{ data: { permission: string; status: string }[] }>("/me/permissions", {}, token).catch(() => ({ data: [] }));
  const scopes = perms.data.filter((p) => p.status === "granted").map((p) => p.permission).join(",");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("meta_conexao").upsert({
    id: 1, meta_user_id: me.id, meta_user_name: me.name ?? null, access_token: token,
    token_expires_at: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
    scopes, connected_by: userId, connected_at: now, updated_at: now,
  });
  if (error) { console.error("[meta] save connection", error.message); throw new MetaApiError("save"); }
}

export async function getMetaToken(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("meta_conexao").select("access_token").eq("id", 1).maybeSingle();
  return data?.access_token ?? null;
}

export type MetaAdAccount = { id: string; nome: string; moeda: string | null; ativa: boolean };

export async function listAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const out: MetaAdAccount[] = [];
  let next: string | null = `${GRAPH}/me/adaccounts`;
  let params: Record<string, string> = { fields: "id,name,currency,account_status", limit: "100" };
  for (let page = 0; next && page < 10; page++) {
    const r: { data: { id: string; name?: string; currency?: string; account_status?: number }[]; paging?: { next?: string } } =
      await graphGet(next, params, token);
    for (const a of r.data) out.push({ id: a.id, nome: a.name ?? a.id, moeda: a.currency ?? null, ativa: a.account_status === 1 });
    next = r.paging?.next ?? null;
    params = {};
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const CONVERSA_ACTION = "onsite_conversion.messaging_conversation_started_7d";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

type InsightRow = { date_start: string; spend?: string; actions?: { action_type: string; value: string }[] };

async function accountDailyInsights(token: string, accountId: string, since: string, until: string) {
  const rows: InsightRow[] = [];
  let next: string | null = `${GRAPH}/${accountId}/insights`;
  let params: Record<string, string> = {
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "spend,actions",
    limit: "500",
  };
  for (let page = 0; next && page < 10; page++) {
    const r: { data: InsightRow[]; paging?: { next?: string } } = await graphGet(next, params, token);
    rows.push(...r.data);
    next = r.paging?.next ?? null;
    params = {};
  }
  return rows;
}

/** Reads daily spend and started conversations for every linked ad account (read-only on Meta). */
export async function importMetaInvestimentos(opts: { dias: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = await getMetaToken();
  if (!token) return { ok: false as const, erro: "desconectado", contas: 0, dias: 0 };
  const { data: contas } = await supabaseAdmin.from("meta_contas_anuncio").select("ad_account_id, cliente_id, nome");
  const until = isoDay(new Date());
  const since = isoDay(new Date(Date.now() - opts.dias * 86_400_000));
  let dias = 0;
  const erros: string[] = [];
  for (const c of contas ?? []) {
    try {
      const rows = await accountDailyInsights(token, c.ad_account_id, since, until);
      const now = new Date().toISOString();
      const payload = rows.map((r) => ({
        cliente_id: c.cliente_id,
        data: r.date_start,
        plataforma: "meta",
        origem: "meta_api",
        meta_ad_account_id: c.ad_account_id,
        valor_investido: Number(r.spend ?? 0),
        conversas_iniciadas: Math.round(Number(r.actions?.find((a) => a.action_type === CONVERSA_ACTION)?.value ?? 0)),
        atualizado_em: now,
      }));
      if (payload.length) {
        const { error } = await supabaseAdmin.from("investimento_anuncios").upsert(payload, { onConflict: "meta_ad_account_id,data" });
        if (error) throw new Error(error.message);
      }
      // Days Meta no longer reports (e.g. account re-linked) are removed only inside the read window.
      const keep = payload.map((p) => p.data);
      let del = supabaseAdmin.from("investimento_anuncios").delete()
        .eq("meta_ad_account_id", c.ad_account_id).gte("data", since).lte("data", until);
      if (keep.length) del = del.not("data", "in", `(${keep.join(",")})`);
      await del;
      dias += payload.length;
    } catch (e) {
      console.error("[meta] import", c.ad_account_id, e instanceof Error ? e.message : e);
      erros.push(c.nome ?? c.ad_account_id);
    }
  }
  await supabaseAdmin.from("meta_conexao").update({
    last_import_at: new Date().toISOString(),
    last_import_error: erros.length ? `Falha ao ler: ${erros.join(", ")}` : null,
  }).eq("id", 1);
  return { ok: erros.length === 0, erro: erros.length ? erros.join(", ") : null, contas: contas?.length ?? 0, dias };
}
