const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const fmtBRL = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : brl.format(n));
export const fmtInt = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : int.format(n));
export const fmtPct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MES_CURTO[m - 1]} ${y}`;
}
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Preset = "este-mes" | "mes-passado" | "30d" | "trimestre" | "custom";
export function presetRange(p: Preset): { de: string; ate: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (p === "mes-passado") return { de: toISO(new Date(y, m - 1, 1)), ate: toISO(new Date(y, m, 0)) };
  if (p === "30d") return { de: toISO(new Date(y, m, now.getDate() - 29)), ate: toISO(now) };
  if (p === "trimestre") { const q = Math.floor(m / 3) * 3; return { de: toISO(new Date(y, q, 1)), ate: toISO(new Date(y, q + 3, 0)) }; }
  return { de: toISO(new Date(y, m, 1)), ate: toISO(new Date(y, m + 1, 0)) };
}

export function csvDownload(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
