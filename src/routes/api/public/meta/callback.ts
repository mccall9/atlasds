import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// OAuth return from Meta. Public by necessity: trust comes only from the single-use state row.
const back = (motivo?: string) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: motivo ? `/integracoes?meta=erro&motivo=${motivo}` : "/integracoes?meta=ok",
      "Cache-Control": "no-store",
    },
  });

const Query = z.object({
  code: z.string().min(10).max(2000).optional(),
  state: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  error: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
        if (!q.success || !q.data.state) return back("invalido");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: st } = await supabaseAdmin
          .from("meta_oauth_states")
          .delete()
          .eq("state", q.data.state)
          .select("user_id, redirect_uri, expires_at, empresa")
          .maybeSingle();
        if (!st || new Date(st.expires_at).getTime() < Date.now()) return back("expirado");
        if (q.data.error || !q.data.code) return back("negado");
        const empresa = st.empresa === "barbearias" ? "barbearias" : "atlas";
        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: st.user_id, _role: "admin" });
        const { data: isGestor } = empresa === "barbearias" ? await (supabaseAdmin as any).rpc("is_gestor", { _user_id: st.user_id }) : { data: false };
        if (!isAdmin && !isGestor) return back("sem-permissao");
        const { exchangeCodeAndSave, MetaApiError } = await import("@/lib/meta.server");
        try {
          await exchangeCodeAndSave(q.data.code, st.redirect_uri, st.user_id, empresa);
        } catch (e) {
          return back(e instanceof MetaApiError && e.message === "config" ? "config" : "troca");
        }
        return back();
      },
    },
  },
});
