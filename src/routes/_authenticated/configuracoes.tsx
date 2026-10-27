import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminOnly, Logo, useConfig } from "@/components/atlas/AppShell";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Configurações · Atlas" },
      { name: "description", content: "Percentuais de comissão, domínio de acesso e logo do painel." },
      { property: "og:title", content: "Configurações · Atlas" },
      { property: "og:description", content: "Percentuais de comissão, domínio de acesso e logo do painel." },
    ],
  }),
  component: () => <AdminOnly><Config /></AdminOnly>,
});

function Config() {
  const cfg = useConfig();
  const qc = useQueryClient();
  const [f, setF] = useState({ pct_total: "5", pct_hunter: "3", pct_performance: "1", pct_atlas: "1", dominio_permitido: "", logo_url: "" });
  useEffect(() => {
    if (cfg.data) setF({
      pct_total: String(cfg.data.pct_total), pct_hunter: String(cfg.data.pct_hunter), pct_performance: String(cfg.data.pct_performance),
      pct_atlas: String(cfg.data.pct_atlas), dominio_permitido: cfg.data.dominio_permitido ?? "", logo_url: cfg.data.logo_url ?? "",
    });
  }, [cfg.data]);
  const n = (s: string) => Number(s.replace(",", "."));
  const save = async () => {
    const { error } = await supabase.from("configuracoes").update({
      pct_total: n(f.pct_total), pct_hunter: n(f.pct_hunter), pct_performance: n(f.pct_performance), pct_atlas: n(f.pct_atlas),
      dominio_permitido: f.dominio_permitido.replace(/^@/, "") || null, logo_url: f.logo_url || null, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas");
    qc.invalidateQueries();
  };
  const field = (k: keyof typeof f, label: string) => (
    <div className="space-y-1.5"><Label>{label}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <div className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="text-sm font-semibold">Comissões (% sobre o caixa recebido)</h2>
        <div className="grid grid-cols-2 gap-3">
          {field("pct_total", "Comissão total")}{field("pct_hunter", "Hunter")}{field("pct_performance", "Gestor de Performance")}{field("pct_atlas", "Atlas")}
        </div>
      </div>
      <div className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="text-sm font-semibold">Acesso e identidade</h2>
        {field("dominio_permitido", "Domínio de e-mail liberado para a equipe")}
        {field("logo_url", "URL do logo da Atlas")}
        <div className="rounded-xl bg-muted p-4"><Logo url={f.logo_url} /></div>
      </div>
      <Button onClick={save}>Salvar</Button>
      <Convites />
    </div>
  );
}

// Traffic managers of the barbershop company sign up with their own e-mail; an invitation turns them into gestores on first login.
function Convites() {
  const qc = useQueryClient();
  const convites = useQuery({ queryKey: ["convites"], queryFn: async () => (await supabase.from("convites_acesso").select("*").order("created_at")).data ?? [] });
  const [email, setEmail] = useState("");
  const convidar = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Informe um e-mail válido"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("convites_acesso").insert({ email: e, created_by: u.user?.id ?? null });
    if (error) { toast.error(error.code === "23505" ? "Este e-mail já foi convidado" : "Não foi possível convidar"); return; }
    toast.success("Convite registrado");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["convites"] });
  };
  const remover = async (e: string) => {
    const { error } = await supabase.from("convites_acesso").delete().eq("email", e);
    if (error) toast.error("Não foi possível remover"); else qc.invalidateQueries({ queryKey: ["convites"] });
  };
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Gestores de tráfego · Barbearias</h2>
        <p className="mt-1 text-sm text-muted-foreground">Convide pelo e-mail (qualquer domínio). A pessoa cria a conta em "Criar conta" na tela de login, confirma o e-mail e entra direto na área das Barbearias, sem ver os dados da Atlas.</p>
      </div>
      <div className="flex gap-2">
        <Input className="max-w-sm" type="email" placeholder="gestor@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void convidar()} />
        <Button variant="outline" onClick={convidar}><UserPlus className="size-4" />Convidar</Button>
      </div>
      {!!convites.data?.length && (
        <div className="divide-y rounded-xl border">
          {convites.data.map((c) => (
            <div key={c.email} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="flex-1">{c.email}</span>
              <Button size="icon" variant="ghost" title="Remover convite" onClick={() => void remover(c.email)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Remover o convite impede novos acessos com esse e-mail; quem já entrou continua com acesso até ser removido pelo suporte.</p>
    </div>
  );
}
