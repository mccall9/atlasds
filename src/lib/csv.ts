// CSV exports from CRMs use ";" or "," (or tab) and may quote fields with embedded separators or line breaks.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const count = (c: string) => firstLine.split(c).length - 1;
  const sep = [";", ",", "\t"].reduce((best, c) => (count(c) > count(best) ? c : best), ";");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

// Exports saved by Excel on Windows are often Latin-1; fall back when UTF-8 decoding breaks accents.
export async function readCsvFile(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return parseCsv(utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8);
}
