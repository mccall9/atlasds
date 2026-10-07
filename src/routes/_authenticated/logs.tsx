import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminOnly } from "@/components/atlas/AppShell";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sincronizações · Atlas" },
      { name: "description", content: "Histórico de leitura dos Portais de Resultados." },
      { property: "og:title", content: "Sincronizações · Atlas" },
      { property: "og:description", content: "Histórico de leitura dos Portais de Resultados." },
    ],
  }),
  component: () => <AdminOnly><Logs /></AdminOnly>,
});

function Logs() {
  const q = useQuery({
    queryKey: ["logs"],
    queryFn: async () => (await supabase.from("sync_logs").select("*, clientes(nome)").order("inicio", { ascending: false }).limit(200)).data ?? [],
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Sincronizações</h1><p className="text-sm text-muted-foreground">Leitura automática a cada 15 minutos.</p></div>
      <div className="overflow-x-auto rounded-2xl border bg-card p-2">
        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead className="text-right">Linhas</TableHead><TableHead>Status</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader>
          <TableBody>
            {q.data?.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.clientes?.nome ?? "—"}</TableCell>
                <TableCell>{fmtDateTime(l.inicio)}</TableCell><TableCell>{fmtDateTime(l.fim)}</TableCell>
                <TableCell className="text-right">{l.linhas_lidas ?? "—"}</TableCell>
                <TableCell className={l.status === "ok" ? "text-g-green" : l.status === "erro" ? "text-destructive" : ""}>{l.status}</TableCell>
                <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={l.erro ?? ""}>{l.erro ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
