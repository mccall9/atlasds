import { describe, expect, it } from "vitest";
import { computeCrmMetrics, maskPhone, parseCrmLead, type CrmLead } from "@/lib/crm";

describe("parseCrmLead", () => {
  it("reads flat Portuguese fields with accents and spacing", () => {
    const r = parseCrmLead({ "Nome Completo": "Maria Souza", Telefone: "(48) 99123-4567", "Campanha ": "Rinomodelação | Out", Origem: "instagram", Etapa: "Agendou", Valor: "R$ 1.500,00" });
    expect(r).toMatchObject({ nome: "Maria Souza", telefone: "(48) 99123-4567", campanha: "Rinomodelação | Out", origem: "INSTAGRAM", etapa: "Agendou", valor: 1500 });
    expect(r.external_id).toBe("tel:48991234567");
  });

  it("reads nested English payloads and prefers UTM campaign", () => {
    const r = parseCrmLead({ event: "deal.moved", data: { deal_id: 991, owner: { name: "Vendedor" }, stage: { name: "Qualificado" }, contact: { name: "João", phone: "+55 48 98888-7777", email: "JOAO@X.COM" }, utm: { utm_source: "facebook", utm_campaign: "LP Blefaro" } } });
    expect(r).toMatchObject({ external_id: "991", nome: "João", email: "joao@x.com", campanha: "LP Blefaro", origem: "FACEBOOK", etapa: "Qualificado" });
  });

  it("keeps missing fields null", () => {
    expect(parseCrmLead({})).toEqual({ external_id: null, nome: null, telefone: null, email: null, campanha: null, origem: null, etapa: null, valor: null });
  });
});

describe("maskPhone", () => {
  it("hides middle digits", () => {
    expect(maskPhone("(48) 99123-4567")).toBe("489 91•••-4567");
    expect(maskPhone(null)).toBe("—");
  });
});

describe("computeCrmMetrics", () => {
  const lead = (p: Partial<CrmLead>): CrmLead => ({
    id: Math.random().toString(), webhook_id: "w", cliente_id: null, external_id: null, nome: "x", telefone: null, email: null,
    campanha: null, origem: null, etapa: null, valor: null, payload: {}, recebido_em: "2026-10-10T15:00:00Z", atualizado_em: "2026-10-10T15:00:00Z", ...p,
  });

  it("filters by São Paulo day and groups by campaign", () => {
    const rows = [
      lead({ campanha: "A", telefone: "48991234567" }),
      lead({ campanha: "A" }),
      lead({ campanha: "B", recebido_em: "2026-10-11T12:00:00Z" }),
      // 01:00 UTC on Nov 1 is still Oct 31 in São Paulo.
      lead({ recebido_em: "2026-11-01T01:00:00Z" }),
      lead({ recebido_em: "2026-11-01T04:00:00Z" }),
    ];
    const m = computeCrmMetrics(rows, "2026-10-01", "2026-10-31", "2026-10-11");
    expect(m.leads).toHaveLength(4);
    expect(m.hoje).toHaveLength(1);
    expect(m.comTelefone).toHaveLength(1);
    expect(m.campanhas.map((c) => [c.nome, c.qtd])).toEqual([["A", 2], ["B", 1], ["Sem campanha", 1]]);
    expect(m.mediaDia).toBeCloseTo(4 / 3);
    expect(m.valor).toBeNull();
  });
});
