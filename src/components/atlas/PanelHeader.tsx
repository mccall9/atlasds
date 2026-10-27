import { Logo } from "./AppShell";
import { fmtDate, fmtDateTime } from "@/lib/format";

export function PanelTitle({ logoUrl, title = "Painel de Resultados", subtitle, printSubtitle = "Visão executiva consolidada — vendas, consultas e previsibilidade.", de, ate, clienteNome, lastSync, filters }: { logoUrl?: string | null | undefined; title?: string; subtitle?: string | undefined; printSubtitle?: string; de: string; ate: string; clienteNome: string; lastSync?: string | null | undefined; filters?: string | undefined }) {
  return (
    <>
      <div className="print-only report-header">
        <div className="report-head">
          <div>
            <h1>{title}</h1>
            <p>{printSubtitle}</p>
          </div>
          <Logo url={logoUrl} />
        </div>
        <div className="report-meta">
          <span><small>Cliente</small><b>{clienteNome}</b></span>
          <span><small>Período</small><b>{fmtDate(de)} – {fmtDate(ate)}</b></span>
          {filters && <span><small>Filtros</small><b>{filters}</b></span>}
          <span className="report-meta-sync"><small>Atualizado em</small>{fmtDateTime(lastSync)}</span>
        </div>
      </div>
      <div className="no-print">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? "Visão executiva consolidada: investimento, vendas, comissões e previsibilidade"}</p>
      </div>
    </>
  );
}
