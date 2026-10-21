import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gget } from "./sync.server";
import { norm } from "./parse";
import { colunaEtapa, parseCrmGrid } from "./crm";

const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const letra = (i: number): string => (i >= 26 ? letra(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

type Fonte = { id: string; nome: string; cliente_id: string | null; spreadsheet_id: string; aba: string | null };

// The stage column's dropdown lists the CRM columns in funnel order; exports without one keep the last known order.
async function ordemEtapas(spreadsheetId: string, tab: string, head: unknown[]): Promise<string[] | null> {
  const col = colunaEtapa(head);
  if (col < 0) return null;
  const range = encodeURIComponent(`${q(tab)}!${letra(col)}2`);
  const meta = await gget(`/spreadsheets/${spreadsheetId}?ranges=${range}&fields=${encodeURIComponent("sheets.data.rowData.values.dataValidation")}`).catch(() => null);
  const values = meta?.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation?.condition?.values;
  const etapas = Array.isArray(values) ? values.map((v: any) => String(v.userEnteredValue ?? "").trim()).filter(Boolean) : [];
  return etapas.length ? etapas : null;
}

// Read-only mirror of a CRM export sheet: the source's rows are replaced on every read.
export async function syncCrmPlanilha(f: Fonte) {
  const db = supabaseAdmin as any;
  try {
    const meta = await gget(`/spreadsheets/${f.spreadsheet_id}?fields=sheets.properties.title`);
    const titles: string[] = (meta.sheets ?? []).map((s: any) => s.properties.title);
    const tab = f.aba ? titles.find((t) => norm(t) === norm(f.aba)) : titles[0];
    if (!tab) throw new Error(f.aba ? `Aba '${f.aba}' não encontrada` : "Planilha sem abas");
    const data = await gget(`/spreadsheets/${f.spreadsheet_id}/values/${encodeURIComponent(`${q(tab)}!A1:AZ5000`)}`);
    const leads = parseCrmGrid(data.values ?? []);
    if (!leads.length) throw new Error("Nenhuma linha com nome, telefone ou e-mail");
    const etapas = await ordemEtapas(f.spreadsheet_id, tab, data.values?.[0] ?? []);
    const now = new Date().toISOString();
    const rows = leads.map((l) => ({ ...l, webhook_id: f.id, cliente_id: f.cliente_id, atualizado_em: now }));
    const { error: de } = await db.from("crm_leads").delete().eq("webhook_id", f.id);
    if (de) throw new Error(de.message);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("crm_leads").upsert(rows.slice(i, i + 500), { onConflict: "webhook_id,external_id" });
      if (error) throw new Error(error.message);
    }
    await db.from("crm_webhooks").update({ ultimo_recebimento: now, ultimo_erro: null, ...(etapas ? { etapas } : {}) }).eq("id", f.id);
    return { ok: true, linhas: rows.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[crm] planilha ${f.nome}:`, msg);
    await db.from("crm_webhooks").update({ ultimo_erro: msg }).eq("id", f.id);
    return { ok: false, erro: msg };
  }
}

// Sequential, like the Portais, so CRM sheets never burst the shared Sheets quota.
export async function syncCrmPlanilhas(opts: { id?: string; minIntervalMs?: number } = {}) {
  const db = supabaseAdmin as any;
  let query = db.from("crm_webhooks").select("id, nome, cliente_id, spreadsheet_id, aba, ultimo_recebimento").eq("ativo", true).not("spreadsheet_id", "is", null);
  if (opts.id) query = query.eq("id", opts.id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const results: { nome: string; ok: boolean; linhas?: number; erro?: string }[] = [];
  for (const f of data ?? []) {
    if (opts.minIntervalMs && f.ultimo_recebimento && Date.now() - new Date(f.ultimo_recebimento).getTime() < opts.minIntervalMs) continue;
    const r = await syncCrmPlanilha(f);
    results.push({ nome: f.nome, ...r });
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return results;
}
