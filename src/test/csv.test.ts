import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { parseCrmGrid } from "@/lib/crm";

describe("parseCsv", () => {
  it("detects semicolons and keeps empty cells", () => {
    expect(parseCsv("ID;Status;Amount\r\n1;OPEN;\r\n2;WON;45.00\r\n")).toEqual([["ID", "Status", "Amount"], ["1", "OPEN", ""], ["2", "WON", "45.00"]]);
  });

  it("handles commas, quotes, escaped quotes and line breaks inside fields", () => {
    expect(parseCsv('﻿Nome,Obs\n"Silva, Ana","disse ""oi""\nem duas linhas"\n')).toEqual([["Nome", "Obs"], ["Silva, Ana", 'disse "oi"\nem duas linhas']]);
  });

  it("feeds the CRM export straight into the lead parser", () => {
    const csv = "ID;Status;Amount;Created At;Last Updated;Won At;Last Moved;Contact Name;Contact E-mail;Contact Phone;Product/Service;Sales Step\n"
      + "9000001;OPEN;100.00;Wed Oct 21 2026 12:49:26 GMT+0000 (Coordinated Universal Time);;;Wed Oct 21 2026 12:49:26 GMT+0000 (Coordinated Universal Time);Ana Teste;;5548999990001;HIDRATAÇÃO;VENDAS REALIZADAS\n";
    const [r] = parseCrmGrid(parseCsv(csv));
    expect(r).toMatchObject({ external_id: "9000001", nome: "Ana Teste", valor: 100, produto: "HIDRATAÇÃO", etapa: "VENDAS REALIZADAS", situacao: "ABERTO" });
  });
});
