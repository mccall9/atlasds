-- A CRM source is either a webhook (token) or a read-only Google Sheet mirrored by the scheduled sync.
ALTER TABLE public.crm_webhooks ADD COLUMN spreadsheet_id text;
ALTER TABLE public.crm_webhooks ADD COLUMN aba text;
ALTER TABLE public.crm_webhooks ADD COLUMN ultimo_erro text;
ALTER TABLE public.crm_leads ADD COLUMN produto text;
ALTER TABLE public.crm_leads ADD COLUMN situacao text;
ALTER TABLE public.crm_leads ADD COLUMN criado_em timestamptz;
ALTER TABLE public.crm_leads ADD COLUMN movido_em timestamptz;
ALTER TABLE public.crm_leads ADD COLUMN ganho_em timestamptz;
CREATE INDEX crm_leads_criado ON public.crm_leads (criado_em);
