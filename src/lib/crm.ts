// CRM payloads and exports vary by platform; fields are matched by normalized key name, never by position.
import { norm, parseDate, parseNumber } from "./parse";

export type CrmLeadFields = {
  external_id: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  campanha: string | null;
  origem: string | null;
  etapa: string | null;
  valor: number | null;
  produto: string | null;
  situacao: string | null;
  criado_em: string | null;
  movido_em: string | null;
  ganho_em: string | null;
};

export type CrmLead = CrmLeadFields & {
  id: string;
  webhook_id: string;
  cliente_id: string | null;
  payload: unknown;
  recebido_em: string;
  atualizado_em: string;
};

const key = (k: string) => norm(k).replace(/[^a-z0-9]/g, "");

// Earlier aliases win; each list holds normalized keys (see `key`).
const ALIASES: Record<keyof CrmLeadFields, string[]> = {
  external_id: ["leadid", "dealid", "negocioid", "idlead", "iddonegocio", "idnegocio", "id"],
  nome: ["nome", "nomecompleto", "name", "fullname", "nomedolead", "nomedopaciente", "nomedocontato", "contactname", "nomedocliente", "cliente", "firstname"],
  telefone: ["telefone", "phone", "phonenumber", "contactphone", "telefonedocontato", "celular", "whatsapp", "fone", "mobile", "numero", "number", "tel"],
  email: ["email", "emailaddress", "contactemail", "emaildocontato", "mail"],
  campanha: ["utmcampaign", "campanha", "campaign", "campaignname", "nomedacampanha", "adname", "anuncio", "adsetname", "conjunto", "campanhanome", "campaigntitle"],
  origem: ["utmsource", "origem", "source", "fonte", "canal", "leadsource", "plataforma", "sourcename", "origemnome"],
  etapa: ["etapa", "salesstep", "coluna", "stage", "fase", "pipelinestage", "stagename", "etapadofunil", "stagetitle", "etapanome", "colunanome", "fasename", "pipelinestagename", "status", "statusname"],
  valor: ["valor", "amount", "value", "price", "preco", "valordonegocio", "dealvalue", "valorfechado"],
  produto: ["produto", "productservice", "produtoservico", "servico", "product", "service", "procedimento"],
  situacao: ["situacao", "dealstatus", "status"],
  criado_em: ["createdat", "criadoem", "datadecriacao", "datacriacao", "created", "data", "date"],
  movido_em: ["lastmoved", "movidoem", "stagechangedat", "dataentradacoluna", "dataetapa", "ultimamovimentacao"],
  ganho_em: ["wonat", "ganhoem", "datadavenda", "datavenda", "closedat", "fechadoem"],
};

// Nested objects under these keys describe something other than the lead (stage, campaign, owner…),
// so their generic children are only exposed with the parent prefix ("stage.name" → "stagename").
const CONTEXT = ["stage", "etapa", "status", "coluna", "fase", "pipeline", "campaign", "campanha", "adset", "conjunto", "ad", "anuncio",
  "source", "origem", "utm", "owner", "responsavel", "user", "usuario", "tag", "tags", "company", "empresa"];
const GENERIC = ["id", "name", "nome", "title", "titulo", "label", "value", "valor", "email", "phone", "telefone"];

// Flattens nested objects into [normalizedKey, value] pairs; shallower keys come first.
function flatten(payload: unknown): [string, unknown][] {
  const out: [string, unknown][] = [];
  let level: [string, unknown, boolean][] = [["", payload, false]];
  for (let depth = 0; depth < 4 && level.length; depth++) {
    const next: [string, unknown, boolean][] = [];
    for (const [parent, v, ctx] of level) {
      if (Array.isArray(v)) {
        if (v[0] && typeof v[0] === "object") next.push([parent, v[0], ctx]);
        continue;
      }
      if (!v || typeof v !== "object") continue;
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const kk = key(k);
        const isCtx = ctx || CONTEXT.includes(kk);
        if (val && typeof val === "object") next.push([isCtx && ctx ? parent : kk, val, isCtx]);
        else {
          if (!ctx || !GENERIC.includes(kk)) out.push([kk, val]);
          if (parent) out.push([parent + kk, val]);
        }
      }
    }
    level = next;
  }
  return out;
}

const text = (v: unknown) => {
  if (v == null || typeof v === "object") return null;
  const s = String(v).trim();
  return s ? s.slice(0, 500) : null;
};

// Accepts dd/mm/aaaa (noon in São Paulo, so the day never shifts), ISO and JS date strings.
export function parseWhen(v: unknown): string | null {
  const s = text(v);
  if (!s) return null;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) {
    const d = parseDate(s);
    return d ? new Date(`${d}T12:00:00-03:00`).toISOString() : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00-03:00`).toISOString();
  const t = Date.parse(s.replace(/\s*\(.*\)\s*$/, ""));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function parseCrmLead(payload: unknown): CrmLeadFields {
  const pairs = flatten(payload);
  const pick = (f: keyof CrmLeadFields) => {
    for (const alias of ALIASES[f]) {
      const hit = pairs.find(([k, v]) => k === alias && text(v) != null);
      if (hit) return hit[1];
    }
    return null;
  };
  const telefone = text(pick("telefone"));
  const digits = telefone?.replace(/\D/g, "") ?? "";
  const id = text(pick("external_id"));
  const etapa = text(pick("etapa"));
  const situacao = text(pick("situacao"));
  return {
    // Without a CRM id the phone identifies the contact, so resends update instead of duplicating.
    external_id: id ?? (digits.length >= 8 ? `tel:${digits}` : null),
    nome: text(pick("nome")),
    telefone,
    email: text(pick("email"))?.toLowerCase() ?? null,
    campanha: text(pick("campanha")),
    origem: text(pick("origem"))?.toUpperCase() ?? null,
    etapa,
    valor: parseNumber(pick("valor")),
    produto: text(pick("produto")),
    // "Status" is only the deal situation when a separate stage column exists.
    situacao: situacao && situacao !== etapa ? situacao.toUpperCase() : null,
    criado_em: parseWhen(pick("criado_em")),
    movido_em: parseWhen(pick("movido_em")),
    ganho_em: parseWhen(pick("ganho_em")),
  };
}

// Turns a sheet grid (header row first) into one lead per non-empty row.
export function parseCrmGrid(grid: string[][]): (CrmLeadFields & { payload: Record<string, string> })[] {
  const [head = [], ...rows] = grid;
  const seen = new Set<string>();
  const out: (CrmLeadFields & { payload: Record<string, string> })[] = [];
  rows.forEach((row, i) => {
    const payload: Record<string, string> = {};
    head.forEach((h, c) => { const k = String(h ?? "").trim(); if (k && row[c] != null && String(row[c]).trim() !== "") payload[k] = String(row[c]); });
    if (!Object.keys(payload).length) return;
    const lead = parseCrmLead(payload);
    if (!lead.nome && !lead.telefone && !lead.email) return;
    let id = lead.external_id ?? `linha:${i + 2}`;
    if (seen.has(id)) id = `${id}#${i + 2}`;
    seen.add(id);
    out.push({ ...lead, external_id: id, payload });
  });
  return out;
}

// Hides the middle digits so the panel can list leads without exposing full numbers.
export function maskPhone(tel: string | null): string {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  if (d.length < 8) return tel;
  return `${d.slice(0, d.length - 8)}${d.length > 8 ? " " : ""}${d.slice(-8, -6)}•••-${d.slice(-4)}`;
}

type Grupo = { nome: string; qtd: number; valor: number; rows: CrmLead[] };
const agrupar = (rows: CrmLead[], f: (r: CrmLead) => string | null, vazio: string): Grupo[] => {
  const map = new Map<string, CrmLead[]>();
  for (const r of rows) {
    const k = f(r) ?? vazio;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()]
    .map(([nome, rs]) => ({ nome, qtd: rs.length, valor: rs.reduce((s, r) => s + (r.valor ?? 0), 0), rows: rs }))
    .sort((a, b) => b.qtd - a.qtd);
};

export function crmDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

// Lead date: when the CRM created the deal, or when it reached the panel.
export const dataLead = (r: CrmLead) => r.criado_em ?? r.recebido_em;
export const isVenda = (r: CrmLead) => r.situacao === "WON" || norm(r.etapa).includes("venda realizada");
export const isPerdido = (r: CrmLead) => r.situacao === "LOST" || norm(r.etapa).startsWith("perdid");
// Sale date: won date, else when the card moved into its current stage.
export const dataVenda = (r: CrmLead) => r.ganho_em ?? r.movido_em ?? dataLead(r);

export function computeCrmMetrics(all: CrmLead[], de: string, ate: string, hoje = crmDay(new Date().toISOString())) {
  const inRange = (iso: string) => { const d = crmDay(iso); return d >= de && d <= ate; };
  const leads = all.filter((r) => inRange(dataLead(r)));
  const vendas = all.filter((r) => isVenda(r) && inRange(dataVenda(r)));
  const vendasComValor = vendas.filter((r) => r.valor != null);
  const perdidos = leads.filter(isPerdido);
  const comTelefone = leads.filter((r) => r.telefone);
  const comCampanha = leads.filter((r) => r.campanha);
  const dias = new Set(leads.map((r) => crmDay(dataLead(r)))).size;
  const faturamento = vendasComValor.length ? vendasComValor.reduce((s, r) => s + (r.valor ?? 0), 0) : null;
  const ciclos = vendas.map((r) => (Date.parse(dataVenda(r)) - Date.parse(dataLead(r))) / 86_400_000).filter((d) => Number.isFinite(d) && d >= 0);
  return {
    leads,
    vendas,
    vendasComValor,
    perdidos,
    comTelefone,
    comCampanha,
    hoje: leads.filter((r) => crmDay(dataLead(r)) === hoje),
    campanhas: agrupar(leads, (r) => r.campanha, "Sem campanha"),
    origens: agrupar(leads, (r) => r.origem, "SEM ORIGEM"),
    etapas: agrupar(leads, (r) => r.etapa, "Sem etapa"),
    produtos: agrupar(vendas, (r) => r.produto, "Sem produto/serviço"),
    taxaTelefone: leads.length ? comTelefone.length / leads.length : null,
    taxaCampanha: leads.length ? comCampanha.length / leads.length : null,
    taxaConversao: leads.length ? leads.filter(isVenda).length / leads.length : null,
    mediaDia: dias ? leads.length / dias : null,
    faturamento,
    ticket: faturamento != null ? faturamento / vendasComValor.length : null,
    cicloMedio: ciclos.length ? ciclos.reduce((s, d) => s + d, 0) / ciclos.length : null,
  };
}
