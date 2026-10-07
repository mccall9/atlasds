import { supabase } from "@/integrations/supabase/client";
import type { PanelData } from "./metrics";

async function fetchAll<T>(table: string, order?: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = (supabase as any).from(table).select("*").range(from, from + 999);
    if (order) q = q.order(order);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function loadPanelData(): Promise<PanelData> {
  const [clientes, vendas, metas, acompanhamento, investimentos, cfg] = await Promise.all([
    supabase.from("clientes").select("id, nome, hunter, performance, meta_mensal_override, ativo, last_sync_at, last_sync_error").order("nome"),
    fetchAll<any>("vendas", "id"),
    fetchAll<any>("metas"),
    fetchAll<any>("acompanhamento", "ordem"),
    fetchAll<any>("investimento_anuncios"),
    supabase.from("configuracoes").select("pct_total, pct_hunter, pct_performance, pct_atlas").eq("id", 1).single(),
  ]);
  if (clientes.error) throw clientes.error;
  return {
    clientes: (clientes.data ?? []).filter((c) => c.ativo),
    vendas, metas, acompanhamento, investimentos,
    config: cfg.data ?? null,
  };
}
