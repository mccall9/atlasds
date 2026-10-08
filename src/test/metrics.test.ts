import { describe, expect, it } from "vitest";
import { computeMetrics, type PanelData, type Venda } from "@/lib/metrics";

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