import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Pencil, Plus, Scissors, Sheet, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GestorOuAdmin } from "@/components/atlas/AppShell";
import { useClientes } from "@/lib/empresa";

export const Route = createFileRoute("/_authenticated/barbearias")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Barbearias · Atlas" },
      { name: "description", content: "Cadastro das barbearias atendidas pelos gestores de tráfego." },
      { property: "og:title", content: "Barbearias · Atlas" },
      { property: "og:description", content: "Cadastro das barbearias atendidas pelos gestores de tráfego." },
    ],
  }),
  component: () => <GestorOuAdmin><Barbearias /></GestorOuAdmin>,
});

function Barbearias() {
  const qc = useQueryClient();
  const clientes = useClientes("barbearias");
  const fontes = useQuery({ queryKey: ["crm-webhooks", "barbearias"], queryFn: async () => (await supabase.from("crm_webhooks").select("id, cliente_id").eq("empresa", "barbearias")).data ?? [] });
  const contas = useQuery({ queryKey: ["meta-vinculos", "barbearias"], queryFn: async () => (await supabase.from("meta_contas_anuncio").select("ad_account_id, cliente_id")).data ?? [] });
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["clientes", "barbearias"] });

  const criar = async () => {
    if (!nome.trim()) { toast.error("Informe o nome da barbearia"); return; }
    const { error } = await supabase.from("clientes").insert({ nome: nome.trim(), empresa: "barbearias", ativo: true });
    if (error) { toast.error("Não foi possível cadastrar"); return; }
    toast.success("Barbearia cadastrada");
    setNome("");
    refresh();
  };
  const salvar = async (id: string, patch: { nome?: string; ativo?: boolean }) => {
    const { error } = await supabase.from("clientes").update(patch).eq("id", id).eq("empresa", "barbearias");
    if (error) toast.error("Não foi possível salvar"); else { setEditando(null); refresh(); }
  };
  const excluir = async (id: string, n: string) => {
    if (!window.confirm(`Excluir "${n}"? As fontes do CRM ficam sem vínculo e as contas de anúncio são desvinculadas.`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id).eq("empresa", "barbearias");
    if (error) toast.error("Não foi possível excluir"); else { toast.success("Barbearia excluída"); refresh(); }
  };
  const qtd = (rows: { cliente_id: string | null }[] | undefined, id: string) => rows?.filter((r) => r.cliente_id === id).length ?? 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-g-teal-soft text-g-teal"><Scissors className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold">Barbearias</h1>
          <p className="text-sm text-muted-foreground">Cadastre cada barbearia atendida. Depois vincule a planilha do CRM (Painel → Fontes de dados) e a conta de anúncio (Integrações).</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4">
        <Input className="w-72" placeholder="Nome da barbearia" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void criar()} />
        <Button onClick={criar}><Plus className="size-4" />Cadastrar</Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card p-2">
        {clientes.isLoading ? <Skeleton className="h-24 w-full" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Barbearia</TableHead><TableHead>Fontes do CRM</TableHead><TableHead>Contas de anúncio</TableHead><TableHead>Ativa</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {!clientes.data?.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma barbearia cadastrada ainda.</TableCell></TableRow>}
              {clientes.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {editando?.id === c.id ? (
                      <div className="flex gap-2">
                        <Input className="h-8 w-56" value={editando.nome} onChange={(e) => setEditando({ id: c.id, nome: e.target.value })} onKeyDown={(e) => e.key === "Enter" && editando.nome.trim() && void salvar(c.id, { nome: editando.nome.trim() })} />
                        <Button size="sm" onClick={() => editando.nome.trim() && void salvar(c.id, { nome: editando.nome.trim() })}>Salvar</Button>
                      </div>
                    ) : c.nome}
                  </TableCell>
                  <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><Sheet className="size-3.5 text-muted-foreground" />{qtd(fontes.data, c.id)}</span></TableCell>
                  <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><Megaphone className="size-3.5 text-muted-foreground" />{qtd(contas.data, c.id)}</span></TableCell>
                  <TableCell><Switch checked={c.ativo} onCheckedChange={(v) => void salvar(c.id, { ativo: v })} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" title="Renomear" onClick={() => setEditando({ id: c.id, nome: c.nome })}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => void excluir(c.id, c.nome)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
