import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activateDriveDetection, getDriveDetection } from "@/lib/drive-watch.functions";
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
  const qc = useQueryClient();
  const activate = useServerFn(activateDriveDetection);
  const readDetection = useServerFn(getDriveDetection);
  const detection = useQuery({ queryKey: ["drive-detection"], queryFn: () => readDetection() });
  const activeCount = new Set(detection.data?.filter((w) => w.resource_id && !w.last_error && Date.parse(w.expires_at) > Date.now()).map((w) => w.cliente_id)).size;
  const activation = useMutation({
    mutationFn: () => activate(),
    onSuccess: (r) => {
      const failed = r.results.filter((x) => !x.ok);
      if (failed.length) toast.error(failed[0]?.erro ?? "Falha ao configurar avisos");
      else toast.success(`Avisos configurados para ${r.results.length} Portais. Disponíveis após publicar esta versão.`);
      void qc.invalidateQueries({ queryKey: ["drive-detection"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na configuração"),
  });
  const q = useQuery({
    queryKey: ["logs"],
    queryFn: async () => (await supabase.from("sync_logs").select("*, clientes(nome)").order("inicio", { ascending: false }).limit(200)).data ?? [],
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Sincronizações</h1><p className="text-sm text-muted-foreground">Avisos configurados: {activeCount} Portais · Leitura de segurança a cada 15 minutos.</p></div><Button variant="outline" onClick={() => activation.mutate()} disabled={activation.isPending}><Radio className="size-4" />{activation.isPending ? "Configurando…" : "Configurar avisos de mudanças"}</Button></div>
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
