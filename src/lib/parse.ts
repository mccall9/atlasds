// pt-BR parsers shared by sync (server) and UI.
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s || s === "-" || s === "—") return null;
  const neg = /^-|\(.*\)/.test(s);
  s = s.replace(/R\$/gi, "").replace(/[\s%()]/g, "").replace(/^-/, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function parseDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const mo = Number(m[2]);
    const d = Number(m[1]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export function parseBool(v: unknown): boolean | null {
  const s = norm(v);
  if (!s) return null;
  if (["true", "verdadeiro", "sim", "1", "x"].includes(s)) return true;
  if (["false", "falso", "nao", "0"].includes(s)) return false;
  return null;
}

export function emptyToNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export const STATUSES = [
  "CONSULTA AGENDADA",
  "NÃO COMPARECEU",
  "COMPARECEU NÃO FECHOU",
  "AGUARDANDO SINAL",
  "EM NEGOCIAÇÃO",
  "VENDA REALIZADA",
  "PROCEDIMENTO REALIZADO | PAGO",
  "DESMARCOU",
  "CIRURGIA DESMARCADA",
  "DESQUALIFICADA",
] as const;

export function canonicalStatus(v: unknown): string | null {
  const n = norm(v).replace(/\s*\|\s*/g, " | ");
  if (!n) return null;
  const hit = STATUSES.find((s) => norm(s).replace(/\s*\|\s*/g, " | ") === n);
  return hit ?? String(v).trim().toUpperCase();
}

export function extractSpreadsheetId(input: string): string | null {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(input);
  if (m) return m[1];
  const t = input.trim();
  return /^[a-zA-Z0-9-_]{20,}$/.test(t) ? t : null;
}

export const MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
