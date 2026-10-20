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
- Both panels export through the shared print helper and semantic A4 print styles, with all filtered leads instead of the visible page. Why: keep reports complete, vector-based and consistent with displayed metrics.
- Meta Ads uses a single admin-initiated OAuth connection: single-use state rows, allowlisted origins (src/lib/meta-config.ts), token stored server-only (service_role-only table) and read through admin-checked server functions; daily insights upsert into investimento_anuncios keyed by ad account + day (origem meta_api) from the scheduled cron. Why: the token grants access to every doctor's ad account and must never reach the browser.
