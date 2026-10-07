import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function useRole() {
  return useQuery({
    queryKey: ["role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("claim_access");
      if (error) throw error;
      return data as "admin" | "equipe" | "cliente" | "none";
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

export function Logo({ url }: { url?: string | null }) {
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
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/auth" });
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
  const isAdmin = role.data === "admin";
  const links = [
    { to: "/painel", label: "Painel" },
    ...(isAdmin ? [
      { to: "/clientes", label: "Clientes" },
      { to: "/investimentos", label: "Investimentos" },
      { to: "/configuracoes", label: "Configurações" },
      { to: "/logs", label: "Sincronizações" },
    ] : []),
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="no-print border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:px-8">
          <Logo url={cfg.data?.logo_url} />
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" activeProps={{ className: "bg-secondary font-medium text-foreground" }}>
                {l.label}
              </Link>
            ))}
          </nav>
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
