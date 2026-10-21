-- Funnel order read from the sheet's stage dropdown, and admin overrides of what each stage means.
ALTER TABLE public.crm_webhooks ADD COLUMN etapas text[];
ALTER TABLE public.crm_webhooks ADD COLUMN etapas_papeis jsonb;
