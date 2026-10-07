import { useMemo, useState, type ReactNode } from "react";
import {
  Megaphone, MessagesSquare, Coins, Stethoscope, Wallet, Percent, UserCheck, BarChart3, CalendarCheck,
  HeartHandshake, Target, TrendingUp, CalendarClock, Receipt, Users, Search, Download, Sparkles,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeMetrics, type PanelData, type Venda } from "@/lib/metrics";
import { MES_LONGO, csvDownload, fmtBRL, fmtDate, fmtInt, fmtPct } from "@/lib/format";
import { STATUSES } from "@/lib/parse";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "orange" | "pink" | "teal" | "purple";
const TONE: Record<Tone, { title: string; icon: string }> = {
  blue: { title: "text-g-blue", icon: "bg-g-blue-soft text-g-blue" },
  green: { title: "text-g-green", icon: "bg-g-green-soft text-g-green" },
  orange: { title: "text-g-orange", icon: "bg-g-orange-soft text-g-orange" },
  pink: { title: "text-g-pink", icon: "bg-g-pink-soft text-g-pink" },
  teal: { title: "text-g-teal", icon: "bg-g-teal-soft text-g-teal" },
  purple: { title: "text-g-purple", icon: "bg-g-purple-soft text-g-purple" },
};

export const STATUS_STYLE: Record<string, string> = {
  "CONSULTA AGENDADA": "bg-g-blue-soft text-g-blue",
  "NÃO COMPARECEU": "bg-g-gray-soft text-g-gray",
  "COMPARECEU NÃO FECHOU": "bg-g-pink-soft text-g-pink",
  "AGUARDANDO SINAL": "bg-g-yellow-soft text-g-yellow",
  "EM NEGOCIAÇÃO": "bg-g-orange-soft text-g-orange",
  "VENDA REALIZADA": "bg-g-green-soft text-g-green",
  "PROCEDIMENTO REALIZADO | PAGO": "bg-g-darkgreen-soft text-g-darkgreen",
  DESMARCOU: "bg-g-gray-soft text-g-gray",
  "CIRURGIA DESMARCADA": "bg-g-red-soft text-g-red",
  DESQUALIFICADA: "bg-muted text-foreground",
};
export function StatusBadge({ s }: { s: string | null }) {
  if (!s) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[s] ?? "bg-muted text-muted-foreground")}>{s}</span>;
}

type Audit = { title: string; rows: Venda[] } | null;

function Section({ title, tone, children, className }: { title: string; tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <section className={cn("report-section space-y-3", className)}>
      <h2 className={cn("text-xs font-bold uppercase tracking-[0.14em]", tone ? TONE[tone].title : "text-muted-foreground")}>{title}</h2>
      {children}
    </section>
  );
}

function Card({ label, value, hint, icon: Icon, tone, onClick }: { label: string; value: string; hint?: string; icon: typeof Coins; tone: Tone; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn("report-metric group flex w-full items-start gap-4 rounded-2xl border bg-card p-5 text-left transition", onClick && "hover:-translate-y-0.5 hover:shadow-md")}
    >
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", TONE[tone].icon)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </button>
  );
}

const grid3 = "grid grid-cols-1 gap-4 md:grid-cols-3";

export function Dashboard({ data, clienteIds, de, ate, carteira, onSelectCliente }: {
  data: PanelData; clienteIds: string[]; de: string; ate: string; carteira: boolean; onSelectCliente?: ((id: string) => void) | undefined;
}) {
  const m = useMemo(() => computeMetrics(data, clienteIds, de, ate), [data, clienteIds, de, ate]);
  const [audit, setAudit] = useState<Audit>(null);
  const nomeCliente = (id: string) => data.clientes.find((c) => c.id === id)?.nome ?? "—";
  const open = (title: string, rows: Venda[]) => () => setAudit({ title, rows });

  return (
    <div className="report-dashboard space-y-10">
      <Section title="Anúncios" tone="blue">
        {m.investido == null && <p className="text-xs text-muted-foreground">Sem investimento lançado no período.</p>}
        <div className={grid3}>
          <Card tone="blue" icon={Megaphone} label="Valor Investido" value={fmtBRL(m.investido)} hint="Meta Ads + Google Ads" />
          <Card tone="blue" icon={MessagesSquare} label="Conversas Iniciadas" value={fmtInt(m.conversas)} hint="Total das plataformas" />
          <Card tone="blue" icon={Coins} label="Custo por Conversa" value={fmtBRL(m.cpc)} hint="Investido ÷ Conversas" />
        </div>
      </Section>

      <Section title="Comissões" tone="green">
        <div className={grid3}>
          <Card tone="green" icon={Stethoscope} label="Procedimentos Realizados" value={fmtInt(m.realizados.length)} onClick={open("Procedimentos realizados", m.realizados)} />
          <Card tone="green" icon={Wallet} label="Caixa Recebido" value={fmtBRL(m.caixa)} onClick={open("Caixa recebido", m.realizados)} />
          <Card tone="green" icon={Percent} label={`Comissão Total (${m.cfg.pct_total}%)`} value={fmtBRL(m.comTotal)} onClick={open("Comissão total", m.realizados)} />
          <Card tone="green" icon={UserCheck} label={`Comissão Hunter (${m.cfg.pct_hunter}%)`} value={fmtBRL(m.comHunter)} onClick={open("Comissão Hunter", m.realizados)} />
          <Card tone="green" icon={BarChart3} label={`Comissão Gestor de Performance (${m.cfg.pct_performance}%)`} value={fmtBRL(m.comPerf)} onClick={open("Comissão Performance", m.realizados)} />
          <Card tone="green" icon={Sparkles} label={`Comissão Atlas (${m.cfg.pct_atlas}%)`} value={fmtBRL(m.comAtlas)} onClick={open("Comissão Atlas", m.realizados)} />
        </div>
      </Section>

      <Section title="Consultas" tone="orange">
        <div className={grid3}>
          <Card tone="orange" icon={CalendarCheck} label="Consultas Agendadas" value={fmtInt(m.consultas)} onClick={open("Consultas no período", m.porConsulta)} />
          <Card tone="orange" icon={Users} label="Comparecimentos" value={fmtInt(m.comparec)} onClick={open("Comparecimentos", m.porConsulta.filter((r) => (r.comparecimentos ?? 0) > 0))} />
          <Card tone="orange" icon={Percent} label="Taxa de Comparecimento" value={fmtPct(m.taxaComp)} hint="Comparecimentos ÷ Consultas" />
        </div>
      </Section>

      <Section title="Taxa de conversão do doutor" tone="pink">
        <div className={grid3}>
          <Card tone="pink" icon={Users} label="Comparecimentos" value={fmtInt(m.comparec)} onClick={open("Comparecimentos", m.porConsulta.filter((r) => (r.comparecimentos ?? 0) > 0))} />
          <Card tone="pink" icon={HeartHandshake} label="Vendas Realizadas" value={fmtInt(m.vendasQtd)} hint={fmtBRL(m.valorVendido)} onClick={open("Vendas no período", m.porVenda)} />
          <Card tone="pink" icon={Percent} label="Taxa de Conversão" value={fmtPct(m.taxaConv)} hint="Vendas ÷ Comparecimentos" />
        </div>
      </Section>

      <Section title="Procedimentos projetados" tone="teal">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card tone="teal" icon={CalendarClock} label="Procedimentos Previstos" value={fmtInt(m.projetados.length)} onClick={open("Procedimentos previstos no período", m.projetados)} />
          <Card tone="teal" icon={TrendingUp} label="Faturamento Previsto" value={fmtBRL(m.fatPrev)} onClick={open("Faturamento previsto", m.projetados)} />
          <Card tone="teal" icon={Receipt} label="Ticket Médio" value={fmtBRL(m.ticketPrev)} />
          <Card tone="teal" icon={Target} label="Meta Esperada" value={fmtBRL(m.meta.min)} hint={m.pctMeta == null ? "Sem meta cadastrada" : `${fmtPct(m.pctMeta)} atingido`} />
        </div>
      </Section>

      <Section title="Faturamento futuro" tone="purple">
        <div className={grid3}>
          <Card tone="purple" icon={CalendarClock} label="Procedimentos" value={fmtInt(m.futuros.length)} hint="Cirurgias após o período" onClick={open("Cirurgias futuras", m.futuros)} />
          <Card tone="purple" icon={TrendingUp} label="Valor Previsto" value={fmtBRL(m.fatFut)} onClick={open("Valor previsto futuro", m.futuros)} />
          <Card tone="purple" icon={Receipt} label="Ticket Médio" value={fmtBRL(m.ticketFut)} />
        </div>
        <h3 className="pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Pipeline: próximos meses</h3>
        <div className={grid3}>
          {m.pipeline.map((p) => (
            <button key={`${p.ano}-${p.mes}`} onClick={open(`Pipeline ${MES_LONGO[p.mes - 1]}/${p.ano}`, p.rows)} className="rounded-2xl border bg-g-purple-soft/50 p-5 text-left transition hover:shadow-md">
              <div className="text-sm font-semibold text-g-purple">{MES_LONGO[p.mes - 1]} {p.ano}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{fmtBRL(p.valor)}</div>
              <div className="text-xs text-muted-foreground">{p.qtd} procedimento{p.qtd === 1 ? "" : "s"}</div>
            </button>
          ))}
        </div>
      </Section>

      <OrigemChart origens={m.origens} onOpen={(o, rows) => setAudit({ title: `Origem: ${o}`, rows })} />

      <LeadsTable leads={m.leads} nomeCliente={nomeCliente} />

      <Evolucao data={data} clienteIds={clienteIds} m={m} />

      {carteira && <Carteira data={data} clienteIds={clienteIds} de={de} ate={ate} onSelect={onSelectCliente} />}

      <Dialog open={!!audit} onOpenChange={(o) => !o && setAudit(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{audit?.title} · {audit?.rows.length} linha(s) da planilha</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-auto">
            <RowsTable rows={audit?.rows ?? []} nomeCliente={nomeCliente} withLine />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowsTable({ rows, nomeCliente, withLine }: { rows: Venda[]; nomeCliente: (id: string) => string; withLine?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {withLine && <TableHead>Linha</TableHead>}
          <TableHead>Nome do Lead</TableHead><TableHead>Doutor</TableHead><TableHead>Data da Consulta</TableHead>
          <TableHead>Data da Venda</TableHead><TableHead>Data da Cirurgia</TableHead><TableHead>Procedimento</TableHead>
          <TableHead className="text-right">Valor Fechado</TableHead>{withLine && <TableHead className="text-right">Caixa</TableHead>}<TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>}
        {rows.map((r) => (
          <TableRow key={r.id}>
            {withLine && <TableCell className="text-muted-foreground">{r.linha_planilha}</TableCell>}
            <TableCell className="font-medium">{r.lead_nome}</TableCell>
            <TableCell>{nomeCliente(r.cliente_id)}</TableCell>
            <TableCell>{fmtDate(r.data_consulta)}</TableCell>
            <TableCell>{fmtDate(r.data_venda)}</TableCell>
            <TableCell>{fmtDate(r.data_cirurgia)}</TableCell>
            <TableCell className="max-w-48 truncate">{r.procedimento ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtBRL(r.valor_fechado)}</TableCell>
            {withLine && <TableCell className="text-right tabular-nums">{fmtBRL(r.caixa_recebido)}</TableCell>}
            <TableCell><StatusBadge s={r.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrigemChart({ origens, onOpen }: { origens: { origem: string; qtd: number; valor: number; rows: Venda[] }[]; onOpen: (o: string, r: Venda[]) => void }) {
  const [modo, setModo] = useState<"qtd" | "valor">("qtd");
  return (
    <Section title="Origem dos clientes">
      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex justify-end gap-1 no-print">
          {(["qtd", "valor"] as const).map((k) => (
            <Button key={k} size="sm" variant={modo === k ? "default" : "outline"} onClick={() => setModo(k)}>{k === "qtd" ? "Quantidade" : "Faturamento"}</Button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={origens} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickFormatter={(v) => (modo === "valor" ? fmtBRL(v).replace(",00", "") : String(v))} fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="origem" width={110} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => (modo === "valor" ? fmtBRL(v) : v)} />
              <Bar dataKey={modo} fill="var(--chart-1)" radius={[0, 8, 8, 0]} onClick={(d: any) => onOpen(d.origem, d.rows)} cursor="pointer" name={modo === "qtd" ? "Quantidade" : "Faturamento"} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

function LeadsTable({ leads, nomeCliente }: { leads: Venda[]; nomeCliente: (id: string) => string }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("todos");
  const [page, setPage] = useState(0);
  const per = 15;
  const filtered = leads.filter((r) => (st === "todos" || r.status === st) && r.lead_nome.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const rows = filtered.slice(page * per, page * per + per);
  const exportCsv = () =>
    csvDownload("leads.csv", [
      ["Nome do Lead", "Doutor", "Data da Consulta", "Data da Venda", "Data da Cirurgia", "Procedimento", "Valor Fechado", "Status"],
      ...filtered.map((r) => [r.lead_nome, nomeCliente(r.cliente_id), fmtDate(r.data_consulta), fmtDate(r.data_venda), fmtDate(r.data_cirurgia), r.procedimento, r.valor_fechado, r.status]),
    ]);
  return (
    <Section className="report-leads" title={`Leads no período · ${filtered.length} lead${filtered.length === 1 ? "" : "s"}`}>
      {(q || st !== "todos") && <p className="print-only text-xs text-muted-foreground">{q ? `Busca: ${q}` : ""}{q && st !== "todos" ? " · " : ""}{st !== "todos" ? `Status: ${st}` : ""}</p>}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap gap-2 no-print">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <Select value={st} onValueChange={(v) => { setSt(v); setPage(0); }}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download className="size-4" />Exportar CSV</Button>
        </div>
        <div className="no-print overflow-x-auto"><RowsTable rows={rows} nomeCliente={nomeCliente} /></div>
        <div className="print-only"><RowsTable rows={filtered} nomeCliente={nomeCliente} /></div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm no-print">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="text-muted-foreground">{page + 1} de {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function Evolucao({ data, clienteIds, m }: { data: PanelData; clienteIds: string[]; m: ReturnType<typeof computeMetrics> }) {
  const caixa = m.caixa ?? 0;
  const metas = [
    { k: "Meta Mínima", v: m.meta.min },
    { k: "Meta Ideal", v: m.meta.ideal },
    { k: "Supermeta", v: m.meta.sup },
  ];
  const semanal = useMemo(() => {
    const byLabel = new Map<string, { semana: string; Consultas: number; Comparecimentos: number; Vendas: number; Cirurgias: number; ordem: number }>();
    data.acompanhamento.filter((a) => clienteIds.includes(a.cliente_id)).forEach((a) => {
      const k = a.semana_label ?? "";
      const e = byLabel.get(k) ?? { semana: k, Consultas: 0, Comparecimentos: 0, Vendas: 0, Cirurgias: 0, ordem: a.ordem };
      e.Consultas += a.consultas_agendadas ?? 0; e.Comparecimentos += a.comparecimentos ?? 0; e.Vendas += a.vendas ?? 0; e.Cirurgias += a.cirurgias ?? 0;
      byLabel.set(k, e);
    });
    return [...byLabel.values()].sort((a, b) => a.ordem - b.ordem);
  }, [data.acompanhamento, clienteIds]);
  const funil = [
    { k: "Consultas", v: m.consultas ?? 0 },
    { k: "Comparecimentos", v: m.comparec ?? 0 },
    { k: "Vendas", v: m.vendasQtd ?? 0 },
    { k: "Cirurgias realizadas", v: m.realizados.length },
  ];
  const max = Math.max(1, ...funil.map((f) => f.v));
  return (
    <Section title="Evolução e metas">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="text-sm font-semibold">Caixa recebido vs. metas · {fmtBRL(m.caixa)}</div>
          {metas.map(({ k, v }) => {
            const pct = v ? caixa / v : null;
            return (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{k} · {fmtBRL(v)}</span><span className="font-semibold">{fmtPct(pct)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (pct ?? 0) * 100)}%` }} /></div>
              </div>
            );
          })}
          <div className="pt-2 text-sm font-semibold">Funil</div>
          {funil.map((f) => (
            <div key={f.k} className="flex items-center gap-3 text-xs">
              <span className="w-36 text-muted-foreground">{f.k}</span>
              <div className="h-6 flex-1 rounded-md bg-muted"><div className="flex h-full items-center rounded-md bg-g-teal px-2 font-semibold text-primary-foreground" style={{ width: `${Math.max(6, (f.v / max) * 100)}%` }}>{fmtInt(f.v)}</div></div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3 text-sm font-semibold">Acompanhamento semanal</div>
          {semanal.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Sem dados semanais sincronizados.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={semanal}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis dataKey="semana" fontSize={10} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip /><Legend />
                  <Line dataKey="Consultas" stroke="var(--chart-1)" strokeWidth={2} />
                  <Line dataKey="Comparecimentos" stroke="var(--chart-2)" strokeWidth={2} />
                  <Line dataKey="Vendas" stroke="var(--chart-4)" strokeWidth={2} />
                  <Line dataKey="Cirurgias" stroke="var(--chart-5)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Carteira({ data, clienteIds, de, ate, onSelect }: { data: PanelData; clienteIds: string[]; de: string; ate: string; onSelect?: ((id: string) => void) | undefined }) {
  const rows = clienteIds.map((id) => {
    const m = computeMetrics(data, [id], de, ate);
    const pct = m.meta.min ? (m.fatPrev ?? 0) / m.meta.min : null;
    return { id, nome: data.clientes.find((c) => c.id === id)?.nome ?? "—", m, pct };
  }).sort((a, b) => (b.m.fatPrev ?? 0) - (a.m.fatPrev ?? 0));
  const light = (p: number | null) => (p == null ? "bg-muted" : p >= 1 ? "bg-g-green" : p >= 0.6 ? "bg-g-yellow" : "bg-g-red");
  return (
    <Section title="Visão da carteira">
      <div className="overflow-x-auto rounded-2xl border bg-card p-2">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Saúde</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Consultas</TableHead>
            <TableHead className="text-right">Comparec. %</TableHead><TableHead className="text-right">Conversão %</TableHead>
            <TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Faturamento</TableHead>
            <TableHead className="text-right">Caixa recebido</TableHead><TableHead className="text-right">% da meta</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => onSelect?.(r.id)}>
                <TableCell><span className={cn("inline-block size-3 rounded-full", light(r.pct))} /></TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(r.m.consultas)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(r.m.taxaComp)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(r.m.taxaConv)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(r.m.vendasQtd)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(r.m.fatPrev)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(r.m.caixa)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(r.pct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}
