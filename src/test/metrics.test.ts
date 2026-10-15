import { describe, expect, it } from "vitest";
import { computeMetrics, weeklyMetrics, type PanelData, type Venda } from "@/lib/metrics";

function row(id: string, patch: Partial<Venda> = {}): Venda {
  return {
    id, cliente_id: "victor", lead_nome: id, linha_planilha: null,
    status: "CONSULTA AGENDADA", data_consulta: "2026-09-21", consultas: 1,
    comparecimentos: 0, vendas: null, data_venda: null, data_cirurgia: null,
    origem: null, procedimento: null, orcamento: null, valor_fechado: null,
    pago_100: null, caixa_recebido: null, comissao_atlas: null,
    comissao_hunter: null, comissao_extra: null, observacoes: null,
    synced_at: "2026-10-08T09:43:00Z", ...patch,
  };
}

function metrics(vendas: Venda[]) {
  const data: PanelData = { clientes: [], vendas, metas: [], acompanhamento: [], investimentos: [], config: null };
  return computeMetrics(data, ["victor"], "2026-10-01", "2026-10-31");
}

describe("Lead table period selection", () => {
  it("includes October consultations", () => {
    expect(metrics([row("consulta", { data_consulta: "2026-10-26" })]).leads.map(r => r.id)).toEqual(["consulta"]);
  });
  it("includes October sales even when consultation was in September", () => {
    const m = metrics([row("venda", { status: "VENDA REALIZADA", data_venda: "2026-10-08", vendas: 1 })]);
    expect(m.leads.map(r => r.id)).toEqual(["venda"]);
    expect(m.porConsulta).toEqual([]);
    expect(m.vendasQtd).toBe(1);
  });
  it("includes October surgery with September consultation and sale", () => {
    const m = metrics([row("cirurgia", { status: "VENDA REALIZADA", data_venda: "2026-09-21", data_cirurgia: "2026-10-09" })]);
    expect(m.leads.map(r => r.id)).toEqual(["cirurgia"]);
    expect(m.porConsulta).toEqual([]);
    expect(m.porVenda).toEqual([]);
  });
  it("includes paid October procedures from earlier consultations", () => {
    expect(metrics([row("pago", { status: "PROCEDIMENTO REALIZADO | PAGO", data_cirurgia: "2026-10-07" })]).leads.map(r => r.id)).toEqual(["pago"]);
  });
  it("includes a lead only once when all three dates match", () => {
    expect(metrics([row("unico", { status: "VENDA REALIZADA", data_consulta: "2026-10-01", data_venda: "2026-10-08", data_cirurgia: "2026-10-31" })]).leads.map(r => r.id)).toEqual(["unico"]);
  });
  it("excludes other clients and records with no qualifying date", () => {
    expect(metrics([
      row("outro", { cliente_id: "eriel", data_cirurgia: "2026-10-09" }),
      row("setembro", { status: "VENDA REALIZADA", data_venda: "2026-09-21", data_cirurgia: "2026-11-01" }),
      row("sem-venda", { data_venda: "2026-10-08" }),
      row("vazio", { data_consulta: null }),
    ]).leads).toEqual([]);
  });
});

describe("Weekly follow-up", () => {
  const data = (vendas: Venda[]): PanelData => ({ clientes: [], vendas, metas: [], acompanhamento: [], investimentos: [], config: null });
  it("uses October calendar weeks, clipped to the selected period", () => {
    const weeks = weeklyMetrics(data([]), ["victor"], "2026-10-01", "2026-10-31");
    expect(weeks.map(w => [w.de, w.ate])).toEqual([
      ["2026-10-01", "2026-10-04"], ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"], ["2026-10-19", "2026-10-25"], ["2026-10-26", "2026-10-31"],
    ]);
  });
  it("counts consultations and attendance by consultation date", () => {
    const weeks = weeklyMetrics(data([row("c", { data_consulta: "2026-10-03", consultas: 2, comparecimentos: 1 })]), ["victor"], "2026-10-01", "2026-10-31");
    expect(weeks[0]?.Consultas).toBe(2);
    expect(weeks[0]?.Comparecimentos).toBe(1);
  });
  it("counts sales by sale date even with September consultation", () => {
    const weeks = weeklyMetrics(data([row("s", { status: "VENDA REALIZADA", data_venda: "2026-10-08", vendas: 1 })]), ["victor"], "2026-10-01", "2026-10-31");
    expect(weeks[1]?.Vendas).toBe(1);
    expect(weeks[1]?.Consultas).toBe(0);
  });
  it("counts only paid procedures by procedure date", () => {
    const weeks = weeklyMetrics(data([
      row("paid", { status: "PROCEDIMENTO REALIZADO | PAGO", data_cirurgia: "2026-10-14" }),
      row("future", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-14" }),
    ]), ["victor"], "2026-10-01", "2026-10-31");
    expect(weeks[2]?.Cirurgias).toBe(1);
  });
  it("excludes other doctors and dates outside the selected range", () => {
    const weeks = weeklyMetrics(data([
      row("other", { cliente_id: "eriel", data_consulta: "2026-10-08" }),
      row("old", { data_consulta: "2026-06-08" }),
    ]), ["victor"], "2026-10-01", "2026-10-31");
    expect(weeks.reduce((total, w) => total + (w.Consultas ?? 0), 0)).toBe(0);
  });
  it("keeps missing source values null instead of inventing zero", () => {
    expect(weeklyMetrics(data([row("missing", { data_consulta: "2026-10-03", consultas: null })]), ["victor"], "2026-10-01", "2026-10-04")[0]?.Consultas).toBeNull();
  });
});

describe("Projected commission", () => {
  it("separates the Hunter projection at 3% without requiring payment", () => {
    const m = metrics([row("hunter", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20", valor_fechado: 20000, pago_100: false })]);
    expect(m.comHunterPrev).toBe(600);
    expect(m.comPrev).toBe(1000);
    expect(m.comHunter).toBeNull();
  });
  it("uses the configured Hunter rate and preserves absent or zero revenue", () => {
    const data: PanelData = { clientes: [], vendas: [row("hunter", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20", valor_fechado: 20000 })], metas: [], acompanhamento: [], investimentos: [], config: { pct_total: 5, pct_hunter: 4, pct_performance: 1, pct_atlas: 1 } };
    expect(computeMetrics(data, ["victor"], "2026-10-01", "2026-10-31").comHunterPrev).toBe(800);
    expect(metrics([row("vazio", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20" })]).comHunterPrev).toBeNull();
    expect(metrics([row("zero", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20", valor_fechado: 0 })]).comHunterPrev).toBe(0);
  });
  it("applies the total rate to projected revenue without requiring full payment", () => {
    const m = metrics([
      row("previsto", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20", valor_fechado: 20000, pago_100: false }),
      row("pago", { status: "PROCEDIMENTO REALIZADO | PAGO", data_cirurgia: "2026-10-10", valor_fechado: 10000, caixa_recebido: 10000 }),
      row("cancelado", { status: "CIRURGIA DESMARCADA", vendas: 1, data_cirurgia: "2026-10-20", valor_fechado: 50000 }),
      row("futuro", { status: "VENDA REALIZADA", data_cirurgia: "2026-11-20", valor_fechado: 50000 }),
      row("outro", { cliente_id: "eriel", status: "VENDA REALIZADA", data_cirurgia: "2026-10-20", valor_fechado: 50000 }),
    ]);
    expect(m.comPrev).toBe(1500);
    expect(m.comTotal).toBe(500);
    expect(m.projetados.map(r => r.id)).toEqual(["previsto", "pago"]);
  });
  it("uses the configured total percentage", () => {
    const data: PanelData = { clientes: [], vendas: [row("previsto", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20", valor_fechado: 20000 })], metas: [], acompanhamento: [], investimentos: [], config: { pct_total: 7, pct_hunter: 3, pct_performance: 1, pct_atlas: 1 } };
    expect(computeMetrics(data, ["victor"], "2026-10-01", "2026-10-31").comPrev).toBe(1400);
  });
  it("preserves absent revenue as null and recorded zero as zero", () => {
    expect(metrics([row("vazio", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20" })]).comPrev).toBeNull();
    expect(metrics([row("zero", { status: "VENDA REALIZADA", data_cirurgia: "2026-10-20", valor_fechado: 0 })]).comPrev).toBe(0);
  });
});

describe("Budget card", () => {
  it("sums the Portal budget values, not closed values, for the filtered lead rows once", () => {
    const m = metrics([
      row("consulta", { data_consulta: "2026-10-05", orcamento: 15500, valor_fechado: 12000 }),
      row("venda", { status: "VENDA REALIZADA", data_venda: "2026-10-08", data_cirurgia: "2026-10-14", orcamento: 20000 }),
      row("outro-cliente", { cliente_id: "eriel", data_consulta: "2026-10-05", orcamento: 999 }),
      row("fora", { orcamento: 999 }),
      row("sem-orcamento", { data_consulta: "2026-10-05" }),
    ]);
    expect(m.orcamentos).toBe(35500);
    expect(m.orcamentoRows.map(r => r.id).sort()).toEqual(["consulta", "venda"]);
  });
  it("preserves absent budgets as null and a recorded zero as zero", () => {
    expect(metrics([row("vazio", { data_consulta: "2026-10-05" })]).orcamentos).toBeNull();
    expect(metrics([row("zero", { data_consulta: "2026-10-05", orcamento: 0 })]).orcamentos).toBe(0);
  });
});