import { Logo } from "./AppShell";
import { fmtDate } from "@/lib/format";

export function PanelTitle({ logoUrl, subtitle, de, ate, clienteNome }: { logoUrl?: string | null | undefined; subtitle?: string | undefined; de: string; ate: string; clienteNome: string }) {
  return (
    <>
      <div className="print-only mb-6 border-b pb-4">
        <div className="flex items-center justify-between">
          <Logo url={logoUrl} />
          <div className="text-right text-xs text-muted-foreground">{clienteNome}<br />{fmtDate(de)} - {fmtDate(ate)}</div>
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Painel de Resultados</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? "Visão executiva consolidada: investimento, vendas, comissões e previsibilidade"}</p>
      </div>
    </>
  );
}

export function PrintFooter() {
  return <div className="print-only mt-10 border-t pt-3 text-center text-[10px] text-muted-foreground">Atlas Assessoria · Relatório gerado em {new Date().toLocaleString("pt-BR")}</div>;
}
