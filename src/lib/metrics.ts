import type { Tables } from "@/integrations/supabase/types";

export type Venda = Tables<"vendas">;
export type Meta = Tables<"metas">;
export type Acomp = Tables<"acompanhamento">;
export type Invest = Tables<"investimento_anuncios">;
export type ClienteLite = { id: string; nome: string; hunter: string | null; performance: string | null; meta_mensal_override: number | null; last_sync_at?: string | null; last_sync_error?: string | null };
export type Config = { pct_total: number; pct_hunter: number; pct_performance: number; pct_atlas: number };

export type PanelData = {
  clientes: ClienteLite[];
  vendas: Venda[];
  metas: Meta[];
  acompanhamento: Acomp[];
  investimentos: Invest[];
  config: Config | null;
};

const PAGO = "PROCEDIMENTO REALIZADO | PAGO";
const inR = (d: string | null, de: string, ate: string) => !!d && d >= de && d <= ate;
const sum = (rows: Venda[], f: (r: Venda) => number | null) => {
  const vals = rows.map(f).filter((x): x is number => x != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
};
const div = (a: number | null, b: number | null) => (a == null || !b ? null : a / b);
export const isSold = (r: Venda) =>
  r.status !== "CIRURGIA DESMARCADA" && ((r.vendas ?? 0) >= 1 || r.status === "VENDA REALIZADA" || r.status === PAGO);

function monthsIn(de: string, ate: string) {
  const out: { ano: number; mes: number }[] = [];
  let [y, m] = de.split("-").map(Number);
  const [ye, me] = ate.split("-").map(Number);
  while (y < ye || (y === ye && m <= me)) { out.push({ ano: y, mes: m }); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

export function metaDoPeriodo(d: PanelData, clienteIds: string[], de: string, ate: string) {
  const months = monthsIn(de, ate);
  let min: number | null = null, ideal: number | null = null, sup: number | null = null;
  const add = (a: number | null, b: number | null | undefined) => (b == null ? a : (a ?? 0) + b);
  for (const cid of clienteIds) {
    const c = d.clientes.find((x) => x.id === cid);
    for (const { ano, mes } of months) {
      const mt = d.metas.find((x) => x.cliente_id === cid && x.mes === mes && x.ano === ano)
        ?? d.metas.find((x) => x.cliente_id === cid && x.mes === mes);
      min = add(min, c?.meta_mensal_override ?? mt?.meta_minima);
      ideal = add(ideal, mt?.meta_ideal);
      sup = add(sup, mt?.supermeta);
    }
  }
  return { min, ideal, sup };
}

export function computeMetrics(d: PanelData, clienteIds: string[], de: string, ate: string) {
  const ids = new Set(clienteIds);
  const v = d.vendas.filter((r) => ids.has(r.cliente_id));
  const cfg = d.config ?? { pct_total: 5, pct_hunter: 3, pct_performance: 1, pct_atlas: 1 };

  const porConsulta = v.filter((r) => inR(r.data_consulta, de, ate));
  const porVenda = v.filter((r) => inR(r.data_venda, de, ate) && isSold(r));
  const realizados = v.filter((r) => inR(r.data_cirurgia, de, ate) && r.status === PAGO);
  const projetados = v.filter((r) => inR(r.data_cirurgia, de, ate) && isSold(r));
  const futuros = v.filter((r) => !!r.data_cirurgia && r.data_cirurgia > ate && isSold(r));

  const inv = d.investimentos.filter((r) => ids.has(r.cliente_id) && inR(r.data, de, ate));
  const investido = inv.length ? inv.reduce((a, r) => a + Number(r.valor_investido), 0) : null;
  const conversas = inv.length ? inv.reduce((a, r) => a + Number(r.conversas_iniciadas), 0) : null;

  const consultas = sum(porConsulta, (r) => r.consultas);
  const comparec = porConsulta.length ? sum(porConsulta, (r) => r.comparecimentos) : null;
  const vendasQtd = porVenda.length ? sum(porVenda, (r) => r.vendas ?? 1) : null;
  const caixa = sum(realizados, (r) => r.caixa_recebido);
  const fatPrev = sum(projetados, (r) => r.valor_fechado);
  const fatFut = sum(futuros, (r) => r.valor_fechado);
  const meta = metaDoPeriodo(d, clienteIds, de, ate);

  const [ay, am] = ate.split("-").map(Number);
  const pipeline = [1, 2, 3].map((k) => {
    const dt = new Date(ay, am - 1 + k, 1);
    const y = dt.getFullYear(), m = dt.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const rows = futuros.filter((r) => r.data_cirurgia!.startsWith(key));
    return { ano: y, mes: m, rows, qtd: rows.length, valor: sum(rows, (r) => r.valor_fechado) };
  });

  const origens = ["ANÚNCIO/ADS", "INDICAÇÃO", "INSTAGRAM", "BASE"];
  const origemMap = new Map<string, { qtd: number; valor: number; rows: Venda[] }>();
  origens.forEach((o) => origemMap.set(o, { qtd: 0, valor: 0, rows: [] }));
  porConsulta.forEach((r) => {
    const o = (r.origem ?? "SEM ORIGEM").toUpperCase();
    const key = origens.find((x) => x.replace(/\W/g, "").includes(o.replace(/\W/g, "").slice(0, 6))) ?? o;
    const e = origemMap.get(key) ?? { qtd: 0, valor: 0, rows: [] };
    e.qtd++; e.valor += r.valor_fechado ?? 0; e.rows.push(r);
    origemMap.set(key, e);
  });

  return {
    investido, conversas, cpc: div(investido, conversas), invRows: inv,
    realizados, caixa,
    comTotal: caixa == null ? null : (caixa * cfg.pct_total) / 100,
    comHunter: caixa == null ? null : (caixa * cfg.pct_hunter) / 100,
    comPerf: caixa == null ? null : (caixa * cfg.pct_performance) / 100,
    comAtlas: caixa == null ? null : (caixa * cfg.pct_atlas) / 100,
    cfg,
    porConsulta, consultas, comparec, taxaComp: div(comparec, consultas),
    porVenda, vendasQtd, valorVendido: sum(porVenda, (r) => r.valor_fechado), taxaConv: div(vendasQtd, comparec),
    projetados, fatPrev, ticketPrev: div(fatPrev, projetados.length), meta, pctMeta: div(fatPrev, meta.min),
    futuros, fatFut, ticketFut: div(fatFut, futuros.length), pipeline,
    origens: [...origemMap.entries()].map(([origem, x]) => ({ origem, ...x })),
    leads: [...porConsulta].sort((a, b) => (b.data_consulta ?? "").localeCompare(a.data_consulta ?? "")),
  };
}
export type Metrics = ReturnType<typeof computeMetrics>;
