// CRM webhook payloads vary by platform; fields are matched by normalized key name, never by position.
import { norm, parseNumber } from "./parse";

export type CrmLeadFields = {
  external_id: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  campanha: string | null;
  origem: string | null;
  etapa: string | null;
  valor: number | null;
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
  nome: ["nome", "nomecompleto", "name", "fullname", "nomedolead", "nomedopaciente", "nomedocontato", "contactname", "firstname"],
  telefone: ["telefone", "phone", "phonenumber", "celular", "whatsapp", "fone", "mobile", "numero", "number", "tel"],
  email: ["email", "emailaddress", "mail"],
  campanha: ["utmcampaign", "campanha", "campaign", "campaignname", "nomedacampanha", "adname", "anuncio", "adsetname", "conjunto", "campanhanome", "campaigntitle"],
  origem: ["utmsource", "origem", "source", "fonte", "canal", "leadsource", "plataforma", "sourcename", "origemnome"],
  etapa: ["etapa", "coluna", "stage", "status", "fase", "pipelinestage", "stagename", "etapadofunil", "stagetitle", "etapanome", "statusname", "colunanome", "fasename", "pipelinestagename"],
  valor: ["valor", "value", "amount", "price", "preco", "valordonegocio", "dealvalue"],
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
  return {
    // Without a CRM id the phone identifies the contact, so resends update instead of duplicating.
    external_id: id ?? (digits.length >= 8 ? `tel:${digits}` : null),
    nome: text(pick("nome")),
    telefone,
    email: text(pick("email"))?.toLowerCase() ?? null,
    campanha: text(pick("campanha")),
    origem: text(pick("origem"))?.toUpperCase() ?? null,
    etapa: text(pick("etapa")),
    valor: parseNumber(pick("valor")),
  };
}

// Hides the middle digits so the panel can list leads without exposing full numbers.
export function maskPhone(tel: string | null): string {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  if (d.length < 8) return tel;
  return `${d.slice(0, d.length - 8)}${d.length > 8 ? " " : ""}${d.slice(-8, -6)}•••-${d.slice(-4)}`;
}

type Grupo = { nome: string; qtd: number; rows: CrmLead[] };
const agrupar = (rows: CrmLead[], f: (r: CrmLead) => string | null, vazio: string): Grupo[] => {
  const map = new Map<string, CrmLead[]>();
  for (const r of rows) {
    const k = f(r) ?? vazio;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([nome, rs]) => ({ nome, qtd: rs.length, rows: rs })).sort((a, b) => b.qtd - a.qtd);
};

// Period is applied to the day the lead reached the panel (America/Sao_Paulo).
export function crmDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function computeCrmMetrics(all: CrmLead[], de: string, ate: string, hoje = crmDay(new Date().toISOString())) {
  const leads = all.filter((r) => { const d = crmDay(r.recebido_em); return d >= de && d <= ate; });
  const comTelefone = leads.filter((r) => r.telefone);
  const comCampanha = leads.filter((r) => r.campanha);
  const campanhas = agrupar(leads, (r) => r.campanha, "Sem campanha");
  const origens = agrupar(leads, (r) => r.origem, "SEM ORIGEM");
  const etapas = agrupar(leads, (r) => r.etapa, "Sem etapa");
  const dias = new Set(leads.map((r) => crmDay(r.recebido_em))).size;
  return {
    leads,
    comTelefone,
    comCampanha,
    hoje: leads.filter((r) => crmDay(r.recebido_em) === hoje),
    campanhas,
    origens,
    etapas,
    taxaTelefone: leads.length ? comTelefone.length / leads.length : null,
    taxaCampanha: leads.length ? comCampanha.length / leads.length : null,
    mediaDia: dias ? leads.length / dias : null,
    valor: leads.some((r) => r.valor != null) ? leads.reduce((s, r) => s + (r.valor ?? 0), 0) : null,
  };
}
