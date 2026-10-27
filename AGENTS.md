<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Atlas Painel
- Theme state is shared through a root provider, restored after hydration and persisted locally; print tokens always use light colors. Why: keep navigation consistent without SSR mismatches or dark reports.
- Automatic Portal reads run only through the scheduled sync; old Drive notifications are acknowledged without dispatch and watch activation is disabled. Why: avoid overlapping automatic reads and quota bursts.
- All mirror sync entry points acquire a per-client database lease. Why: notifications, manual actions and safety cron must not replace the same rows concurrently.
- Open dashboards check mirrored sync status every 30 seconds (shared panels every 60 seconds), never polling Sheets directly. Why: reflect completed syncs without consuming Google quotas.
- Sheets reads are sequential across clients with bounded transient-error backoff; permanent 4xx fail without retry. Why: avoid quota bursts and preserve provider error details.
- Dashboards distinguish stale snapshots from unavailable data and preserve warnings in printed reports. Why: saved results must not be misrepresented after a failed read.
- Portais (Google Sheets) are read-only sources: sync only reads via the Google Sheets connector and mirrors into DB tables (src/lib/sync.server.ts); the UI reads only from the DB. Why: other automations depend on the sheets staying intact.
- Sheet columns/tabs are matched by normalized header/title (trim, lowercase, no accents), never by position. Why: headers vary across Portais.
- Metrics are computed client-side in src/lib/metrics.ts from mirrored rows so every card can list its source rows (audit). Why: auditability requirement.
- The budget card aggregates non-null budget values from the same period-selected lead rows used by the shared table and exposes those rows for audit. Why: keep the card consistent with the budget column without changing consultation or sales totals.
- Lead-table period selection is computed separately from consultation metrics and shared by both panels, CSV and print. Why: show sales and procedures from earlier consultations without changing date-specific metric totals.
- Access: claim_access() requires a verified allowed-domain email for new team grants; reserved hunter logins receive only the scoped reader role. Hunter assignments live in protected hunter_users and can_view_cliente matches the current doctor cadastro. Why: prevent domain and hunter privilege escalation and keep doctor reassignment effective immediately.
- Weekly follow-up uses mirrored vendas grouped into Monday–Sunday weeks clipped to the selected period, applying each metric's date and status rules. Why: undated legacy ACOMPANHAMENTO labels cannot reliably identify the requested month.
- Scheduled sync hits /api/public/cron/sync-portais and throttles recent reads; manual updates remain authenticated. Why: limit read-only endpoint replay and provider quotas.
- Both panels (and /crm) export through the shared print helper and semantic A4 print styles, with all filtered leads instead of the visible page; print CSS gives the fixed report look (white cards without icons, highlighted rates via Card destaque, ruled section titles, print-only pipeline/origin bars, page footer with n / total) and the file is named painel-resultados_cliente_ddmmaa-ddmmaa. Why: keep reports complete, vector-based, consistent with displayed metrics and identical to the approved PDF model.
- Meta Ads uses one OAuth connection per company (meta_conexao id 1 = Atlas, admin-only; id 2 = barbearias, admin or gestor): single-use state rows, allowlisted origins (src/lib/meta-config.ts), token stored server-only (service_role-only table) and read through admin-checked server functions; daily insights upsert into investimento_anuncios keyed by ad account + day (origem meta_api) from the scheduled cron. Why: the token grants access to every client's ad account and must never reach the browser.
- CRM leads arrive by POST at /api/public/webhooks/crm/$token (per-webhook random token, admin-managed in /crm); fields are matched by normalized key name (src/lib/crm.ts), upserted by CRM id or phone, the raw payload is kept for audit, and phones are masked in the UI. Why: CRM payloads vary by platform and the endpoint is public by necessity.
- CRM sources can also be read-only Google Sheets holding a CRM export (crm_webhooks.spreadsheet_id): src/lib/crm-sync.server.ts mirrors them on the scheduled cron (each at most every 10 minutes, sequentially) or on an admin "Ler agora"; leads are dated by Created At and sales by Won At/Last Moved when the stage is Venda Realizada. Why: the CRM only offers inbound webhooks, so exports are the only readable source.
- CRM file sources (crm_webhooks.tipo = 'arquivo') take the CRM's CSV export uploaded in /crm: the browser parses it (src/lib/csv.ts) and an admin-checked server function replaces that source's leads; they never accept webhook posts. Stage cards follow the sheet's stage dropdown order (crm_webhooks.etapas) and each stage's role (venda/perda/funil) is guessed by name with per-source overrides in etapas_papeis. Why: each client names its CRM columns differently and the CRM only offers exports.
- Two companies share the panel: clientes.empresa and crm_webhooks.empresa ('atlas' | 'barbearias'). Atlas staff/doctors/hunters see only Atlas rows; 'gestor' users (traffic managers, invited by e-mail in convites_acesso, any domain) see and manage only barbershops; admins switch companies in the header (src/lib/empresa.tsx). Portal sync, Drive watch and the Atlas panel read only empresa = 'atlas'. Why: the barbershop team must never see doctors' data, and Atlas jobs must ignore barbershop clients without Portais.
