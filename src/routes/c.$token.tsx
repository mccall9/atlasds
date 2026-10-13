import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dashboard } from "@/components/atlas/Dashboard";
import { PanelTitle, PrintFooter } from "@/components/atlas/PanelHeader";
import { getSharedPanel } from "@/lib/sync.functions";
import { fmtDate, fmtDateTime, presetRange, type Preset } from "@/lib/format";
import type { PanelData } from "@/lib/metrics";
import { printPanel } from "@/lib/print-panel";
import { ThemeToggle } from "@/components/atlas/ThemeToggle";

export const Route = createFileRoute("/c/$token")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Seu Painel de Resultados · Atlas" },
      { name: "description", content: "Painel de resultados do cliente Atlas Assessoria." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Seu Painel de Resultados · Atlas" },
      { property: "og:description", content: "Painel de resultados do cliente Atlas Assessoria." },
    ],
  }),
  ssr: false,
  component: SharedPanel,
});

function SharedPanel() {
  const { token } = Route.useParams();
  const [preset, setPreset] = useState<Exclude<Preset, "custom">>("este-mes");
  const q = useQuery({ queryKey: ["shared", token], queryFn: () => getSharedPanel({ data: { token } }), refetchInterval: (query) => query.state.error || query.state.data === null ? false : 60_000, retry: false });
  const range = presetRange(preset);
  if (q.isLoading) return <div className="mx-auto max-w-7xl p-8"><Skeleton className="h-96 rounded-2xl" /></div>;
  if (!q.data) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Link inválido ou expirado.</div>;
  const data = q.data as unknown as PanelData;
  const c = data.clientes[0];
  if (!c) return null;
  return (
    <main className="panel-report mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <div className="report-title flex flex-wrap items-end justify-between gap-4">
        <PanelTitle de={range.de} ate={range.ate} clienteNome={c.nome} lastSync={c.last_sync_at} subtitle={`${c.nome} · Última atualização: ${fmtDateTime(c.last_sync_at)}`} />
        <div className="no-print flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <Select value={preset} onValueChange={(v) => setPreset(v as typeof preset)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="este-mes">Este mês</SelectItem><SelectItem value="mes-passado">Mês passado</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem><SelectItem value="trimestre">Este trimestre</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm font-medium">{fmtDate(range.de)} - {fmtDate(range.ate)}</span>
          <Button size="sm" onClick={() => void printPanel(c.nome, range.de, range.ate)}><FileDown className="size-4" />Exportar PDF</Button>
        </div>
      </div>
      <Dashboard data={data} clienteIds={[c.id]} de={range.de} ate={range.ate} carteira={false} />
      <PrintFooter />
    </main>
  );
}
