import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarCheck, CalendarClock, Clapperboard, Copy, ExternalLink, FileDown, HeartHandshake, Layers, Megaphone, Percent, Phone, Plus, Receipt, RefreshCw, Scissors,
  Sheet, Target, Trash2, TrendingUp, UserX, Users, Waypoints, Webhook,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminOnly, useConfig } from "@/components/atlas/AppShell";
import { PanelTitle, PrintFooter } from "@/components/atlas/PanelHeader";
import { Card, Section } from "@/components/atlas/Dashboard";
import { computeCrmMetrics, dataLead, isVenda, maskPhone, type CrmLead } from "@/lib/crm";
import { syncCrmNow } from "@/lib/crm.functions";
import { printPanel } from "@/lib/print-panel";
import { extractSpreadsheetId } from "@/lib/parse";
import { csvDownload, fmtBRL, fmtDate, fmtDateTime, fmtInt, fmtPct, presetRange, type Preset } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "CRM · Atlas" },
      { name: "description", content: "Leads e vendas do CRM por planilha ou webhook (teste)." },
      { property: "og:title", content: "CRM · Atlas" },
      { property: "og:description", content: "Leads e vendas do CRM por planilha ou webhook (teste)." },
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
const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copiado"), () => toast.error("Não foi possível copiar"));
}

type Audit = { title: string; rows: CrmLead[] } | null;

function Crm() {
  const qc = useQueryClient();
  const cfg = useConfig();
  const [preset, setPreset] = useState<Preset>("este-mes");
  const [custom, setCustom] = useState(() => presetRange("este-mes"));
  const range = preset === "custom" ? custom : presetRange(preset);
  const [fonteFiltro, setFonteFiltro] = useState("todos");
  const [audit, setAudit] = useState<Audit>(null);
  const [payload, setPayload] = useState<CrmLead | null>(null);

  const clientes = useQuery({ queryKey: ["clientes"], queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [] });
  const fontes = useQuery({
    queryKey: ["crm-webhooks"],
    queryFn: async () => (await supabase.from("crm_webhooks").select("*").order("created_at")).data ?? [],
    refetchInterval: 30_000,
  });
  // All leads of the selected sources: sales are dated by stage changes, which can fall outside the lead's creation period.
  const leads = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_leads").select("*").order("recebido_em", { ascending: false }).limit(10000);
      if (error) throw error;
      return data as CrmLead[];
    },
    refetchInterval: 30_000,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["crm-webhooks"] }); qc.invalidateQueries({ queryKey: ["crm-leads"] }); };

  const rows = useMemo(() => (leads.data ?? []).filter((r) => fonteFiltro === "todos" || r.webhook_id === fonteFiltro), [leads.data, fonteFiltro]);
  const m = useMemo(() => computeCrmMetrics(rows, range.de, range.ate), [rows, range.de, range.ate]);
  const open = (title: string, rs: CrmLead[]) => () => setAudit({ title, rows: rs });
  const nomeCliente = (id: string | null) => clientes.data?.find((c) => c.id === id)?.nome ?? "—";
  const fonteNome = fonteFiltro === "todos" ? "Todas as fontes" : fontes.data?.find((f) => f.id === fonteFiltro)?.nome ?? "CRM";
  const ultimaLeitura = (fontes.data ?? []).filter((f) => fonteFiltro === "todos" || f.id === fonteFiltro).map((f) => f.ultimo_recebimento).filter(Boolean).sort().at(-1) ?? null;
  const temCampanha = m.leads.some((r) => r.campanha || r.conjunto || r.criativo || r.origem);

  return (
    <div className="panel-report space-y-8">
      <PanelTitle
        logoUrl={cfg.data?.logo_url} title="Relatório CRM" de={range.de} ate={range.ate} clienteNome={fonteNome} lastSync={ultimaLeitura}
        subtitle="Teste · leads e vendas do CRM lidos de uma planilha (exportação do CRM) ou recebidos por webhook. Não altera os Portais nem o Painel."
      />

      <div className="no-print"><Fontes fontes={fontes.data} loading={fontes.isLoading} clientes={clientes.data ?? []} onChange={refresh} /></div>

      <div className="no-print sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-y bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Select value={fonteFiltro} onValueChange={setFonteFiltro}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as fontes</SelectItem>
            {fontes.data?.map((h) => <SelectItem key={h.id} value={h.id}>{h.nome}</SelectItem>)}
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
        <span className="text-xs text-muted-foreground">Leads pela data de criação · vendas pela data em que entraram em Venda Realizada</span>
        <Button size="sm" className="ml-auto" disabled={!leads.data} onClick={() => void printPanel(fonteNome, range.de, range.ate)}><FileDown className="size-4" />Exportar PDF</Button>
      </div>

      {leads.isLoading ? <Skeleton className="h-64 w-full" /> : leads.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar os leads do CRM.</p>
      ) : (
        <div className="report-dashboard space-y-10">
          <Section title="Leads" tone="blue">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card tone="blue" icon={Users} label="Novos Leads" value={fmtInt(m.leads.length)} hint="Criados no período" onClick={open("Novos leads", m.leads)} />
              <Card tone="blue" icon={CalendarCheck} label="Leads Hoje" value={fmtInt(m.hoje.length)} onClick={open("Leads de hoje", m.hoje)} />
              <Card tone="blue" icon={TrendingUp} label="Média por Dia" value={m.mediaDia == null ? "—" : m.mediaDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} hint="Dias com leads" />
              <Card tone="blue" icon={Phone} label="Com Telefone" value={fmtInt(m.comTelefone.length)} hint={m.taxaTelefone == null ? "Sem leads no período" : `${fmtPct(m.taxaTelefone)} dos leads`} onClick={open("Leads com telefone", m.comTelefone)} />
            </div>
          </Section>

          <Section title="Vendas" tone="green">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card tone="green" icon={HeartHandshake} label="Vendas Realizadas" value={fmtInt(m.vendas.length)} hint={`${fmtInt(m.vendasComValor.length)} com valor lançado`} onClick={open("Vendas realizadas no período", m.vendas)} />
              <Card tone="green" icon={TrendingUp} label="Faturamento" value={fmtBRL(m.faturamento)} hint="Soma dos valores das vendas" onClick={open("Vendas com valor", m.vendasComValor)} />
              <Card tone="green" icon={Receipt} label="Ticket Médio" value={fmtBRL(m.ticket)} hint="Faturamento ÷ vendas com valor" />
              <Card tone="green" icon={Percent} label="Taxa de Conversão" value={fmtPct(m.taxaConversao)} hint="Novos leads que já viraram venda" />
              <Card tone="green" icon={CalendarClock} label="Tempo até a Venda" value={m.cicloMedio == null ? "—" : `${m.cicloMedio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`} hint="Média da criação até a venda" />
              <Card tone="green" icon={UserX} label="Perdidos" value={fmtInt(m.perdidos.length)} hint="Novos leads marcados como perdidos" onClick={open("Leads perdidos", m.perdidos)} />
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <Section title="Funil · etapa atual dos novos leads" tone="orange">
              <Ranking grupos={m.etapas} total={m.leads.length} icon={Waypoints} onOpen={(g) => setAudit({ title: `Etapa: ${g.nome}`, rows: g.rows })} />
            </Section>
            <Section title="Produtos e serviços vendidos" tone="teal">
              <Ranking grupos={m.produtos} total={m.vendas.length} icon={Scissors} comValor onOpen={(g) => setAudit({ title: `Produto/serviço: ${g.nome}`, rows: g.rows })} />
            </Section>
          </div>

          <Section title="Campanhas" tone="purple">
            {temCampanha ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card tone="purple" icon={Megaphone} label="Campanhas" value={fmtInt(m.campanhas.filter((c) => c.nome !== "Sem campanha").length)} hint="Distintas no período" />
                  <Card tone="purple" icon={Layers} label="Conjuntos" value={fmtInt(m.conjuntos.filter((c) => c.nome !== "Sem conjunto").length)} hint="Distintos no período" />
                  <Card tone="purple" icon={Clapperboard} label="Criativos" value={fmtInt(m.criativos.filter((c) => c.nome !== "Sem criativo").length)} hint="Distintos no período" />
                  <Card tone="purple" icon={Target} label="Leads com Campanha" value={fmtInt(m.comCampanha.length)} hint={m.taxaCampanha == null ? "Sem leads no período" : `${fmtPct(m.taxaCampanha)} dos leads`} onClick={open("Leads com campanha", m.comCampanha)} />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Por campanha · vendas</h3>
                    <Ranking grupos={m.campanhas} total={m.leads.length} vendas onOpen={(g) => setAudit({ title: `Campanha: ${g.nome}`, rows: g.rows })} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Por conjunto · vendas</h3>
                    <Ranking grupos={m.conjuntos} total={m.leads.length} icon={Layers} vendas onOpen={(g) => setAudit({ title: `Conjunto: ${g.nome}`, rows: g.rows })} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Por criativo · vendas</h3>
                    <Ranking grupos={m.criativos} total={m.leads.length} icon={Clapperboard} vendas onOpen={(g) => setAudit({ title: `Criativo: ${g.nome}`, rows: g.rows })} />
                  </div>
                </div>
                {m.origens.some((o) => o.nome !== "SEM ORIGEM") && (
                  <Ranking grupos={m.origens} total={m.leads.length} onOpen={(g) => setAudit({ title: `Origem: ${g.nome}`, rows: g.rows })} />
                )}
              </>
            ) : (
              <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Os leads do período não trazem campanha nem origem. A exportação padrão do CRM não inclui esses campos; adicione colunas "Campanha", "Conjunto" e "Criativo" na planilha para preencher esta seção.</div>
            )}
          </Section>

          <Section title="Negócios do período" className="report-leads">
            <div className="no-print flex justify-end">
              <Button size="sm" variant="outline" onClick={() => csvDownload(`crm-${range.de}-${range.ate}.csv`, [
                ["Criado em", "Nome", "Telefone", "E-mail", "Produto/Serviço", "Etapa", "Situação", "Valor", "Campanha", "Conjunto", "Criativo", "Origem", "Fonte"],
                ...m.leads.map((r) => [fmtDateTime(dataLead(r)), r.nome, r.telefone, r.email, r.produto, r.etapa, r.situacao, r.valor, r.campanha, r.conjunto, r.criativo, r.origem, fontes.data?.find((f) => f.id === r.webhook_id)?.nome ?? ""]),
              ])}>Exportar CSV</Button>
            </div>
            <div className="no-print overflow-x-auto rounded-2xl border bg-card p-2">
              <LeadRows rows={m.leads.slice(0, 200)} nomeCliente={nomeCliente} onPayload={setPayload} />
            </div>
            {/* The printed report always lists every lead of the period. */}
            <div className="print-only"><LeadRows rows={m.leads} nomeCliente={nomeCliente} onPayload={setPayload} /></div>
            {m.leads.length > 200 && <p className="no-print text-xs text-muted-foreground">Mostrando os 200 mais recentes de {fmtInt(m.leads.length)}. O CSV e o PDF trazem todos.</p>}
          </Section>
        </div>
      )}

      <PrintFooter />

      <Dialog open={!!audit} onOpenChange={(o) => !o && setAudit(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{audit?.title} · {audit?.rows.length} negócio(s) do CRM</DialogTitle></DialogHeader>
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

type Grupo = { nome: string; qtd: number; valor: number; rows: CrmLead[] };

function Ranking({ grupos, total, onOpen, icon: Icon = Megaphone, comValor, vendas }: { grupos: Grupo[]; total: number; onOpen: (g: Grupo) => void; icon?: typeof Megaphone; comValor?: boolean; vendas?: boolean }) {
  if (!grupos.length) return <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Nenhum registro no período.</div>;
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {grupos.slice(0, 10).map((g) => {
        const qtdVendas = g.rows.filter(isVenda).length;
        return (
          <button key={g.nome} type="button" onClick={() => onOpen(g)} className="block w-full space-y-2 px-5 py-3.5 text-left transition hover:bg-muted/50">
            <div className="flex items-start gap-2.5">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">{g.nome}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtInt(g.qtd)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? (g.qtd / total) * 100 : 0}%` }} /></div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{fmtPct(total ? g.qtd / total : null)} do total</span>
              {vendas && <span className="font-medium text-g-green">{fmtInt(qtdVendas)} venda{qtdVendas === 1 ? "" : "s"} · {fmtPct(g.qtd ? qtdVendas / g.qtd : null)} conversão</span>}
              {comValor && <span className="font-medium text-foreground">{fmtBRL(g.valor)}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LeadRows({ rows, nomeCliente, onPayload }: { rows: CrmLead[]; nomeCliente: (id: string | null) => string; onPayload: (r: CrmLead) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Criado em</TableHead><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Produto/Serviço</TableHead>
          <TableHead>Etapa</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Campanha</TableHead><TableHead>Conjunto</TableHead><TableHead>Criativo</TableHead><TableHead>Cliente</TableHead><TableHead className="no-print text-right">Dados</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={11} className="py-10 text-center text-muted-foreground">Nenhum negócio no período.</TableCell></TableRow>}
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(dataLead(r))}</TableCell>
            <TableCell className="font-medium">{r.nome ?? <span className="text-muted-foreground">Sem nome</span>}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums" title="Número parcialmente oculto">{maskPhone(r.telefone)}</TableCell>
            <TableCell className="max-w-40 truncate">{r.produto ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap">{r.etapa ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtBRL(r.valor)}</TableCell>
            <TableCell className="max-w-40 truncate" title={r.campanha ?? ""}>{r.campanha ?? "—"}</TableCell>
            <TableCell className="max-w-40 truncate" title={r.conjunto ?? ""}>{r.conjunto ?? "—"}</TableCell>
            <TableCell className="max-w-40 truncate" title={r.criativo ?? ""}>{r.criativo ?? "—"}</TableCell>
            <TableCell>{nomeCliente(r.cliente_id)}</TableCell>
            <TableCell className="no-print text-right"><Button size="sm" variant="ghost" onClick={() => onPayload(r)}>Ver</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type Fonte = { id: string; nome: string; token: string; cliente_id: string | null; ativo: boolean; ultimo_recebimento: string | null; spreadsheet_id: string | null; aba: string | null; ultimo_erro: string | null };

function Fontes({ fontes, loading, clientes, onChange }: { fontes: Fonte[] | undefined; loading: boolean; clientes: { id: string; nome: string }[]; onChange: () => void }) {
  const syncFn = useServerFn(syncCrmNow);
  const [tipo, setTipo] = useState<"planilha" | "webhook">("planilha");
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [aba, setAba] = useState("");
  const [cliente, setCliente] = useState(NONE);
  const [salvando, setSalvando] = useState(false);
  const [lendo, setLendo] = useState<string | null>(null);

  const ler = async (id: string) => {
    setLendo(id);
    try {
      const [r] = await syncFn({ data: { id } });
      if (!r) toast.error("Fonte pausada ou sem planilha");
      else if (r.ok) toast.success(`Planilha lida: ${r.linhas} negócio(s)`);
      else toast.error(`Não foi possível ler a planilha: ${r.erro}`);
    } catch {
      toast.error("Não foi possível ler a planilha agora.");
    } finally {
      setLendo(null);
      onChange();
    }
  };

  const criar = async () => {
    if (!nome.trim()) { toast.error("Dê um nome à fonte"); return; }
    const spreadsheetId = tipo === "planilha" ? extractSpreadsheetId(url) : null;
    if (tipo === "planilha" && !spreadsheetId) { toast.error("Cole o link da planilha do Google"); return; }
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("crm_webhooks").insert({
      nome: nome.trim(), cliente_id: cliente === NONE ? null : cliente, created_by: u.user?.id ?? null,
      spreadsheet_id: spreadsheetId, aba: tipo === "planilha" && aba.trim() ? aba.trim() : null,
    }).select("id").single();
    setSalvando(false);
    if (error) { toast.error("Não foi possível criar a fonte"); return; }
    setNome(""); setUrl(""); setAba(""); setCliente(NONE); onChange();
    if (tipo === "planilha") { toast.success("Planilha cadastrada. Lendo agora…"); await ler(data.id); }
    else toast.success("Webhook criado. Copie o endereço e cole no CRM.");
  };
  const atualizar = async (id: string, patch: { ativo?: boolean; cliente_id?: string | null }) => {
    const { error } = await supabase.from("crm_webhooks").update(patch).eq("id", id);
    if (error) toast.error("Não foi possível salvar"); else onChange();
  };
  const excluir = async (h: Fonte) => {
    if (!window.confirm(`Excluir a fonte "${h.nome}" e todos os negócios lidos dela?`)) return;
    const { error } = await supabase.from("crm_webhooks").delete().eq("id", h.id);
    if (error) toast.error("Não foi possível excluir"); else { toast.success("Fonte excluída"); onChange(); }
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Fontes de dados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="text-foreground">Planilha:</strong> cole a exportação do CRM numa planilha do Google compartilhada com a conta dos Portais; o painel só lê, a cada 15 minutos.{" "}
          <strong className="text-foreground">Webhook:</strong> endereço para um sistema enviar leads (HTTP POST, JSON); não compartilhe fora da equipe.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={tipo} onValueChange={(v) => setTipo(v as "planilha" | "webhook")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="planilha">Planilha</SelectItem><SelectItem value="webhook">Webhook</SelectItem></SelectContent>
        </Select>
        <Input className="w-56" placeholder="Nome (ex.: Barbearia · CRM)" value={nome} onChange={(e) => setNome(e.target.value)} />
        {tipo === "planilha" && (
          <>
            <Input className="w-72" placeholder="https://docs.google.com/spreadsheets/d/…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Input className="w-36" placeholder="Aba (opcional)" value={aba} onChange={(e) => setAba(e.target.value)} />
          </>
        )}
        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem cliente vinculado</SelectItem>
            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={criar} disabled={salvando}><Plus className="size-4" />Adicionar</Button>
      </div>
      {loading ? <Skeleton className="h-16 w-full" /> : !fontes?.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {fontes.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-muted p-3">
              {h.spreadsheet_id ? <Sheet className="size-4 shrink-0 text-g-green" /> : <Webhook className="size-4 shrink-0 text-g-purple" />}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground">
                  {h.nome} · {h.spreadsheet_id ? `planilha${h.aba ? ` (${h.aba})` : ""} · última leitura` : "webhook · último lead"}: {h.ultimo_recebimento ? fmtDateTime(h.ultimo_recebimento) : "nenhum ainda"}
                </div>
                {h.spreadsheet_id ? (
                  <a className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground underline" href={sheetUrl(h.spreadsheet_id)} target="_blank" rel="noreferrer">Abrir planilha<ExternalLink className="size-3" /></a>
                ) : (
                  <code className="block truncate text-xs text-muted-foreground">{webhookUrl(h.token)}</code>
                )}
                {h.ultimo_erro && <p className="mt-1 text-xs text-g-red">{h.ultimo_erro}</p>}
              </div>
              <Select value={h.cliente_id ?? NONE} onValueChange={(v) => atualizar(h.id, { cliente_id: v === NONE ? null : v })}>
                <SelectTrigger className="w-52 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem cliente vinculado</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs"><Switch checked={h.ativo} onCheckedChange={(v) => atualizar(h.id, { ativo: v })} />{h.ativo ? "Ativo" : "Pausado"}</label>
              {h.spreadsheet_id ? (
                <Button size="sm" variant="outline" onClick={() => ler(h.id)} disabled={lendo === h.id || !h.ativo}><RefreshCw className={lendo === h.id ? "size-3.5 animate-spin" : "size-3.5"} />{lendo === h.id ? "Lendo…" : "Ler agora"}</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => copy(webhookUrl(h.token))}><Copy className="size-3.5" />Copiar</Button>
              )}
              <Button size="icon" variant="ghost" title="Excluir" onClick={() => excluir(h)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
