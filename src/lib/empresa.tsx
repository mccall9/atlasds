import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// The panel serves two companies; every client, CRM source and Meta connection belongs to one of them.
export type Empresa = "atlas" | "barbearias";
export const EMPRESAS: Record<Empresa, { nome: string; inicio: "/painel" | "/crm" }> = {
  atlas: { nome: "Atlas Assessoria", inicio: "/painel" },
  barbearias: { nome: "Barbearias", inicio: "/crm" },
};
// Pages that exist for only one company switch the selector to it when opened directly.
export const ROTAS_DA_EMPRESA: Record<string, Empresa> = {
  "/painel": "atlas", "/clientes": "atlas", "/investimentos": "atlas", "/logs": "atlas",
  "/crm": "barbearias", "/barbearias": "barbearias",
};
export const ROTAS_GESTOR = ["/crm", "/barbearias", "/integracoes"];

const storageKey = "atlas-empresa";
const Ctx = createContext<{ empresa: Empresa; setEmpresa: (e: Empresa) => void; podeTrocar: boolean }>({ empresa: "atlas", setEmpresa: () => {}, podeTrocar: false });

// Gestores only ever see the barbershops; admins choose; everyone else stays on Atlas.
export function EmpresaProvider({ role, children }: { role: string | undefined; children: ReactNode }) {
  const [escolhida, setEscolhida] = useState<Empresa>("atlas");
  useEffect(() => {
    try { if (localStorage.getItem(storageKey) === "barbearias") setEscolhida("barbearias"); } catch { /* Storage may be blocked. */ }
  }, []);
  const setEmpresa = (e: Empresa) => {
    setEscolhida(e);
    try { localStorage.setItem(storageKey, e); } catch { /* Storage may be blocked. */ }
  };
  const empresa: Empresa = role === "gestor" ? "barbearias" : role === "admin" ? escolhida : "atlas";
  return <Ctx.Provider value={{ empresa, setEmpresa, podeTrocar: role === "admin" }}>{children}</Ctx.Provider>;
}

export const useEmpresa = () => useContext(Ctx);

export function useClientes(empresa: Empresa) {
  return useQuery({
    queryKey: ["clientes", empresa],
    queryFn: async () => (await supabase.from("clientes").select("*").eq("empresa", empresa).order("nome")).data ?? [],
  });
}
