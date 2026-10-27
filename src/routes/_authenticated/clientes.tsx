import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Pencil, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminOnly } from "@/components/atlas/AppShell";
import { extractSpreadsheetId } from "@/lib/parse";
import { fmtDateTime } from "@/lib/format";
import { syncNow } from "@/lib/sync.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Clientes · Atlas" },
      { name: "description", content: "Cadastro dos Portais de Resultados lidos pelo painel." },
      { property: "og:title", content: "Clientes · Atlas" },
      { property: "og:description", content: "Cadastro dos Portais de Resultados lidos pelo painel." },
    ],
  }),
  component: () => <AdminOnly><Clientes /></AdminOnly>,
});

type Cliente = Tables<"clientes">;
const empty = { nome: "", url: "", hunter: "", performance: "", layout: "atual", meta: "", ativo: true };

function Clientes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["clientes", "atlas"], queryFn: async () => (await supabase.from("clientes").select("*").eq("empresa", "atlas").order("nome")).data ?? [] });
  const [edit, setEdit] = useState<Cliente | "new" | null>(null);
  const [f, setF] = useState(empty);
  const sync = useServerFn(syncNow);
  const syncOne = useMutation({
    mutationFn: (id: string) => sync({ data: { clienteId: id } }),
    onSuccess: (r) => { r[0]?.ok ? toast.success("Portal sincronizado") : toast.error(r[0]?.erro ?? "Erro"); qc.invalidateQueries(); },
  });

  const openForm = (c: Cliente | "new") => {
    setEdit(c);
    setF(c === "new" ? empty : { nome: c.nome, url: c.spreadsheet_id ?? "", hunter: c.hunter ?? "", performance: c.performance ?? "", layout: c.layout, meta: c.meta_mensal_override?.toString() ?? "", ativo: c.ativo });
  };
  const save = async () => {
    const id = extractSpreadsheetId(f.url);
    if (!f.nome || !id) { toast.error("Informe o nome e uma URL válida do Portal"); return; }
    const row = { nome: f.nome, spreadsheet_id: id, hunter: f.hunter || null, performance: f.performance || null, layout: f.layout, meta_mensal_override: f.meta ? Number(f.meta.replace(",", ".")) : null, ativo: f.ativo };
    const { error } = edit === "new" ? await supabase.from("clientes").insert(row) : await supabase.from("clientes").update(row).eq("id", (edit as Cliente).id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente salvo");
    setEdit(null);
    qc.invalidateQueries();
  };
  const share = async (c: Cliente) => {
    let token = c.share_token;
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase.from("clientes").update({ share_token: token }).eq("id", c.id);
      if (error) { toast.error(error.message); return; }
      qc.invalidateQueries({ queryKey: ["clientes"] });
    }
    await navigator.clipboard.writeText(`${window.location.origin}/c/${token}`);
    toast.success("Link do cliente copiado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Clientes</h1><p className="text-sm text-muted-foreground">Portais de Resultados lidos pelo painel (somente leitura).</p></div>
        <Button onClick={() => openForm("new")}><Plus className="size-4" />Novo cliente</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card p-2">
        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Hunter</TableHead><TableHead>Performance</TableHead><TableHead>Layout</TableHead><TableHead>Status</TableHead><TableHead>Última sincronização</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {q.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.hunter ?? "—"}</TableCell>
                <TableCell>{c.performance ?? "—"}</TableCell>
                <TableCell className="capitalize">{c.layout}</TableCell>
                <TableCell>{c.ativo ? <span className="text-g-green">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</TableCell>
                <TableCell className="text-xs">{fmtDateTime(c.last_sync_at)}{c.last_sync_error && <div className="max-w-72 truncate text-destructive" title={c.last_sync_error}>{c.last_sync_error}</div>}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" title="Sincronizar" onClick={() => syncOne.mutate(c.id)} disabled={syncOne.isPending}><RefreshCw className="size-4" /></Button>
                  <Button size="icon" variant="ghost" title="Copiar link do cliente" onClick={() => share(c)}><Link2 className="size-4" /></Button>
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => openForm(c)}><Pencil className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit === "new" ? "Novo cliente" : "Editar cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Dra. Thais Oliveira" /></div>
            <div className="space-y-1.5"><Label>URL do Portal</Label><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…" />
              {f.url && <p className="text-xs text-muted-foreground">ID: {extractSpreadsheetId(f.url) ?? "inválido"}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Hunter</Label><Input value={f.hunter} onChange={(e) => setF({ ...f, hunter: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Performance</Label><Input value={f.performance} onChange={(e) => setF({ ...f, performance: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Layout</Label>
                <Select value={f.layout} onValueChange={(v) => setF({ ...f, layout: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="atual">Atual</SelectItem><SelectItem value="antigo">Antigo</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Meta mensal (opcional)</Label><Input value={f.meta} onChange={(e) => setF({ ...f, meta: e.target.value })} placeholder="Usa a da planilha" /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })} /><Label>Ativo</Label></div>
            <Button className="w-full" onClick={save}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
