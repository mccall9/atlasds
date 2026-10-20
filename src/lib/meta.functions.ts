import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { META_GRAPH_VERSION, META_SCOPES, isAllowedMetaOrigin, metaRedirectUri } from "./meta-config";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Sem permissão");
}

export const getMetaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { metaCreds } = await import("./meta.server");
    const { appId, appSecret } = metaCreds();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("meta_conexao")
      .select("meta_user_name, meta_user_id, token_expires_at, connected_at, scopes, last_import_at, last_import_error")
      .eq("id", 1)
      .maybeSingle();
    return {
      appIdConfigurado: !!appId,
      appSecretConfigurado: !!appSecret,
      conexao: data
        ? { nome: data.meta_user_name, id: data.meta_user_id, expiraEm: data.token_expires_at, conectadoEm: data.connected_at, permissoes: data.scopes, importadoEm: data.last_import_at, erroImportacao: data.last_import_error }
        : null,
    };
  });

export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!isAllowedMetaOrigin(data.origin)) return { error: "origem" as const };
    const { metaCreds } = await import("./meta.server");
    const { appId, appSecret } = metaCreds();
    if (!appId || !appSecret) return { error: "config" as const };
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const state = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const redirectUri = metaRedirectUri(data.origin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("meta_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error } = await supabaseAdmin
      .from("meta_oauth_states")
      .insert({ state, user_id: context.userId, redirect_uri: redirectUri, return_origin: data.origin });
    if (error) throw new Error("Não foi possível iniciar a conexão");
    const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", META_SCOPES.join(","));
    return { url: url.toString() };
  });

export const listMetaAdAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getMetaToken, listAdAccounts, MetaApiError } = await import("./meta.server");
    const token = await getMetaToken();
    if (!token) return { contas: [], error: "desconectado" as const };
    try {
      return { contas: await listAdAccounts(token), error: null };
    } catch (e) {
      return { contas: [], error: (e instanceof MetaApiError && e.message === "token" ? "token" : "graph") as "token" | "graph" };
    }
  });

export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("meta_conexao").delete().eq("id", 1);
    return { ok: true };
  });

export const importMetaNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { importMetaInvestimentos } = await import("./meta.server");
    return importMetaInvestimentos({ dias: 400 });
  });
