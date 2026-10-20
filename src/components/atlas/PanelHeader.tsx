import { Logo } from "./AppShell";
import { fmtDate, fmtDateTime } from "@/lib/format";

export function PanelTitle({ logoUrl, title = "Painel de Resultados", subtitle, de, ate, clienteNome, lastSync, filters }: { logoUrl?: string | null | undefined; title?: string; subtitle?: string | undefined; de: string; ate: string; clienteNome: string; lastSync?: string | null | undefined; filters?: string | undefined }) {
  return (
    <>
      <div className="print-only report-header mb-6 border-b pb-4">
        <div className="flex items-center justify-between">
          <Logo url={logoUrl} />
          <div className="text-right text-xs text-muted-foreground">{clienteNome}<br />{fmtDate(de)} - {fmtDate(ate)}</div>
        </div>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm font-medium">{clienteNome}</p>
        <p className="text-xs text-muted-foreground">{filters ? `${filters} · ` : ""}Última atualização: {fmtDateTime(lastSync)}</p>
      </div>
      <div className="no-print">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? "Visão executiva consolidada: investimento, vendas, comissões e previsibilidade"}</p>
      </div>
    </>
  );
}

export function PrintFooter() {
  return <div className="print-only mt-10 border-t pt-3 text-center text-[10px] text-muted-foreground">Atlas Assessoria · Relatório gerado em {new Date().toLocaleString("pt-BR")}</div>;
}
