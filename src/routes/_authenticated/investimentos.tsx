import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminOnly } from "@/components/atlas/AppShell";
import { fmtBRL, fmtDate, fmtInt, toISO } from "@/lib/format";
import { parseDate, parseNumber } from "@/lib/parse";

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimento em anúncios · Atlas" },
      { name: "description", content: "Lançamento de investimento e conversas de Meta Ads e Google Ads." },
      { property: "og:title", content: "Investimento em anúncios · Atlas" },
      { property: "og:description", content: "Lançamento de investimento e conversas de Meta Ads e Google Ads." },
    ],
  }),
  component: () => <AdminOnly><Investimentos /></AdminOnly>,
});

function Investimentos() {
  const qc = useQueryClient();
  const clientes = useQuery({ queryKey: ["clientes"], queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [] });
  const lista = useQuery({ queryKey: ["investimentos"], queryFn: async () => (await supabase.from("investimento_anuncios").select("*").order("data", { ascending: false }).limit(500)).data ?? [] });
  const [f, setF] = useState({ cliente_id: "", data: toISO(new Date()), plataforma: "meta", valor: "", conversas: "" });
  const nome = (id: string) => clientes.data?.find((c) => c.id === id)?.nome ?? "—";

  const refresh = () => { qc.invalidateQueries({ queryKey: ["investimentos"] }); qc.invalidateQueries({ queryKey: ["panel"] }); };
  const add = async () => {
    if (!f.cliente_id) { toast.error("Escolha o cliente"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("investimento_anuncios").insert({
      cliente_id: f.cliente_id, data: f.data, plataforma: f.plataforma,
      valor_investido: parseNumber(f.valor) ?? 0, conversas_iniciadas: Math.round(parseNumber(f.conversas) ?? 0), created_by: u.user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento salvo");
    setF({ ...f, valor: "", conversas: "" });
    refresh();
  };
  const del = async (id: string) => { await supabase.from("investimento_anuncios").delete().eq("id", id); refresh(); };
  const csv = async (file: File) => {
    if (!f.cliente_id) { toast.error("Escolha o cliente antes de importar"); return; }
    const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim());
    const sep = (lines[0] ?? "").includes(";") ? ";" : ",";
    const rows = lines.slice(1).map((l) => l.split(sep)).map((c) => ({
      cliente_id: f.cliente_id, data: parseDate(c[0]), plataforma: c[1]?.trim().toLowerCase().startsWith("g") ? "google" : "meta",
      valor_investido: parseNumber(c[2]) ?? 0, conversas_iniciadas: Math.round(parseNumber(c[3]) ?? 0),
    })).filter((r) => r.data) as any[];
    if (!rows.length) { toast.error("Nenhuma linha válida no CSV"); return; }
    const { error } = await supabase.from("investimento_anuncios").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} lançamento(s) importado(s)`);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Investimento em anúncios</h1><p className="text-sm text-muted-foreground">Lançamento manual enquanto Meta Ads e Google Ads não estão conectados.</p></div>
      <div className="grid gap-3 rounded-2xl border bg-card p-5 md:grid-cols-6">
        <div className="space-y-1.5 md:col-span-2"><Label>Cliente</Label>
          <Select value={f.cliente_id} onValueChange={(v) => setF({ ...f, cliente_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{clientes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Plataforma</Label>
          <Select value={f.plataforma} onValueChange={(v) => setF({ ...f, plataforma: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="meta">Meta Ads</SelectItem><SelectItem value="google">Google Ads</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Valor (R$)</Label><Input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="1.500,00" /></div>
        <div className="space-y-1.5"><Label>Conversas</Label><Input value={f.conversas} onChange={(e) => setF({ ...f, conversas: e.target.value })} /></div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-6">
          <Button onClick={add}>Salvar lançamento</Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
            <Upload className="size-4" />Importar CSV
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && csv(e.target.files[0])} />
          </label>
          <span className="text-xs text-muted-foreground">Colunas: data (dd/mm/aaaa); plataforma (meta|google); valor; conversas</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card p-2">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Plataforma</TableHead><TableHead className="text-right">Investido</TableHead><TableHead className="text-right">Conversas</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {lista.data?.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>}
            {lista.data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.data)}</TableCell><TableCell>{nome(r.cliente_id)}</TableCell>
                <TableCell>{r.plataforma === "meta" ? "Meta Ads" : "Google Ads"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(Number(r.valor_investido))}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(r.conversas_iniciadas)}</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="size-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
