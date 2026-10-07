import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MESES, canonicalStatus, emptyToNull, norm, parseBool, parseDate, parseNumber,
} from "./parse";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function headers() {
  const lov = process.env["LOVABLE_API_KEY"];
  const key = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lov || !key) throw new Error("Conexão com Google Sheets não configurada");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key };
}

async function gget(path: string) {
  const res = await fetch(`${GATEWAY}${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res.json();
}

type Grid = string[][];
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;

const VENDAS_MAP: Record<string, string> = {
  "nome do paciente": "lead_nome",
  status: "status",
  "data da consulta": "data_consulta",
  consultas: "consultas",
  comparecimentos: "comparecimentos",
  vendas: "vendas",
  "data da venda": "data_venda",
  "data da cirurgia": "data_cirurgia",
  origem: "origem",
  procedimento: "procedimento",
  orcamento: "orcamento",
  "valor fechado (r$)": "valor_fechado",
  "valor fechado": "valor_fechado",
  "procedimento 100% pago?": "pago_100",
  "caixa recebido": "caixa_recebido",
  "comissao atlas (5%)": "comissao_atlas",
  "comissao hunter (3%)": "comissao_hunter",
  "comissao extra (2%)": "comissao_extra",
  observacoes: "observacoes",
};
const NUM = ["consultas", "comparecimentos", "vendas", "orcamento", "valor_fechado", "caixa_recebido", "comissao_atlas", "comissao_hunter", "comissao_extra"];
const DATES = ["data_consulta", "data_venda", "data_cirurgia"];

function parseVendas(grid: Grid, clienteId: string) {
  if (!grid.length) return [];
  const header = (grid[0] ?? []).map((h) => {
    const n = norm(h);
    return VENDAS_MAP[n] ?? (n.startsWith("comissao atlas") ? "comissao_atlas" : n.startsWith("comissao hunter") ? "comissao_hunter" : n.startsWith("comissao extra") ? "comissao_extra" : n.startsWith("valor fechado") ? "valor_fechado" : null);
  });
  if (!header.includes("lead_nome")) throw new Error("Cabeçalho 'Nome do Paciente' não encontrado em VENDAS MÊS");
  const out: Record<string, unknown>[] = [];
  grid.slice(1).forEach((row, i) => {
    const r: Record<string, unknown> = { cliente_id: clienteId, linha_planilha: i + 2 };
    header.forEach((f, c) => {
      if (!f || r[f] !== undefined) return;
      const v = row[c];
      if (NUM.includes(f)) r[f] = parseNumber(v);
      else if (DATES.includes(f)) r[f] = parseDate(v);
      else if (f === "pago_100") r[f] = parseBool(v);
      else if (f === "status") r[f] = canonicalStatus(v);
      else r[f] = emptyToNull(v);
    });
    if (!r["lead_nome"]) return;
    if (r["comparecimentos"] == null) r["comparecimentos"] = 0;
    const o = r["origem"];
    if (typeof o === "string") r["origem"] = o.toUpperCase();
    out.push(r);
  });
  return out;
}

function parseMetas(grid: Grid, clienteId: string, ano: number) {
  const hi = grid.findIndex((r) => norm(r[0]) === "mes");
  if (hi < 0) return [];
  const out: Record<string, unknown>[] = [];
  for (const row of grid.slice(hi + 1)) {
    const n = norm(row[0]);
    let mes = MESES.indexOf(n) + 1;
    if (n.startsWith("total")) mes = 0;
    else if (mes === 0) continue;
    out.push({
      cliente_id: clienteId, ano, mes,
      meta_minima: parseNumber(row[1]), meta_ideal: parseNumber(row[2]), supermeta: parseNumber(row[3]),
      alcancado: parseNumber(row[4]), meta_consultas: parseNumber(row[5]), meta_vendas: parseNumber(row[6]),
      meta_cirurgias: parseNumber(row[7]),
    });
    if (mes === 0) break;
  }
  return out;
}

function parseAcompanhamento(grid: Grid, clienteId: string) {
  // Layout: header row with "SEMANA 1..5" across columns, next row with week start dates,
  // then metric rows (CONSULTAS AGENDADAS, COMPARECIMENTOS, VENDAS REALIZADAS, CIRURGIAS REALIZADAS).
  const hi = grid.findIndex((r) => r.some((c) => /^semana \d/.test(norm(c))));
  if (hi < 0) return [];
  const head = grid[hi] ?? [];
  const dates = grid[hi + 1] ?? [];
  const cols = head.map((c, i) => (/^semana \d/.test(norm(c)) ? i : -1)).filter((i) => i >= 0);
  const metricRow = (key: string) => grid.slice(hi + 1, hi + 12).find((r) => norm(r[0]).startsWith(key));
  const rC = metricRow("consultas"), rCo = metricRow("comparec"), rV = metricRow("vendas"), rCi = metricRow("cirurgias");
  const mesLabel = emptyToNull(rC?.[2]) ?? "";
  return cols.map((c, i) => ({
    cliente_id: clienteId, ordem: i,
    semana_label: `${String(head[c]).trim()}${mesLabel ? ` · ${mesLabel}` : ""}`,
    semana_inicio: parseDate(dates[c]),
    consultas_agendadas: parseNumber(rC?.[c]), comparecimentos: parseNumber(rCo?.[c]),
    vendas: parseNumber(rV?.[c]), cirurgias: parseNumber(rCi?.[c]),
    raw: { head: head[c], date: dates[c] },
  }));
}

function parseRegras(grid: Grid, clienteId: string, layout: string) {
  const antigo = layout === "antigo";
  const regras: Record<string, unknown>[] = [];
  const info: Record<string, unknown>[] = [];
  grid.slice(1).forEach((row, i) => {
    const p = emptyToNull(row[0]);
    if (p) regras.push({
      cliente_id: clienteId, procedimento: p, valor_minimo: parseNumber(row[1]), valor_maximo: parseNumber(row[2]),
      formas_pagamento: emptyToNull(row[3]), permite_desconto_av: emptyToNull(row[4]),
      regras_parcelamento: emptyToNull(row[5]), sinal_percentual: antigo ? null : emptyToNull(row[6]),
    });
    if (i + 2 >= 2 && i + 2 <= 9) {
      const k = emptyToNull(row[antigo ? 7 : 8]);
      const v = emptyToNull(row[antigo ? 8 : 9]);
      if (k || v) info.push({ cliente_id: clienteId, chave: k, valor: v });
    }
  });
  return { regras, info };
}

async function replace(table: string, clienteId: string, rows: Record<string, unknown>[]) {
  const db = supabaseAdmin as any;
  const { error: de } = await db.from(table).delete().eq("cliente_id", clienteId);
  if (de) throw new Error(`${table}: ${de.message}`);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function syncCliente(c: { id: string; spreadsheet_id: string; layout: string; nome: string }) {
  const db = supabaseAdmin as any;
  const { data: log } = await db.from("sync_logs").insert({ cliente_id: c.id }).select("id").single();
  try {
    const meta = await gget(`/spreadsheets/${c.spreadsheet_id}?fields=sheets.properties.title`);
    const titles: string[] = (meta.sheets ?? []).map((s: any) => s.properties.title);
    const byName = (n: string) => titles.find((t) => norm(t) === norm(n));
    const tV = byName("VENDAS MÊS");
    if (!tV) throw new Error("Aba 'VENDAS MÊS' não encontrada");
    const tP = byName("PAINEL DE RESULTADOS");
    const tA = byName("ACOMPANHAMENTO");
    const tR = byName("TABELA E REGRAS");
    const ranges = [`${q(tV)}!A1:AD3000`, tP && `${q(tP)}!A1:J60`, tA && `${q(tA)}!A1:Z120`, tR && `${q(tR)}!A1:J150`].filter(Boolean) as string[];
    const params = new URLSearchParams();
    ranges.forEach((r) => params.append("ranges", r));
    const data = await gget(`/spreadsheets/${c.spreadsheet_id}/values:batchGet?${params.toString()}`);
    const vr: Grid[] = (data.valueRanges ?? []).map((v: any) => v.values ?? []);
    let idx = 0;
    const gV = vr[idx++] ?? [];
    const gP = (tP ? vr[idx++] : []) ?? [];
    const gA = (tA ? vr[idx++] : []) ?? [];
    const gR = (tR ? vr[idx++] : []) ?? [];

    const vendas = parseVendas(gV, c.id);
    const metas = parseMetas(gP, c.id, new Date().getFullYear());
    const acomp = parseAcompanhamento(gA, c.id);
    const { regras, info } = parseRegras(gR, c.id, c.layout);

    await replace("vendas", c.id, vendas);
    if (tP) await replace("metas", c.id, metas);
    if (tA) await replace("acompanhamento", c.id, acomp);
    if (tR) { await replace("regras_procedimentos", c.id, regras); await replace("info_gerais", c.id, info); }

    const now = new Date().toISOString();
    await db.from("clientes").update({ last_sync_at: now, last_sync_error: null }).eq("id", c.id);
    await db.from("sync_logs").update({ fim: now, linhas_lidas: vendas.length, status: "ok" }).eq("id", log?.id);
    return { ok: true, linhas: vendas.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`sync ${c.nome}:`, msg);
    await db.from("clientes").update({ last_sync_error: msg }).eq("id", c.id);
    await db.from("sync_logs").update({ fim: new Date().toISOString(), status: "erro", erro: msg }).eq("id", log?.id);
    return { ok: false, erro: msg };
  }
}

export async function syncTodos(clienteId?: string) {
  const db = supabaseAdmin as any;
  let query = db.from("clientes").select("id, nome, spreadsheet_id, layout").eq("ativo", true);
  if (clienteId) query = query.eq("id", clienteId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const results: { nome: string; ok: boolean; erro?: string }[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const batch = data.slice(i, i + 4);
    const r = await Promise.all(batch.map((c: any) => syncCliente(c)));
    r.forEach((x, j) => results.push({ nome: batch[j].nome, ok: x.ok, erro: x.erro }));
  }
  return results;
}
