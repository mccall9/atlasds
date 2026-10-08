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