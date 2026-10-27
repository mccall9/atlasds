import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, Copy, ExternalLink, Link2, Megaphone, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminOnly } from "@/components/atlas/AppShell";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { META_ERROR_MESSAGES, META_ORIGINS, META_SCOPES, metaRedirectUri } from "@/lib/meta-config";
import { disconnectMeta, getMetaStatus, importMetaNow, listMetaAdAccounts, startMetaOAuth } from "@/lib/meta.functions";

export const Route = createFileRoute("/_authenticated/integracoes")({
  validateSearch: (s: Record<string, unknown>) => ({
    meta: typeof s["meta"] === "string" ? (s["meta"] as string) : undefined,
    motivo: typeof s["motivo"] === "string" ? (s["motivo"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Integrações · Atlas" },
      { name: "description", content: "Conexão nativa com Meta Ads para investimento dos doutores." },
      { property: "og:title", content: "Integrações · Atlas" },
      { property: "og:description", content: "Conexão nativa com Meta Ads para investimento dos doutores." },
    ],
  }),
  component: () => <AdminOnly><Integracoes /></AdminOnly>,
});

const NONE = "__none__";

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copiado"), () => toast.error("Não foi possível copiar"));
}

function StatusPill({ ok, okLabel, pendingLabel }: { ok: boolean; okLabel: string; pendingLabel: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-g-green-soft px-2.5 py-1 text-xs font-medium text-g-green"><CheckCircle2 className="size-3.5" />{okLabel}</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-g-yellow-soft px-2.5 py-1 text-xs font-medium text-g-yellow"><CircleDashed className="size-3.5" />{pendingLabel}</span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-g-blue-soft text-sm font-semibold text-g-blue">{n}</div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function Integracoes() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const search = Route.useSearch();
  const statusFn = useServerFn(getMetaStatus);
  const startFn = useServerFn(startMetaOAuth);
  const listFn = useServerFn(listMetaAdAccounts);
  const disconnectFn = useServerFn(disconnectMeta);
  const importFn = useServerFn(importMetaNow);
  const [importando, setImportando] = useState(false);

  const status = useQuery({ queryKey: ["meta-status"], queryFn: () => statusFn() });
  const conectado = !!status.data?.conexao;
  const contas = useQuery({ queryKey: ["meta-contas"], queryFn: () => listFn(), enabled: conectado });
  const clientes = useQuery({ queryKey: ["clientes"], queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [] });
  const vinculos = useQuery({
    queryKey: ["meta-vinculos"],
    queryFn: async () => (await supabase.from("meta_contas_anuncio").select("*")).data ?? [],
  });

  useEffect(() => {
    if (!search.meta) return;
    if (search.meta === "ok") toast.success("Meta conectada com sucesso");
    else toast.error(META_ERROR_MESSAGES[search.motivo ?? ""] ?? "Não foi possível conectar a Meta.");
    nav({ to: "/integracoes", search: { meta: undefined, motivo: undefined }, replace: true });
  }, [search.meta, search.motivo, nav]);

  const conectar = async () => {
    const r = await startFn({ data: { origin: window.location.origin } });
    if ("error" in r) {
      toast.error(r.error === "config" ? META_ERROR_MESSAGES["config"]! : "Este endereço não está liberado para a conexão. Use o site publicado.");
      return;
    }
    window.location.href = r.url;
  };

  const desconectar = async () => {
    await disconnectFn();
    toast.success("Meta desconectada");
    qc.invalidateQueries({ queryKey: ["meta-status"] });
    qc.removeQueries({ queryKey: ["meta-contas"] });
  };

  const vincular = async (conta: { id: string; nome: string; moeda: string | null }, clienteId: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = clienteId === NONE
      ? await supabase.from("meta_contas_anuncio").delete().eq("ad_account_id", conta.id)
      : await supabase.from("meta_contas_anuncio").upsert(
          { ad_account_id: conta.id, cliente_id: clienteId, nome: conta.nome, moeda: conta.moeda, created_by: u.user?.id ?? null },
          { onConflict: "ad_account_id" },
        );
    if (error) { toast.error("Não foi possível salvar o vínculo"); return; }
    toast.success(clienteId === NONE ? "Vínculo removido" : "Conta vinculada ao doutor");
    qc.invalidateQueries({ queryKey: ["meta-vinculos"] });
  };

  const importar = async () => {
    setImportando(true);
    try {
      const r = await importFn();
      if (r.ok) toast.success(`Investimento atualizado: ${r.dias} dia(s) de ${r.contas} conta(s)`);
      else toast.error(r.erro === "desconectado" ? "Conecte a Meta antes de importar." : `Algumas contas não foram lidas: ${r.erro}`);
    } catch {
      toast.error("Não foi possível importar agora.");
    } finally {
      setImportando(false);
      qc.invalidateQueries({ queryKey: ["meta-status"] });
      qc.invalidateQueries({ queryKey: ["investimentos"] });
      qc.invalidateQueries({ queryKey: ["panel"] });
    }
  };

  const atual = typeof window !== "undefined" ? window.location.origin : "";
  const vinculoDe = (id: string) => vinculos.data?.find((v) => v.ad_account_id === id)?.cliente_id ?? NONE;
  const credsOk = !!status.data?.appIdConfigurado && !!status.data?.appSecretConfigurado;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-g-blue-soft text-g-blue"><Megaphone className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold">Integrações · Meta Ads</h1>
          <p className="text-sm text-muted-foreground">Conexão somente de leitura com as contas de anúncio dos doutores. Nenhuma campanha é alterada.</p>
        </div>
      </div>

      <Step n={1} title="Criar o app na Meta e cadastrar App ID e App Secret">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Acesse <a className="inline-flex items-center gap-1 font-medium text-foreground underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps<ExternalLink className="size-3" /></a> com o perfil que administra a BM da Atlas e crie um app do tipo <strong className="text-foreground">Empresa</strong>.</li>
          <li>Adicione os produtos <strong className="text-foreground">Login do Facebook</strong> e <strong className="text-foreground">API de Marketing</strong>.</li>
          <li>Em <strong className="text-foreground">Configurações do app → Básico</strong> copie o <strong className="text-foreground">ID do aplicativo</strong> (App ID) e a <strong className="text-foreground">Chave secreta do aplicativo</strong> (App Secret).</li>
          <li>Cadastre os dois no cofre seguro do projeto com os nomes <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">META_APP_ID</code> e <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">META_APP_SECRET</code>. Nunca cole o App Secret em chats ou planilhas.</li>
        </ol>
        {status.isLoading ? <Skeleton className="h-7 w-72" /> : (
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={!!status.data?.appIdConfigurado} okLabel="App ID configurado" pendingLabel="App ID pendente" />
            <StatusPill ok={!!status.data?.appSecretConfigurado} okLabel="App Secret configurado" pendingLabel="App Secret pendente" />
          </div>
        )}
      </Step>

      <Step n={2} title="Cadastrar a URL de redirecionamento na Meta">
        <p>No app da Meta, abra <strong className="text-foreground">Login do Facebook → Configurações</strong> e cole as URLs abaixo em <strong className="text-foreground">URIs de redirecionamento do OAuth válidos</strong>. Em <strong className="text-foreground">Configurações → Básico → Domínios do app</strong>, adicione <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">atlasds.lovable.app</code>.</p>
        <div className="space-y-2">
          {META_ORIGINS.map((o) => {
            const uri = metaRedirectUri(o.origin);
            return (
              <div key={o.origin} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">{o.label}{o.origin === atual && " · endereço atual"}</div>
                  <code className="block truncate text-xs">{uri}</code>
                </div>
                <Button size="sm" variant="outline" onClick={() => copy(uri)}><Copy className="size-3.5" />Copiar</Button>
              </div>
            );
          })}
        </div>
        <p className="text-xs">Permissões solicitadas: {META_SCOPES.join(", ")} (somente leitura de anúncios e contas da BM).</p>
      </Step>

      <Step n={3} title="Conectar a conta Meta da Atlas">
        {status.isLoading ? <Skeleton className="h-10 w-64" /> : conectado ? (
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill ok okLabel={`Conectado como ${status.data?.conexao?.nome ?? status.data?.conexao?.id}`} pendingLabel="" />
            <span className="text-xs">Desde {fmtDate(status.data?.conexao?.conectadoEm ?? null)} · acesso válido até {status.data?.conexao?.expiraEm ? fmtDate(status.data.conexao.expiraEm) : "—"}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={conectar}><RefreshCw className="size-3.5" />Reconectar</Button>
              <Button size="sm" variant="ghost" onClick={desconectar}><Unplug className="size-3.5" />Desconectar</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={conectar} disabled={!credsOk}><Link2 className="size-4" />Conectar com Meta</Button>
            {!credsOk && <span className="text-xs">Disponível após cadastrar App ID e App Secret.</span>}
          </div>
        )}
        <p className="text-xs">Use o perfil que tem acesso de parceiro às BMs dos doutores. Nenhuma senha é armazenada no painel; a renovação é necessária a cada ~60 dias.</p>
      </Step>

      <Step n={4} title="Vincular cada conta de anúncio ao doutor">
        {!conectado ? <p>Conecte a Meta para listar as contas de anúncio.</p> : contas.isLoading ? <Skeleton className="h-32 w-full" /> : contas.data?.error ? (
          <p className="text-g-red">{contas.data.error === "token" ? "O acesso à Meta expirou. Clique em Reconectar." : "A Meta não respondeu. Tente novamente em instantes."}</p>
        ) : !contas.data?.contas.length ? (
          <p>Nenhuma conta de anúncio compartilhada com este perfil.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>Conta de anúncio</TableHead><TableHead>ID</TableHead><TableHead>Moeda</TableHead><TableHead className="w-64">Doutor</TableHead></TableRow></TableHeader>
              <TableBody>
                {contas.data.contas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.nome}{!c.ativa && <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>}</TableCell>
                    <TableCell className="text-xs tabular-nums">{c.id.replace(/^act_/, "")}</TableCell>
                    <TableCell>{c.moeda ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={vinculoDe(c.id)} onValueChange={(v) => vincular(c, v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Não vinculada</SelectItem>
                          {clientes.data?.map((cl) => <SelectItem key={cl.id} value={cl.id}>{cl.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Step>

      <Step n={5} title="Importar investimento e conversas">
        <p>O painel lê da Meta o valor investido e as conversas iniciadas por dia de cada conta vinculada. A leitura roda sozinha junto com a atualização de 15 em 15 minutos (últimos 40 dias); o botão abaixo relê os últimos 13 meses.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={importar} disabled={!conectado || importando}><RefreshCw className={importando ? "size-4 animate-spin" : "size-4"} />{importando ? "Importando…" : "Importar agora"}</Button>
          <span className="text-xs">Última importação: {status.data?.conexao?.importadoEm ? fmtDateTime(status.data.conexao.importadoEm) : "—"}</span>
        </div>
        {status.data?.conexao?.erroImportacao && <p className="text-xs text-g-red">{status.data.conexao.erroImportacao}</p>}
      </Step>
    </div>
  );
}
