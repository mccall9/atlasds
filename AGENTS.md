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
- Portais (Google Sheets) are read-only sources: sync only reads via the Google Sheets connector and mirrors into DB tables (src/lib/sync.server.ts); the UI reads only from the DB. Why: other automations depend on the sheets staying intact.
- Sheet columns/tabs are matched by normalized header/title (trim, lowercase, no accents), never by position. Why: headers vary across Portais.
- Metrics are computed client-side in src/lib/metrics.ts from mirrored rows so every card can list its source rows (audit). Why: auditability requirement.
- Access: claim_access() RPC assigns roles by allowed email domain in configuracoes; first matching user becomes admin. Why: domain-restricted team access without hand-managed invites.
- Scheduled sync hits /api/public/cron/sync-portais; it is idempotent and throttled to once per 10 min. Why: route is publicly reachable.
