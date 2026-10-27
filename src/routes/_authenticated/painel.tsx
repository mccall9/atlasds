import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, FileDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dashboard } from "@/components/atlas/Dashboard";
import { PanelTitle } from "@/components/atlas/PanelHeader";
import { useConfig, useRole } from "@/components/atlas/AppShell";
import { loadPanelData } from "@/lib/panel-data";
import { usePanelFreshness } from "@/hooks/use-panel-freshness";
import { syncNow } from "@/lib/sync.functions";
import { printPanel } from "@/lib/print-panel";
import { fmtDate, fmtDateTime, presetRange, type Preset } from "@/lib/format";

const search = z.object({
  cliente: z.string().optional().catch(undefined),
  preset: z.enum(["este-mes", "mes-passado", "30d", "trimestre", "custom"]).optional().catch(undefined),
  de: z.string().optional().catch(undefined),
  ate: z.string().optional().catch(undefined),
  hunter: z.string().optional().catch(undefined),
  perf: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/painel")({
  validateSearch: search,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Painel de Resultados · Atlas" },
      { name: "description", content: "Investimento, consultas, conversão, vendas, comissões e previsibilidade por cliente." },
      { property: "og:title", content: "Painel de Resultados · Atlas" },
      { property: "og:description", content: "Investimento, consultas, conversão, vendas, comissões e previsibilidade por cliente." },
    ],
  }),
  component: Painel,
});

const PRESETS: { v: Preset; l: string }[] = [
  { v: "este-mes", l: "Este mês" },
  { v: "mes-passado", l: "Mês passado" },
  { v: "30d", l: "Últimos 30 dias" },
  { v: "trimestre", l: "Este trimestre" },
  { v: "custom", l: "Personalizado" },
];

function Painel() {
  usePanelFreshness();
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/painel" });
  const qc = useQueryClient();
  const cfg = useConfig();
  const role = useRole();
  const canSync = role.data === "admin" || role.data === "equipe";
  const q = useQuery({ queryKey: ["panel"], queryFn: loadPanelData });
  const sync = useServerFn(syncNow);
  const mut = useMutation({
    mutationFn: () => sync({ data: s.cliente ? { clienteId: s.cliente } : {} }),
    onSuccess: (r) => {
      const err = r.filter((x) => !x.ok).length;
      err ? toast.warning(`Atualizado com ${err} portal(is) com erro`) : toast.success("Dados atualizados");
      qc.invalidateQueries({ queryKey: ["panel"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar"),
  });

  const preset = s.preset ?? "este-mes";
  const range = preset === "custom" && s.de && s.ate ? { de: s.de, ate: s.ate } : presetRange(preset === "custom" ? "este-mes" : preset);
  const set = (patch: Partial<z.infer<typeof search>>) => nav({ search: (old) => ({ ...old, ...patch }), replace: true });

  const data = q.data;
  const hunters = useMemo(() => [...new Set(data?.clientes.map((c) => c.hunter).filter(Boolean) as string[])].sort(), [data]);
  const perfs = useMemo(() => [...new Set(data?.clientes.map((c) => c.performance).filter(Boolean) as string[])].sort(), [data]);
  const carteira = !s.cliente;
  const clienteIds = useMemo(() => {
    if (!data) return [];
    if (s.cliente) return [s.cliente];
    return data.clientes.filter((c) => (!s.hunter || c.hunter === s.hunter) && (!s.perf || c.performance === s.perf)).map((c) => c.id);
  }, [data, s.cliente, s.hunter, s.perf]);
  const lastSync = data?.clientes.map((c) => c.last_sync_at).filter(Boolean).sort().pop();
  const falhas = data?.clientes.filter((c) => clienteIds.includes(c.id) && c.last_sync_error) ?? [];
  const clienteNome = s.cliente ? data?.clientes.find((c) => c.id === s.cliente)?.nome ?? "" : "Todos os clientes (carteira)";

  return (
    <div className="panel-report space-y-6">
      <div className="report-title flex flex-wrap items-end justify-between gap-4">
        <PanelTitle logoUrl={cfg.data?.logo_url} de={range.de} ate={range.ate} clienteNome={clienteNome} lastSync={lastSync} filters={[s.hunter && `Hunter: ${s.hunter}`, s.perf && `Performance: ${s.perf}`].filter(Boolean).join(" · ")} />
        <div className="no-print flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Última atualização: {fmtDateTime(lastSync)}<br />Atualização automática: a cada 15 minutos</span>
          {canSync && <Button variant="outline" size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
            <RefreshCw className={mut.isPending ? "size-4 animate-spin" : "size-4"} />{mut.isPending ? "Atualizando…" : "Atualizar agora"}
          </Button>}
          <Button size="sm" disabled={!data || q.isError || mut.isPending} onClick={() => void printPanel(clienteNome, range.de, range.ate)}><FileDown className="size-4" />Exportar PDF</Button>
        </div>
      </div>

      <div className="no-print sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-y bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Select value={s.cliente ?? "todos"} onValueChange={(v) => set({ cliente: v === "todos" ? undefined : v })}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes (carteira)</SelectItem>
            {data?.clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={preset} onValueChange={(v) => set(v === "custom" ? { preset: "custom", ...range } : { preset: v as Preset, de: undefined, ate: undefined })}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{PRESETS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
        </Select>
        {preset === "custom" ? (
          <>
            <Input type="date" className="w-40" value={range.de} onChange={(e) => set({ de: e.target.value })} />
            <Input type="date" className="w-40" value={range.ate} onChange={(e) => set({ ate: e.target.value })} />
          </>
        ) : (
          <span className="text-sm font-medium">{fmtDate(range.de)} - {fmtDate(range.ate)}</span>
        )}
        {carteira && (
          <>
            <Select value={s.hunter ?? "todos"} onValueChange={(v) => set({ hunter: v === "todos" ? undefined : v })}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Hunter" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos os hunters</SelectItem>{hunters.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={s.perf ?? "todos"} onValueChange={(v) => set({ perf: v === "todos" ? undefined : v })}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Performance" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Toda a performance</SelectItem>{perfs.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </>
        )}
      </div>

      {falhas.length > 0 && (
        <div className="report-warning space-y-1 rounded-xl border border-g-orange/30 bg-g-orange-soft px-4 py-2 text-xs text-g-orange">
          {falhas.map((c) => <div key={c.id} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>{c.last_sync_at ? `${c.nome}: exibindo dados da última leitura (${fmtDateTime(c.last_sync_at)}). A atualização não foi concluída.` : `Dados de ${c.nome} ainda indisponíveis.`}</span></div>)}
        </div>
      )}

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : q.isError ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-destructive">Não foi possível carregar os dados. <Button variant="link" onClick={() => q.refetch()}>Tentar de novo</Button></div>
      ) : data && data.vendas.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Ainda não há dados sincronizados dos Portais.</p>
          {canSync && <Button className="mt-4" onClick={() => mut.mutate()} disabled={mut.isPending}>Sincronizar agora</Button>}
        </div>
      ) : data ? (
        <Dashboard data={data} clienteIds={clienteIds} de={range.de} ate={range.ate} carteira={carteira} onSelectCliente={(id) => set({ cliente: id })} />
      ) : null}
    </div>
  );
}
