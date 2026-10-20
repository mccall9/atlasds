import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Copy, Megaphone, Phone, Plus, Target, Trash2, TrendingUp, Users, Waypoints, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminOnly } from "@/components/atlas/AppShell";
import { Card, Section } from "@/components/atlas/Dashboard";
import { computeCrmMetrics, maskPhone, type CrmLead } from "@/lib/crm";
import { csvDownload, fmtBRL, fmtDate, fmtDateTime, fmtInt, fmtPct, presetRange, type Preset } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "CRM · Atlas" },
      { name: "description", content: "Leads recebidos do CRM por webhook (teste)." },
      { property: "og:title", content: "CRM · Atlas" },
      { property: "og:description", content: "Leads recebidos do CRM por webhook (teste)." },
    ],
  }),
  component: () => <AdminOnly><Crm /></AdminOnly>,
});

const NONE = "__none__";
const PRESETS: { v: Preset; l: string }[] = [
  { v: "este-mes", l: "Este mês" },
  { v: "mes-passado", l: "Mês passado" },
  { v: "30d", l: "Últimos 30 dias" },
  { v: "trimestre", l: "Este trimestre" },
  { v: "custom", l: "Personalizado" },
];

const webhookUrl = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/webhooks/crm/${token}`;

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copiado"), () => toast.error("Não foi possível copiar"));
}

type Audit = { title: string; rows: CrmLead[] } | null;

function Crm() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>("este-mes");
  const [custom, setCustom] = useState(() => presetRange("este-mes"));
  const range = preset === "custom" ? custom : presetRange(preset);
  const [hookFiltro, setHookFiltro] = useState("todos");
  const [audit, setAudit] = useState<Audit>(null);
  const [payload, setPayload] = useState<CrmLead | null>(null);

  const clientes = useQuery({ queryKey: ["clientes"], queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [] });
  const hooks = useQuery({
    queryKey: ["crm-webhooks"],
    queryFn: async () => (await supabase.from("crm_webhooks").select("*").order("created_at")).data ?? [],
    refetchInterval: 30_000,
  });
  const leads = useQuery({
    queryKey: ["crm-leads", range.de, range.ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .gte("recebido_em", `${range.de}T00:00:00-03:00`)
        .lte("recebido_em", `${range.ate}T23:59:59.999-03:00`)
        .order("recebido_em", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data as CrmLead[];
    },
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => (leads.data ?? []).filter((r) => hookFiltro === "todos" || r.webhook_id === hookFiltro), [leads.data, hookFiltro]);
  const m = useMemo(() => computeCrmMetrics(rows, range.de, range.ate), [rows, range.de, range.ate]);
  const open = (title: string, rs: CrmLead[]) => () => setAudit({ title, rows: rs });
  const nomeCliente = (id: string | null) => clientes.data?.find((c) => c.id === id)?.nome ?? "—";

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-g-purple-soft text-g-purple"><Webhook className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold">CRM · Webhook <span className="ml-1 rounded-full bg-g-yellow-soft px-2 py-0.5 align-middle text-xs font-medium text-g-yellow">teste</span></h1>
          <p className="text-sm text-muted-foreground">Leads enviados pelo CRM para o painel: nome, telefone, campanha e etapa. Não altera os Portais nem o Painel.</p>
        </div>
      </div>

      <Webhooks hooks={hooks.data} loading={hooks.isLoading} clientes={clientes.data ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["crm-webhooks"] })} />

      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-y bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Select value={hookFiltro} onValueChange={setHookFiltro}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os webhooks</SelectItem>
            {hooks.data?.map((h) => <SelectItem key={h.id} value={h.id}>{h.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={preset} onValueChange={(v) => { if (v === "custom") setCustom(range); setPreset(v as Preset); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{PRESETS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
        </Select>
        {preset === "custom" ? (
          <>
            <Input type="date" className="w-40" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} />
            <Input type="date" className="w-40" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} />
          </>
        ) : (
          <span className="text-sm font-medium">{fmtDate(range.de)} - {fmtDate(range.ate)}</span>
        )}
      </div>

      {leads.isLoading ? <Skeleton className="h-64 w-full" /> : leads.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar os leads do CRM.</p>
      ) : (
        <div className="space-y-10">
          <Section title="Leads" tone="blue">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card tone="blue" icon={Users} label="Leads Recebidos" value={fmtInt(m.leads.length)} hint="No período" onClick={open("Leads recebidos", m.leads)} />
              <Card tone="blue" icon={CalendarCheck} label="Leads Hoje" value={fmtInt(m.hoje.length)} onClick={open("Leads de hoje", m.hoje)} />
              <Card tone="blue" icon={TrendingUp} label="Média por Dia" value={m.mediaDia == null ? "—" : m.mediaDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} hint="Dias com leads" />
              <Card tone="blue" icon={Phone} label="Com Telefone" value={fmtInt(m.comTelefone.length)} hint={m.taxaTelefone == null ? "Sem leads no período" : `${fmtPct(m.taxaTelefone)} dos leads`} onClick={open("Leads com telefone", m.comTelefone)} />
            </div>
          </Section>

          <Section title="Campanhas" tone="purple">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card tone="purple" icon={Megaphone} label="Campanhas Distintas" value={fmtInt(m.campanhas.filter((c) => c.nome !== "Sem campanha").length)} />
              <Card tone="purple" icon={Target} label="Leads com Campanha" value={fmtInt(m.comCampanha.length)} hint={m.taxaCampanha == null ? "Sem leads no período" : `${fmtPct(m.taxaCampanha)} dos leads`} onClick={open("Leads com campanha", m.comCampanha)} />
              <Card tone="purple" icon={TrendingUp} label="Valor dos Negócios" value={fmtBRL(m.valor)} hint={m.valor == null ? "CRM não enviou valor" : "Soma enviada pelo CRM"} />
            </div>
            <Ranking grupos={m.campanhas} total={m.leads.length} onOpen={(g) => setAudit({ title: `Campanha: ${g.nome}`, rows: g.rows })} />
          </Section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <Section title="Origem" tone="teal">
              <Ranking grupos={m.origens} total={m.leads.length} onOpen={(g) => setAudit({ title: `Origem: ${g.nome}`, rows: g.rows })} />
            </Section>
            <Section title="Etapa no CRM" tone="orange">
              <Ranking grupos={m.etapas} total={m.leads.length} onOpen={(g) => setAudit({ title: `Etapa: ${g.nome}`, rows: g.rows })} icon={Waypoints} />
            </Section>
          </div>

          <Section title="Leads recebidos">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => csvDownload(`crm-leads-${range.de}-${range.ate}.csv`, [
                ["Recebido em", "Nome", "Telefone", "E-mail", "Campanha", "Origem", "Etapa", "Valor", "Doutor"],
                ...m.leads.map((r) => [fmtDateTime(r.recebido_em), r.nome, r.telefone, r.email, r.campanha, r.origem, r.etapa, r.valor, nomeCliente(r.cliente_id)]),
              ])}>Exportar CSV</Button>
            </div>
            <div className="overflow-x-auto rounded-2xl border bg-card p-2">
              <LeadRows rows={m.leads.slice(0, 200)} nomeCliente={nomeCliente} onPayload={setPayload} />
            </div>
            {m.leads.length > 200 && <p className="text-xs text-muted-foreground">Mostrando os 200 mais recentes de {fmtInt(m.leads.length)}. O CSV traz todos.</p>}
          </Section>
        </div>
      )}

      <Dialog open={!!audit} onOpenChange={(o) => !o && setAudit(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{audit?.title} · {audit?.rows.length} lead(s) do CRM</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-auto"><LeadRows rows={audit?.rows ?? []} nomeCliente={nomeCliente} onPayload={setPayload} /></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payload} onOpenChange={(o) => !o && setPayload(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Dados recebidos · {payload?.nome ?? "lead"}</DialogTitle></DialogHeader>
          <pre className="max-h-[65vh] overflow-auto rounded-xl bg-muted p-4 text-xs">{JSON.stringify(payload?.payload, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Ranking({ grupos, total, onOpen, icon: Icon = Megaphone }: { grupos: { nome: string; qtd: number; rows: CrmLead[] }[]; total: number; onOpen: (g: { nome: string; rows: CrmLead[] }) => void; icon?: typeof Megaphone }) {
  if (!grupos.length) return <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Nenhum lead no período.</div>;
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {grupos.slice(0, 10).map((g) => (
        <button key={g.nome} type="button" onClick={() => onOpen(g)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-muted/50">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={g.nome}>{g.nome}</span>
          <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-muted sm:block"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? (g.qtd / total) * 100 : 0}%` }} /></div>
          <span className="w-12 text-right text-sm tabular-nums">{fmtInt(g.qtd)}</span>
        </button>
      ))}
    </div>
  );
}

function LeadRows({ rows, nomeCliente, onPayload }: { rows: CrmLead[]; nomeCliente: (id: string | null) => string; onPayload: (r: CrmLead) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recebido em</TableHead><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Campanha</TableHead>
          <TableHead>Origem</TableHead><TableHead>Etapa</TableHead><TableHead>Doutor</TableHead><TableHead className="text-right">Dados</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhum lead recebido no período.</TableCell></TableRow>}
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.recebido_em)}</TableCell>
            <TableCell className="font-medium">{r.nome ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums" title="Número parcialmente oculto">{maskPhone(r.telefone)}</TableCell>
            <TableCell className="max-w-48 truncate" title={r.campanha ?? ""}>{r.campanha ?? "—"}</TableCell>
            <TableCell>{r.origem ?? "—"}</TableCell>
            <TableCell>{r.etapa ?? "—"}</TableCell>
            <TableCell>{nomeCliente(r.cliente_id)}</TableCell>
            <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => onPayload(r)}>Ver</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type Hook = { id: string; nome: string; token: string; cliente_id: string | null; ativo: boolean; ultimo_recebimento: string | null };

function Webhooks({ hooks, loading, clientes, onChange }: { hooks: Hook[] | undefined; loading: boolean; clientes: { id: string; nome: string }[]; onChange: () => void }) {
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState(NONE);
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (!nome.trim()) { toast.error("Dê um nome ao webhook"); return; }
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("crm_webhooks").insert({ nome: nome.trim(), cliente_id: cliente === NONE ? null : cliente, created_by: u.user?.id ?? null });
    setSalvando(false);
    if (error) { toast.error("Não foi possível criar o webhook"); return; }
    toast.success("Webhook criado. Copie o endereço e cole no CRM.");
    setNome(""); setCliente(NONE); onChange();
  };
  const atualizar = async (id: string, patch: { ativo?: boolean; cliente_id?: string | null }) => {
    const { error } = await supabase.from("crm_webhooks").update(patch).eq("id", id);
    if (error) toast.error("Não foi possível salvar"); else onChange();
  };
  const excluir = async (h: Hook) => {
    if (!window.confirm(`Excluir o webhook "${h.nome}" e todos os leads recebidos por ele?`)) return;
    const { error } = await supabase.from("crm_webhooks").delete().eq("id", h.id);
    if (error) toast.error("Não foi possível excluir"); else { toast.success("Webhook excluído"); onChange(); }
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Endereços de recebimento</h2>
        <p className="mt-1 text-sm text-muted-foreground">Copie o endereço e cadastre no CRM como webhook de <strong className="text-foreground">saída</strong> (HTTP POST, JSON) na automação da coluna. Quem tiver o endereço consegue enviar leads, então não compartilhe fora da equipe.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="w-64" placeholder="Nome (ex.: CRM · Dra. Thais)" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem doutor vinculado</SelectItem>
            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={criar} disabled={salvando}><Plus className="size-4" />Criar webhook</Button>
      </div>
      {loading ? <Skeleton className="h-16 w-full" /> : !hooks?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum webhook criado ainda.</p>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-muted p-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground">{h.nome} · último lead: {h.ultimo_recebimento ? fmtDateTime(h.ultimo_recebimento) : "nenhum ainda"}</div>
                <code className="block truncate text-xs text-muted-foreground">{webhookUrl(h.token)}</code>
              </div>
              <Select value={h.cliente_id ?? NONE} onValueChange={(v) => atualizar(h.id, { cliente_id: v === NONE ? null : v })}>
                <SelectTrigger className="w-52 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem doutor vinculado</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs"><Switch checked={h.ativo} onCheckedChange={(v) => atualizar(h.id, { ativo: v })} />{h.ativo ? "Ativo" : "Pausado"}</label>
              <Button size="sm" variant="outline" onClick={() => copy(webhookUrl(h.token))}><Copy className="size-3.5" />Copiar</Button>
              <Button size="icon" variant="ghost" title="Excluir" onClick={() => excluir(h)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
