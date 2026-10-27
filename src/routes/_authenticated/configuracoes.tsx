import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
    </div>
  );
}
