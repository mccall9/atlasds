import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "./ThemeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPRESAS, EmpresaProvider, ROTAS_DA_EMPRESA, ROTAS_GESTOR, useEmpresa, type Empresa } from "@/lib/empresa";

export function useRole() {
  return useQuery({
    queryKey: ["role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("claim_access");
      if (error) throw error;
      return data as "admin" | "equipe" | "cliente" | "gestor" | "none";
    },
    staleTime: 5 * 60_000,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
}

export function Logo({ url }: { url?: string | null | undefined }) {
  return url ? (
    <img src={url} alt="Atlas Assessoria" className="h-9 w-auto object-contain" />
  ) : (
    <div className="flex items-center gap-2">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">A</div>
      <span className="text-base font-semibold tracking-tight">Atlas</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const role = useRole();
  const cfg = useConfig();
  const nav = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  if (role.isLoading) return <div className="mx-auto max-w-7xl p-8"><Skeleton className="h-10 w-64" /></div>;
  if (role.data === "none" || role.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-g-orange" />
          <h1 className="mt-4 text-lg font-semibold">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use um e-mail corporativo da Atlas ou peça a um administrador para liberar seu acesso.</p>
          <Button className="mt-6" variant="outline" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }
  return (
    <EmpresaProvider role={role.data}>
      <Shell role={role.data} logoUrl={cfg.data?.logo_url} signOut={signOut}>{children}</Shell>
    </EmpresaProvider>
  );
}

function Shell({ role, logoUrl, signOut, children }: { role: string | undefined; logoUrl: string | null | undefined; signOut: () => void; children: ReactNode }) {
  const { empresa, setEmpresa, podeTrocar } = useEmpresa();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = role === "admin";
  const gestor = role === "gestor";

  // Gestores stay inside the barbershop pages; an admin opening a company-specific page switches to that company.
  useEffect(() => {
    if (gestor && !ROTAS_GESTOR.includes(path)) nav({ to: "/crm", replace: true });
    const dona = ROTAS_DA_EMPRESA[path];
    if (podeTrocar && dona && dona !== empresa) setEmpresa(dona);
  }, [gestor, podeTrocar, path, empresa, setEmpresa, nav]);

  const trocar = (e: Empresa) => {
    setEmpresa(e);
    nav({ to: EMPRESAS[e].inicio });
  };

  const links = empresa === "barbearias" ? [
    { to: "/crm", label: "Painel" },
    { to: "/barbearias", label: "Barbearias" },
    { to: "/integracoes", label: "Integrações" },
    ...(isAdmin ? [{ to: "/configuracoes", label: "Configurações" }] : []),
  ] : [
    { to: "/painel", label: "Painel" },
    ...(isAdmin ? [
      { to: "/clientes", label: "Clientes" },
      { to: "/investimentos", label: "Investimentos" },
      { to: "/integracoes", label: "Integrações" },
      { to: "/configuracoes", label: "Configurações" },
      { to: "/logs", label: "Sincronizações" },
    ] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="no-print border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:px-8">
          <Logo url={logoUrl} />
          {podeTrocar ? (
            <Select value={empresa} onValueChange={(v) => trocar(v as Empresa)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(EMPRESAS) as Empresa[]).map((e) => <SelectItem key={e} value={e}>{EMPRESAS[e].nome}</SelectItem>)}</SelectContent>
            </Select>
          ) : gestor && <span className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium">{EMPRESAS.barbearias.nome}</span>}
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" activeProps={{ className: "bg-secondary font-medium text-foreground" }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" />Sair</Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}

export function AdminOnly({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role.isLoading) return null;
  if (role.data !== "admin") return <p className="text-sm text-muted-foreground">Apenas administradores podem ver esta página.</p>;
  return <>{children}</>;
}

// Barbershop pages: admins and the company's traffic managers.
export function GestorOuAdmin({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role.isLoading) return null;
  if (role.data !== "admin" && role.data !== "gestor") return <p className="text-sm text-muted-foreground">Você não tem acesso a esta página.</p>;
  return <>{children}</>;
}
