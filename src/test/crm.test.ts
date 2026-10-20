import { describe, expect, it } from "vitest";
import { computeCrmMetrics, maskPhone, parseCrmGrid, parseCrmLead, parseWhen, type CrmLead } from "@/lib/crm";

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
    expect(parseCrmLead({})).toEqual({ external_id: null, nome: null, telefone: null, email: null, campanha: null, conjunto: null, criativo: null, origem: null, etapa: null, valor: null, produto: null, situacao: null, criado_em: null, movido_em: null, ganho_em: null });
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
    campanha: null, conjunto: null, criativo: null, origem: null, etapa: null, valor: null, produto: null, situacao: null, criado_em: null, movido_em: null, ganho_em: null, payload: {}, recebido_em: "2026-10-10T15:00:00Z", atualizado_em: "2026-10-10T15:00:00Z", ...p,
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
    expect(m.faturamento).toBeNull();
  });
});

describe("parseCrmGrid (CRM export)", () => {
  const head = ["ID", "Status", "Amount", "Created At", "Last Updated", "Won At", "Last Moved", "Contact Name", "Contact E-mail", "Contact Phone", "Product/Service", "Sales Step"];
  const grid = [
    head,
    ["8100137", "WON", "45.00", "Sun Oct 04 2026 13:02:05 GMT+0000 (Coordinated Universal Time)", "Tue Oct 20 2026 12:07:13 GMT+0000 (Coordinated Universal Time)",
      "Sat Oct 10 2026 15:17:05 GMT+0000 (Coordinated Universal Time)", "Sat Oct 10 2026 15:17:05 GMT+0000 (Coordinated Universal Time)", "Bruno Lima", "", "5548999074115", "Corte", "VENDA REALIZADA"],
    ["8100000", "OPEN", "", "Fri Sep 11 2026 12:25:41 GMT+0000 (Coordinated Universal Time)", "", "", "Sat Sep 12 2026 14:48:41 GMT+0000 (Coordinated Universal Time)", "Rafael Souza", "", "5548999076387", "", "NOVO CONTATO"],
    [],
  ];

  it("maps export columns by header name", () => {
    const [a, b] = parseCrmGrid(grid);
    expect(a).toMatchObject({
      external_id: "8100137", nome: "Bruno Lima", telefone: "5548999074115", valor: 45, produto: "Corte", etapa: "VENDA REALIZADA", situacao: "WON",
      criado_em: "2026-10-04T13:02:05.000Z", ganho_em: "2026-10-10T15:17:05.000Z", movido_em: "2026-10-10T15:17:05.000Z",
    });
    expect(b).toMatchObject({ external_id: "8100000", etapa: "NOVO CONTATO", situacao: "OPEN", valor: null, produto: null });
    expect(parseCrmGrid(grid)).toHaveLength(2);
  });

  it("parses Brazilian dates at noon in São Paulo", () => {
    expect(parseWhen("05/10/2026")).toBe("2026-10-05T15:00:00.000Z");
    expect(parseWhen("")).toBeNull();
  });

  it("counts sales by the date they reached Venda Realizada", () => {
    const leads = parseCrmGrid(grid).map((l, i) => ({ ...l, id: String(i), webhook_id: "w", cliente_id: null, recebido_em: "2026-10-20T12:00:00Z", atualizado_em: "2026-10-20T12:00:00Z" }));
    const out = computeCrmMetrics(leads, "2026-10-01", "2026-10-31");
    expect(out.leads.map((r) => r.nome)).toEqual(["Bruno Lima"]);
    expect(out.vendas).toHaveLength(1);
    expect(out.faturamento).toBe(45);
    expect(out.ticket).toBe(45);
    expect(out.cicloMedio).toBeCloseTo(6.09, 1);
    const set = computeCrmMetrics(leads, "2026-09-01", "2026-09-30");
    expect(set.leads.map((r) => r.nome)).toEqual(["Rafael Souza"]);
    expect(set.vendas).toHaveLength(0);
  });
});

describe("campaign and ad set columns", () => {
  it("keeps Campanha and Conjunto apart", () => {
    const [r] = parseCrmGrid([["ID", "Contact Name", "Campanha", "Conjunto", "Criativo"], ["1", "Ana", "ATOS | ENGAJAMENTO", "FLORIANÓPOLIS | 3KM", "VIDEO - ANTES x DEPOIS"]]);
    expect(r).toMatchObject({ campanha: "ATOS | ENGAJAMENTO", conjunto: "FLORIANÓPOLIS | 3KM", criativo: "VIDEO - ANTES x DEPOIS" });
    expect(parseCrmLead({ adset: { name: "Público A" }, campaign: { name: "Camp" }, ad: { name: "Vídeo 1" } })).toMatchObject({ campanha: "Camp", conjunto: "Público A", criativo: "Vídeo 1" });
  });
});
